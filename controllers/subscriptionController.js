const Plans = require('../models/Plans/Plans');
const { seq } = require('../config/db');
const {
  activatePlanForCompany,
  ensureDefaultPlans,
  getSubscriptionContext,
  normalizePlan,
} = require('../services/subscriptionService');

const getCompanyIdFromRequest = (req) => {
  if (req.userType === 'company') {
    return req.user.id;
  }

  return req.user.companyCode || req.user.id;
};

const getCompanySubscription = async (req, res) => {
  try {
    const companyId = getCompanyIdFromRequest(req);
    await ensureDefaultPlans();

    const context = await getSubscriptionContext(companyId);
    const plans = await Plans.findAll({
      where: { status: 'active' },
      order: [['sortOrder', 'ASC']],
    });

    return res.json({
      subscription: context ? context.serialized : null,
      plans: plans.map((plan) => normalizePlan(plan)),
    });
  } catch (error) {
    console.error('getCompanySubscription error:', error);
    return res.status(500).json({ msg: 'Failed to load subscription data' });
  }
};

const upgradeCompanySubscription = async (req, res) => {
  const transaction = await seq.transaction();

  try {
    const companyId = getCompanyIdFromRequest(req);
    const { planId, planCode } = req.body;
    const selectedPlanId = planId || planCode;

    if (!selectedPlanId) {
      await transaction.rollback();
      return res.status(400).json({ msg: 'planId or planCode is required' });
    }

    await ensureDefaultPlans(transaction);

    const plan = await Plans.findByPk(selectedPlanId, { transaction })
      || await Plans.findOne({ where: { code: selectedPlanId }, transaction });

    if (!plan) {
      await transaction.rollback();
      return res.status(404).json({ msg: 'Plan not found' });
    }

    if (plan.id === 'basic') {
      await transaction.rollback();
      return res.status(400).json({ msg: 'Basic plan is assigned automatically during organization registration' });
    }

    await activatePlanForCompany(companyId, plan.id, transaction);
    await transaction.commit();

    const refreshed = await getSubscriptionContext(companyId);

    return res.json({
      msg: 'Plan updated successfully',
      subscription: refreshed ? refreshed.serialized : null,
    });
  } catch (error) {
    await transaction.rollback().catch(() => {});
    console.error('upgradeCompanySubscription error:', error);
    return res.status(500).json({ msg: 'Failed to update subscription' });
  }
};

module.exports = {
  getCompanySubscription,
  upgradeCompanySubscription,
};