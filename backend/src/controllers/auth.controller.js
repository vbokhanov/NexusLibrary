const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");
const { loginSchema, registerSchema, changePasswordSchema } = require("../validators/auth.validator");
const { signAccessToken } = require("../utils/tokens");

async function register(req, res, next) {
  try {
    const input = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      return res.status(409).json({ message: "Email is already used" });
    }

    const role = input.role || "READER";
    const librarianDigits =
      role === "LIBRARIAN" ? String(input.librarianCode || "").replace(/\D/g, "") : "";

    if (role === "LIBRARIAN") {
      const codeRow = await prisma.librarianInviteCode.findFirst({
        where: { code: librarianDigits, used: false }
      });
      if (!codeRow) {
        return res.status(403).json({ message: "Неверный или уже использованный код библиотекаря" });
      }

      const passwordHash = await bcrypt.hash(input.password, 10);

      const user = await prisma.$transaction(async (tx) => {
        await tx.librarianInviteCode.update({
          where: { id: codeRow.id },
          data: { used: true, usedAt: new Date() }
        });
        return tx.user.create({
          data: {
            fullName: input.fullName,
            email: input.email,
            passwordHash,
            role: "LIBRARIAN"
          }
        });
      });

      const token = signAccessToken({ id: user.id, email: user.email, role: user.role });
      return res.status(201).json({
        token,
        user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role }
      });
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await prisma.user.create({
      data: {
        fullName: input.fullName,
        email: input.email,
        passwordHash,
        role: "READER"
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

    if (user.banned) {
      return res.status(403).json({ message: "Аккаунт заблокирован. Обратитесь к администратору." });
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

async function changePassword(req, res, next) {
  try {
    const input = changePasswordSchema.parse(req.body);
    const userId = req.user.id;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ message: "User not found" });

    const ok = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!ok) return res.status(400).json({ message: "Текущий пароль указан неверно" });

    const passwordHash = await bcrypt.hash(input.newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash }
    });

    return res.json({ message: "Пароль обновлён" });
  } catch (error) {
    return next(error);
  }
}

module.exports = { register, login, changePassword };
