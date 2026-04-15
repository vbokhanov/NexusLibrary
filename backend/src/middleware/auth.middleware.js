const { verifyAccessToken } = require("../utils/tokens");

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = header.slice(7);

  try {
    const payload = verifyAccessToken(token);
    req.user = { ...payload, id: Number(payload.id) };
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Token invalid or expired" });
  }
}

function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Insufficient role level" });
    }
    return next();
  };
}

module.exports = {
  requireAuth,
  requireRole
};
