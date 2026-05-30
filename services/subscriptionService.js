const { Op } = require('sequelize');
const CompanySubscription = require('../models/Plans/CompanySubscription');
const CompanyPlanOverride = require('../models/Plans/CompanyPlanOverride');
const Plans = require('../models/Plans/Plans');
const Project = require('../models/Project/Project');
const SubscriptionAddon = require('../models/Plans/SubscriptionAddon');
const User = require('../models/User/User');

const DEFAULT_BASIC_TRIAL_DAYS = 7;
const DEFAULT_MONTHLY_DAYS = 30;

const PLAN_DEFINITIONS = [
  {
    id: 'basic',
    name: 'Basic',
    code: 'basic',
    status: 'active',
    billingInterval: 'monthly',
    priceCents: 0,
    currency: 'INR',
    sortOrder: 1,
    defaultLimits: {
      maxEmployees: 5,
      maxProjects: 3,
    },
    featureFlags: {
      customRoles: false,
      customPermissions: false,
      advancedReports: false,
    },
    trialDays: DEFAULT_BASIC_TRIAL_DAYS,
  },
  {
    id: 'standard',
    name: 'Standard',
    code: 'standard',
    status: 'active',
    billingInterval: 'monthly',
    priceCents: 49900,
    currency: 'INR',
    sortOrder: 2,
    defaultLimits: {
      maxEmployees: 25,
      maxProjects: 12,
    },
    featureFlags: {
      customRoles: true,
      customPermissions: true,
      advancedReports: true,
    },
    trialDays: DEFAULT_BASIC_TRIAL_DAYS,
  },
  {
    id: 'premium',
    name: 'Premium',
    code: 'premium',
    status: 'active',
    billingInterval: 'monthly',
    priceCents: 99900,
    currency: 'INR',
    sortOrder: 3,
    defaultLimits: {
      maxEmployees: 100,
      maxProjects: 50,
    },
    featureFlags: {
      customRoles: true,
      customPermissions: true,
      advancedReports: true,
      prioritySupport: true,
    },
    trialDays: DEFAULT_BASIC_TRIAL_DAYS,
  },
];

const toPlain = (record) => {
  if (!record) {
    return null;
  }

  return record.get ? record.get({ plain: true }) : record;
};

const normalizePlan = (plan) => {
  const plainPlan = toPlain(plan);
  if (!plainPlan) {
    return null;
  }

  const priceRupees = Math.round((plainPlan.priceCents || 0) / 100);
  const defaultLimits = plainPlan.defaultLimits || {};

  return {
    id: plainPlan.id,
    code: plainPlan.code,
    name: plainPlan.name,
    status: plainPlan.status,
    billingInterval: plainPlan.billingInterval,
    priceCents: plainPlan.priceCents,
    price: priceRupees,
    monthlyPrice: priceRupees,
    annualPrice: priceRupees * 12,
    currency: plainPlan.currency,
    sortOrder: plainPlan.sortOrder,
    defaultLimits,
    featureFlags: plainPlan.featureFlags || {},
    trialDays: plainPlan.trialDays || DEFAULT_BASIC_TRIAL_DAYS,
    limits: {
      maxEmployees: defaultLimits.maxEmployees || 0,
      maxProjects: defaultLimits.maxProjects || 0,
    },
  };
};

const serializeSubscription = ({ subscription, plan, companyOverride, addonSummary, usage }) => {
  if (!subscription) {
    return null;
  }

  const plainSubscription = toPlain(subscription);
  const plainPlan = normalizePlan(plan);
  const expiresAt = plainSubscription.endsAt ? new Date(plainSubscription.endsAt) : null;
  const now = new Date();
  const isExpired = plainSubscription.status === 'expired' || (expiresAt ? expiresAt <= now : false);
  const effectiveLimits = plainPlan ? {
    ...plainPlan.limits,
    maxEmployees: Number.isFinite(companyOverride?.maxEmployees)
      ? companyOverride.maxEmployees
      : plainPlan.limits.maxEmployees,
  } : {
    maxEmployees: Number.isFinite(companyOverride?.maxEmployees) ? companyOverride.maxEmployees : 0,
    maxProjects: 0,
  };

  return {
    id: plainSubscription.id,
    companyId: plainSubscription.companyId,
    planId: plainSubscription.planId,
    status: isExpired ? 'expired' : plainSubscription.status,
    startsAt: plainSubscription.startsAt,
    endsAt: plainSubscription.endsAt,
    graceUntil: plainSubscription.graceUntil,
    autoRenew: plainSubscription.autoRenew,
    isExpired,
    remainingDays: expiresAt ? Math.max(0, Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24))) : null,
    plan: plainPlan,
    limits: effectiveLimits,
    usage,
    featureFlags: plainPlan ? {
      ...plainPlan.featureFlags,
      ...(companyOverride?.featureFlags || {}),
    } : (companyOverride?.featureFlags || {}),
    addons: addonSummary,
  };
};

const ensureDefaultPlans = async (transaction) => {
  for (const plan of PLAN_DEFINITIONS) {
    await Plans.upsert(plan, transaction ? { transaction } : undefined);
  }
};

