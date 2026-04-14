const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");
const { loginSchema, registerSchema } = require("../validators/auth.validator");
const { signAccessToken } = require("../utils/tokens");

async function register(req, res, next) {
  try {
    const input = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      return res.status(409).json({ message: "Email is already used" });
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    const user = await prisma.user.create({
      data: {
        fullName: input.fullName,
        email: input.email,
        passwordHash,
        role: input.role || "READER"
      }
    });

    const token = signAccessToken({ id: user.id, email: user.email, role: user.role });

    return res.status(201).json({
      token,
      user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role }
    });
  } catch (error) {
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const input = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = signAccessToken({ id: user.id, email: user.email, role: user.role });
    return res.json({
      token,
      user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role }
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { register, login };
