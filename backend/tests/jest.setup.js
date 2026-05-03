"use strict";

jest.mock("../src/config/prisma", () => require("./mocks/prisma"));

const prisma = require("./mocks/prisma");

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

beforeEach(() => {
  jest.clearAllMocks();
  prisma.book.findMany.mockResolvedValue([]);
  prisma.book.count.mockResolvedValue(0);
  prisma.user.findUnique.mockResolvedValue(null);
  prisma.user.findFirst.mockResolvedValue(null);
  prisma.user.findMany.mockResolvedValue([]);
  prisma.user.count.mockResolvedValue(0);
  prisma.user.create.mockResolvedValue({
    id: 3,
    fullName: "Reader",
    email: "reader@test.local",
    role: "READER"
  });
  prisma.user.update.mockResolvedValue({});
  prisma.user.delete.mockResolvedValue({});
  prisma.book.findUnique.mockResolvedValue(null);
  prisma.book.findFirst.mockResolvedValue(null);
  prisma.book.create.mockResolvedValue({
    id: 10,
    title: "T",
    author: "A",
    isbn: "9780000000001",
    year: 2000,
    genre: "Test",
    ownerUserId: null
  });
  prisma.book.update.mockResolvedValue({});
  prisma.book.delete.mockResolvedValue({});
  prisma.librarianInviteCode.findFirst.mockResolvedValue(null);
  prisma.librarianInviteCode.deleteMany.mockResolvedValue({ count: 0 });
  prisma.librarianInviteCode.create.mockImplementation(({ data }) =>
    Promise.resolve({ id: 502, code: data.code, createdById: data.createdById })
  );
  prisma.$transaction.mockImplementation(defaultTransactionImpl);
  prisma.$executeRaw.mockResolvedValue(undefined);
});