const getPlanDurationDays = (plan) => {
  if (!plan) {
    return DEFAULT_MONTHLY_DAYS;
  }

  if (plan.id === 'basic') {
    return DEFAULT_BASIC_TRIAL_DAYS;
  }

  if (plan.billingInterval === 'yearly') {
    return 365;
  }

  return DEFAULT_MONTHLY_DAYS;
};

const getCompanyUsage = async (companyId) => {
  const [activeEmployees, projects, totalEmployees] = await Promise.all([
    // Count active employees by approved flag instead of legacy `role` column
    User.count({
      where: {
        companyCode: companyId,
        approved: true,
      },
    }),
    Project.count({ where: { companyId } }),
    User.count({
      where: {
        companyCode: companyId,
      },
    }),
  ]);

  return {
    activeEmployees,
    projects,
    totalEmployees,
  };
};

const getSubscriptionContext = async (companyId, options = {}) => {
  const { transaction } = options;

  await ensureDefaultPlans(transaction);

  const subscription = await CompanySubscription.findOne({
    where: { companyId },
    order: [['createdAt', 'DESC']],
    transaction,
  });

  if (!subscription) {
    return null;
  }

  const plainSubscription = toPlain(subscription);
  const plan = await Plans.findByPk(plainSubscription.planId, { transaction });
  const companyOverride = await CompanyPlanOverride.findByPk(companyId, { transaction });
  const subscriptionAddons = await SubscriptionAddon.findAll({
    where: { companyId, status: 'active' },
    transaction,
  });
  const addonSummary = subscriptionAddons.map((addon) => toPlain(addon));
  const usage = await getCompanyUsage(companyId);

  return {
    subscription,
    plan,
    companyOverride,
    addonSummary,
    usage,
    serialized: serializeSubscription({
      subscription,
      plan,
      companyOverride,
      addonSummary,
      usage,
    }),
  };
};

const createTrialSubscription = async (companyId, transaction, companyCreatedAt = new Date()) => {
  await ensureDefaultPlans(transaction);

  const basicPlan = await Plans.findByPk('basic', { transaction });
  if (!basicPlan) {
    throw new Error('Basic plan is not available');
  }

  const startsAt = companyCreatedAt || new Date();
  const endsAt = new Date(startsAt);
  endsAt.setDate(endsAt.getDate() + getPlanDurationDays(basicPlan));

  return CompanySubscription.create({
    companyId,
    planId: basicPlan.id,
    status: 'active',
    startsAt,
    endsAt,
    graceUntil: null,
    autoRenew: false,
  }, transaction ? { transaction } : undefined);
};

const activatePlanForCompany = async (companyId, planId, transaction) => {
  await ensureDefaultPlans(transaction);

  const plan = await Plans.findByPk(planId, { transaction });
  if (!plan || plan.status !== 'active') {
    throw new Error('Selected plan is not available');
  }

  const existingSubscription = await CompanySubscription.findOne({
    where: { companyId },
    order: [['createdAt', 'DESC']],
    transaction,
  });

  const startsAt = new Date();
  const endsAt = new Date(startsAt);
  endsAt.setDate(endsAt.getDate() + getPlanDurationDays(plan));

  if (existingSubscription) {
    await existingSubscription.update({
      planId: plan.id,
      status: 'active',
      startsAt,
      endsAt,
      graceUntil: null,
      autoRenew: false,
    }, transaction ? { transaction } : undefined);
    return existingSubscription;
  }

  return CompanySubscription.create({
    companyId,
    planId: plan.id,
    status: 'active',
    startsAt,
    endsAt,
    graceUntil: null,
    autoRenew: false,
  }, transaction ? { transaction } : undefined);
};

const validateSubscriptionCapacity = async (companyId, resourceType) => {
  const context = await getSubscriptionContext(companyId);

  if (!context || !context.serialized) {
    return {
      allowed: false,
      status: 404,
      message: 'Subscription not found for this organization',
      context: null,
    };
  }

  const subscription = context.serialized;
  if (subscription.isExpired) {
    return {
      allowed: false,
      status: 403,
      message: 'Your Basic plan has expired. Upgrade to Standard or Premium to continue.',
      context: subscription,
    };
  }

  const isProject = resourceType === 'project';
  const isSignupSeatCheck = resourceType === 'employee_request';
  const limitKey = isProject ? 'maxProjects' : 'maxEmployees';
  const currentCount = isProject
    ? subscription.usage.projects
    : (isSignupSeatCheck ? subscription.usage.totalEmployees : subscription.usage.activeEmployees);
  const limitValue = Number(subscription.limits?.[limitKey] || 0);
  const resourceLabel = isProject ? 'Project' : 'Employee';

  if (limitValue > 0 && currentCount >= limitValue) {
    return {
      allowed: false,
      status: 403,
      message: `${resourceLabel} limit reached for the current plan. Please upgrade to Standard or Premium.`,
      context: subscription,
    };
  }

  return {
    allowed: true,
    status: 200,
    message: 'Allowed',
    context: subscription,
  };
};

module.exports = {
  ensureDefaultPlans,
  getSubscriptionContext,
  createTrialSubscription,
  activatePlanForCompany,
  validateSubscriptionCapacity,
  normalizePlan,
  serializeSubscription,
};