const prisma = require("../config/prisma");
const { verifyAccessToken } = require("../utils/tokens");

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = header.slice(7);

  try {
    const payload = verifyAccessToken(token);
    const id = Number(payload.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(401).json({ message: "Token invalid or expired" });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, role: true, fullName: true, banned: true }
    });

    if (!user) {
      return res.status(401).json({ message: "Token invalid or expired" });
    }
    if (user.banned) {
      return res.status(403).json({ message: "Аккаунт заблокирован" });
    }

    req.user = user;
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
  requireAuth: asyncHandler(requireAuth),
  requireRole
};
