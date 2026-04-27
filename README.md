#+ HRMS Subscription + RBAC Roadmap (Backend)

This document defines a detailed, scalable roadmap to implement the subscription and role/permission flow shown in the provided system design. It is written to be **plan-agnostic** and **company-configurable**, so new plans, limits, and permissions can be added over time without refactoring core logic.

---

## Goals

- Implement plan-based subscription lifecycle (Basic/Standard/Premium by default).
- Enforce limits such as max employees and allowed roles at the API level.
- Support custom roles/permissions for higher tiers.
- Keep the system scalable for new plans and company-specific overrides.
- Follow system design principles: separation of concerns, idempotent APIs, extensible data model, and safe migrations.

---

## Default Plan Rules (Configurable per Company)

These are the **default rules**. Each company can override limits and features later via admin configuration or enterprise contract.

### Plan Matrix (Defaults)

| Plan     | Max Employees | Allowed Roles                      | Custom Roles | Custom Permissions | Notes |
|----------|----------------|------------------------------------|--------------|--------------------|-------|
| Basic    | 10             | employee, manager, admin           | No           | No                 | Core task/project features only |
| Standard | 50             | employee, manager, admin           | Yes          | Yes                | Adds reporting, extended integrations |
| Premium  | 250            | employee, manager, admin, sadmin   | Yes          | Yes                | Adds advanced analytics & audit logs |

### Company-Specific Overrides

Each company can have an override profile:

- `maxEmployees` override (e.g., 15, 75, 1000)
- `allowedRoles` override (e.g., add `auditor` or remove `manager`)
- `allowCustomRoles` toggle
- `allowCustomPermissions` toggle
- `featureFlags` per company or per plan

This ensures enterprise customers can have bespoke rules without changing the base plan catalog.

---

## System Design Principles Applied

- **Config-driven limits**: enforcement reads from `CompanySubscription` + `Plan` + optional `CompanyPlanOverride`.
- **Feature flags**: no hardcoding in controllers; use a centralized policy service.
- **Separation of concerns**: models, services, controllers, and policy enforcement are independent.
- **Multi-tenant isolation**: plan data and roles are scoped by `companyId`.
- **Forward compatibility**: new plans or features are added as rows, not code branches.

---

## Target Architecture (Backend)

### New Models

1. **Plan**
	- `id`, `name`, `interval`, `price`, `featureFlags`, `defaultLimits`
2. **CompanySubscription**
	- `companyId`, `planId`, `status`, `startsAt`, `endsAt`, `graceUntil`, `autoRenew`
3. **CompanyPlanOverride** (optional)
	- `companyId`, `maxEmployees`, `allowedRoles`, `allowCustomRoles`, `allowCustomPermissions`
4. **Role**
	- `id`, `companyId`, `name`, `isSystem`, `isCustom`
5. **Permission**
	- `id`, `key`, `label`, `description`
6. **RolePermission**
	- `roleId`, `permissionId`
7. **UserRole**
	- `userId`, `roleId`

### Core Services

- `PlanService`: read plan catalog, resolve defaults
- `SubscriptionService`: compute current status, handle upgrades/downgrades
- `PolicyService`: resolve effective limits and permissions
- `RoleService`: create/update roles, apply plan rules

---

## Roadmap (Detailed, Step-by-Step)

### Phase 1: Foundation (Data + Config)

1. Add `Plan`, `CompanySubscription`, `Role`, `Permission`, `RolePermission`, `UserRole` models.
2. Seed default plan catalog (Basic/Standard/Premium).
3. Seed system roles (`employee`, `manager`, `admin`, `sadmin`) and base permissions.
4. Create `CompanyPlanOverride` model to allow per-company overrides.
5. Migrate existing companies to `Basic` with `active` subscription.

**Output**: database schema ready for multi-plan growth.

---

### Phase 2: Policy & Enforcement Layer

1. Implement `PolicyService`:
	- Resolve effective limits from Plan + Company overrides.
	- Provide helpers: `canCreateUser`, `canCreateRole`, `allowedRoles`.
2. Add middleware:
	- `enforcePlanLimits` for employee creation.
	- `enforceCustomRolePolicy` for role creation.
	- `authorize(permissionKey)` for permission-aware endpoints.

**Output**: limits are enforced centrally, not scattered in controllers.

---

### Phase 3: Subscription Lifecycle

1. Implement upgrade/downgrade endpoints:
	- `POST /company/subscription/upgrade`
	- `POST /company/subscription/downgrade`
2. Add scheduled job:
	- Expire subscriptions, apply grace period, auto-downgrade.
3. Auto-enforcement on downgrade:
	- Disable custom roles if not allowed.
	- Reassign users to allowed roles.
	- Lock advanced features.

**Output**: subscription changes reflect immediately in system behavior.

---

### Phase 4: Role & Permission Management

1. Expose endpoints for role creation and assignment:
	- `POST /roles`, `GET /roles`, `POST /roles/:id/permissions`
2. Map `User` → `UserRole` instead of direct enum-only role.
3. Keep system roles immutable for safety.
4. Add API responses that include effective permissions.

**Output**: complete RBAC system with scalable permission model.

---

### Phase 5: Frontend Integration

1. Make plan selection dynamic in Plan page.
2. Add UI for subscription upgrade/downgrade and billing status.
3. Show role management only if `allowCustomRoles`.
4. Block user creation when `maxEmployees` reached.

**Output**: UI follows policy rules from backend.

---

### Phase 6: Observability & Scaling

1. Add logging for policy decisions (non-PII).
2. Add metrics for subscription state transitions.
3. Cache plan catalog and permissions to reduce DB load.
4. Add pagination and filters for roles/users to scale org size.

**Output**: system ready for growth and monitoring.

---

## API Surface (Proposed)

- `GET /plans`
- `GET /company/subscription`
- `POST /company/subscription/upgrade`
- `POST /company/subscription/downgrade`
- `POST /roles`
- `GET /roles`
- `POST /roles/:id/permissions`
- `GET /permissions`

All endpoints must use `PolicyService` to ensure plan enforcement.

---

## Effective Limits (How Max Employees Is Calculated)

Effective max employees is computed at request time using:

1. Plan default limit (`Plan.defaultLimits.maxEmployees`)
2. Company override (`CompanyPlanOverride.maxEmployees`) if present
3. Add-on purchases (`SubscriptionAddon` with `addonCode = extra_employees`)

Formula:

$$
	ext{effectiveMaxEmployees} = \text{baseLimit} + \sum(\text{unitSize} \times \text{quantityPurchased})
$$

Where `baseLimit` comes from the company override if present, otherwise from the plan default.

---

## Controller Usage Example (Max Employees + Add-ons)

This shows how to use the policy service when creating a user:

```javascript
const Plans = require('../models/Plans');
const CompanyPlanOverride = require('../models/CompanyPlanOverride');
const SubscriptionAddon = require('../models/SubscriptionAddon');
const User = require('../models/User');
const { getEffectiveMaxEmployees } = require('../services/policyService');

const canCreateEmployee = async (companyId, planId) => {
	const plan = await Plans.findByPk(planId);
	const companyOverride = await CompanyPlanOverride.findByPk(companyId);
	const subscriptionAddons = await SubscriptionAddon.findAll({ where: { companyId, status: 'active' } });

	const effectiveMax = getEffectiveMaxEmployees({
		plan,
		companyOverride,
		subscriptionAddons,
	});

	const currentCount = await User.count({ where: { companyCode: companyId } });
	return currentCount < effectiveMax;
};
```

---

## Scaling Notes

- Adding a new plan does **not** require controller changes; just insert a new plan row and seed permissions if needed.
- Company-specific overrides are modeled as data, not branching logic.
- Roles and permissions are fully normalized, supporting hundreds of roles without schema changes.

---

## Security Notes

- Never trust frontend. All limits and permissions must be enforced in backend middleware.
- Use least privilege for default roles.
- Keep system roles immutable to avoid privilege escalation.

---

## Next Implementation Task (Recommended)

Start with Phase 1 (data model + seed). This unlocks the policy layer and subscription lifecycle without rework.

