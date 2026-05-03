"use strict";

/**
 * Ручной мок Prisma для Jest: API-тесты без PostgreSQL.
 * Дефолты сбрасываются в tests/jest.setup.js (beforeEach).
 */
const prisma = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  },
  book: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createMany: jest.fn()
  },
  librarianInviteCode: {
    findFirst: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
    create: jest.fn()
  },
  $transaction: jest.fn(),
  $executeRaw: jest.fn().mockResolvedValue(undefined)
};

function defaultTransactionImpl(fn) {
  const tx = {
    librarianInviteCode: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: 501,
          code: data.code,
          createdById: data.createdById
        })
      ),
      update: jest.fn().mockResolvedValue({})
    },
    user: {
      create: jest.fn().mockResolvedValue({
        id: 99,
        fullName: "Lib User",
        email: "lib@test.local",
        role: "LIBRARIAN"
      })
    }
  };
  return fn(tx);
}

prisma.$transaction.mockImplementation(defaultTransactionImpl);

module.exports = prisma;
