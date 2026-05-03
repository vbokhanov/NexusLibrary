const bcrypt = require("bcryptjs");
const { z } = require("zod");
const prisma = require("../config/prisma");

function digits10() {
  let s = "";
  for (let i = 0; i < 10; i++) s += String(Math.floor(Math.random() * 10));
  return s;
}

async function createLibrarianCode(req, res, next) {
  try {
    const adminId = req.user.id;
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = digits10();
      try {
        const row = await prisma.librarianInviteCode.create({
          data: { code, createdById: adminId }
        });
        return res.status(201).json({ code: row.code, id: row.id });
      } catch (e) {
        if (e.code === "P2002") continue;
        throw e;
      }
    }
    return res.status(500).json({ message: "Не удалось сгенерировать уникальный код" });
  } catch (error) {
    return next(error);
  }
}

async function listUsers(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(4, Number(req.query.limit) || 12));
    const q = String(req.query.q || "").trim();

    const where = q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { fullName: { contains: q, mode: "insensitive" } }
          ]
        }
      : {};

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { id: "asc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          banned: true,
          createdAt: true
        }
      }),
      prisma.user.count({ where })
    ]);

    return res.json({ items, total, page, limit, pages: Math.ceil(total / limit) || 1 });
  } catch (error) {
    return next(error);
  }
}

const adminPatchSchema = z.object({
  fullName: z.string().trim().min(3).max(120).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  banned: z.boolean().optional(),
  role: z.enum(["ADMIN", "LIBRARIAN", "READER"]).optional()
});

async function getUser(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ message: "Invalid id" });

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        banned: true,
        createdAt: true,
        updatedAt: true
      }
    });
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json(user);
  } catch (error) {
    return next(error);
  }
}

async function updateUser(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ message: "Invalid id" });

    const body = adminPatchSchema.parse(req.body || {});
    const actorId = req.user.id;

    if (id === 1 && body.banned === true) {
      return res.status(403).json({ message: "Нельзя заблокировать служебного администратора" });
    }
    if (id === 1 && body.role && body.role !== "ADMIN") {
      return res.status(403).json({ message: "Нельзя сменить роль служебного администратора" });
    }
    if (id === actorId && (body.banned === true || body.role !== undefined)) {
      return res.status(403).json({ message: "Нельзя изменить роль или заблокировать самого себя" });
    }

    const data = {};
    if (body.fullName != null) data.fullName = body.fullName;
    if (body.email != null) data.email = body.email;
    if (body.banned != null) data.banned = body.banned;
    if (body.role != null) data.role = body.role;

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: "Нет полей для обновления" });
    }

    if (data.email) {
      const clash = await prisma.user.findFirst({ where: { email: data.email, id: { not: id } } });
      if (clash) return res.status(409).json({ message: "Email уже занят" });
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        banned: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return res.json(user);
  } catch (error) {
    return next(error);
  }
}

const setPasswordSchema = z.object({
  newPassword: z.string().min(8).max(64)
});

async function setUserPassword(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ message: "Invalid id" });
    const { newPassword } = setPasswordSchema.parse(req.body || {});
    const actorId = req.user.id;

    if (id === actorId) {
      return res.status(403).json({ message: "Смена своего пароля — только через форму в аккаунте" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id },
      data: { passwordHash }
    });

    return res.json({ message: "Пароль пользователя обновлён" });
  } catch (error) {
    return next(error);
  }
}

async function deleteUser(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ message: "Invalid id" });
    const actorId = req.user.id;

    if (id === 1) {
      return res.status(403).json({ message: "Нельзя удалить служебного администратора" });
    }
    if (id === actorId) {
      return res.status(403).json({ message: "Нельзя удалить собственный аккаунт" });
    }

    await prisma.user.delete({ where: { id } });
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createLibrarianCode,
  listUsers,
  getUser,
  updateUser,
  setUserPassword,
  deleteUser
};
