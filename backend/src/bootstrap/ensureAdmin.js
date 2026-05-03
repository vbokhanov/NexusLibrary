const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");

/** Фиксированный служебный администратор (id = 1). Логин/пароль для входа в систему. */
const BOOTSTRAP_ADMIN_EMAIL = "admin@nexus.local";
const BOOTSTRAP_ADMIN_PASSWORD = "NexusAdmin2026!";

async function ensureBootstrapAdmin() {
  const passwordHash = await bcrypt.hash(BOOTSTRAP_ADMIN_PASSWORD, 10);
  await prisma.$executeRaw`
    INSERT INTO "User" (id, "fullName", email, "passwordHash", role, banned, "createdAt", "updatedAt")
    VALUES (
      1,
      'Администратор Nexus',
      ${BOOTSTRAP_ADMIN_EMAIL},
      ${passwordHash},
      'ADMIN'::"Role",
      false,
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      "fullName" = EXCLUDED."fullName",
      email = EXCLUDED.email,
      "passwordHash" = EXCLUDED."passwordHash",
      role = 'ADMIN'::"Role",
      banned = false,
      "updatedAt" = NOW()
  `;
  if (process.env.NODE_ENV !== "test") {
    // eslint-disable-next-line no-console
    console.log(
      `[bootstrap] Служебный админ: id=1, email=${BOOTSTRAP_ADMIN_EMAIL}, пароль=${BOOTSTRAP_ADMIN_PASSWORD}`
    );
  }
}

module.exports = { ensureBootstrapAdmin, BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD };
