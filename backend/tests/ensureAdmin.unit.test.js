"use strict";

const prisma = require("../src/config/prisma");
const { ensureBootstrapAdmin } = require("../src/bootstrap/ensureAdmin");

describe("ensureBootstrapAdmin", () => {
  it("вызывает $executeRaw", async () => {
    prisma.$executeRaw.mockClear();
    await ensureBootstrapAdmin();
    expect(prisma.$executeRaw).toHaveBeenCalled();
  });

  it("пробрасывает ошибку Prisma", async () => {
    prisma.$executeRaw.mockRejectedValueOnce(new Error("db down"));
    await expect(ensureBootstrapAdmin()).rejects.toThrow("db down");
  });
});
