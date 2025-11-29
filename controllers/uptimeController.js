const Uptime = require("../models/Uptime");
const parsePagination = require("../utils/pagination");

/**
 * Unified uptime query handler supporting:
 * - Admins querying by company, user, and week with pagination and sorting
 * - Regular users querying their own uptimes (single or multiple weeks)
 * - Optional filtering by week (as query param or route param)
 */
const getUptimes = async (req, res) => {
  try {
    const {
      // optional filters from query and params
      userId: queryUserId,
      companyId: queryCompanyId,
      week: queryWeek,
      sort = "week",
      order = "desc",
      all,
    } = req.query;

    // You may also allow week and companyId in route params, e.g. req.params.week
    const companyIdParam = req.params.companyId;
    const weekParam = req.params.week;

    const { page, limit, skip } = parsePagination(req.query);

    // Derive basic user info and roles from token payload
    const currentUserId = req.user.id;
    const currentUserCompanyId = req.user.companyCode || req.user.id;
    const currentUserRole = req.user.role;

    /**
     * Construct filter object according to role and query inputs
     */

    const filter = {};

    // Role based filtering
    if (currentUserRole !== "admin" && currentUserRole !== "sadmin") {
      // Regular user: only their data
      filter.userId = currentUserId;
      if (queryWeek || weekParam) {
        filter.week = queryWeek || weekParam;
      }
    } else {
      // Admins: filter by company scope strictly
      const effectiveCompanyId =
        queryCompanyId || companyIdParam || currentUserCompanyId;
      if (effectiveCompanyId !== currentUserCompanyId) {
        return res
          .status(403)
          .json({ error: "Access denied: company mismatch" });
      }

      filter.companyId = effectiveCompanyId;

      if (queryUserId) filter.userId = queryUserId;
      if (queryWeek || weekParam) filter.week = queryWeek || weekParam;
    }

    // Sorting - whitelist allowed fields
    const allowedSortFields = ["week", "userId", "companyId"];
    const sortField = allowedSortFields.includes(sort) ? sort : "week";
    const sortOrder = order === "asc" ? 1 : -1;
    const sortOption = { [sortField]: sortOrder };

    // Decide whether to return multiple records or a single record
    // If 'all' is true and user is querying own data, return paginated list
    // Otherwise, try to return a single record for specified week or latest
    if (
      (all && all.toString().toLowerCase() === "true") ||
      currentUserRole === "admin" ||
      currentUserRole === "sadmin"
    ) {
      // List with pagination
      const total = await Uptime.countDocuments(filter);
      const uptimes = await Uptime.find(filter)
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .lean();
      return res.json({ total, page, limit, uptimes });
    } else {
      // Single uptime record expected (latest or for a particular week)
      const uptime = await Uptime.findOne(filter).sort(sortOption).lean();
      if (!uptime)
        return res.status(404).json({ error: "No uptime record found" });
      return res.json(uptime);
    }
  } catch (err) {
    console.error("Error in getUptimesUnified:", err);
    return res.status(500).json({ error: "Error fetching uptimes" });
  }
};

module.exports = {
  getUptimes,
};
