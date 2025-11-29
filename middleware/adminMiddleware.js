const adminMiddleware = (req, res, next) => {
  const { role } = req.user;
  if (role === "admin" || role === "sadmin") {
    return next();
  }
  return res
    .status(403)
    .json({ error: "Admin or super admin privileges required" });
};

module.exports = adminMiddleware;
