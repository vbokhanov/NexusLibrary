"use strict";

const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../src/app");
const prisma = require("../src/config/prisma");
const { signAccessToken } = require("../src/utils/tokens");

const adminUser = { id: 2, email: "secadmin@test.local", role: "ADMIN", fullName: "Admin2", banned: false };
const readerUser = { id: 5, email: "reader@test.local", role: "READER", fullName: "Reader", banned: false };
const libUser = { id: 8, email: "lib@test.local", role: "LIBRARIAN", fullName: "Lib", banned: false };

const catalogBody = {
  title: "Coverage Unique Title",
  author: "Author Long",
  isbn: "9785446110848",
  year: 2011,
  genre: "Fiction",
  inStock: 1
};

const catalogBookRow = {
  id: 1,
  title: "Coverage Unique Title",
  author: "Author Long",
  isbn: "9785446110848",
  year: 2011,
  genre: "Fiction",
  ownerUserId: null,
  inStock: 1,
  coverUrl: null,
  description: null,
  textUrl: null,
  contentText: null,
  createdAt: new Date(),
  updatedAt: new Date()
};

function tokenFor(u) {
  return signAccessToken({ id: u.id, email: u.email, role: u.role });
}

describe("API coverage — каталог query/sort", () => {
  it("listBooks — ошибка Prisma → 500", async () => {
    prisma.book.findMany.mockRejectedValueOnce(new Error("db fail"));
    const res = await request(app).get("/api/books?take=5&skip=0");
    expect(res.status).toBe(500);
  });

  it("sort=oldest и sort=title пробрасываются в orderBy", async () => {
    await request(app).get("/api/books?take=5&skip=0&sort=oldest");
    expect(prisma.book.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ year: "asc" }, { id: "asc" }] })
    );
    await request(app).get("/api/books?take=5&skip=0&sort=title");
    expect(prisma.book.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ title: "asc" }, { id: "asc" }] })
    );
  });

  it("q и genre добавляют условия", async () => {
    await request(app).get("/api/books?take=5&q=war&genre=IT");
    const arg = prisma.book.findMany.mock.calls.pop()[0];
    expect(arg.where.OR).toBeDefined();
    expect(arg.where.genre).toBe("IT");
  });

  it("hasMore при total > skip+len", async () => {
    prisma.book.findMany.mockResolvedValueOnce([{ id: 1 }]);
    prisma.book.count.mockResolvedValueOnce(100);
    const res = await request(app).get("/api/books?take=1&skip=0");
    expect(res.status).toBe(200);
    expect(res.body.hasMore).toBe(true);
  });
});

describe("API coverage — favorites / mine", () => {
  it("GET /favorites/batch без ids — []", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(readerUser);
    const res = await request(app)
      .get("/api/books/favorites/batch?ids=")
      .set("Authorization", `Bearer ${tokenFor(readerUser)}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("GET /favorites/batch с ids — порядок", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(readerUser);
    prisma.book.findMany.mockResolvedValueOnce([
      { id: 2, title: "B" },
      { id: 1, title: "A" }
    ]);
    const res = await request(app)
      .get("/api/books/favorites/batch?ids=1,2")
      .set("Authorization", `Bearer ${tokenFor(readerUser)}`);
    expect(res.status).toBe(200);
    expect(res.body.map((b) => b.id)).toEqual([1, 2]);
  });

  it("GET /books/mine", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(readerUser);
    prisma.book.findMany.mockResolvedValueOnce([{ id: 9, ownerUserId: 5, title: "Mine" }]);
    const res = await request(app).get("/api/books/mine").set("Authorization", `Bearer ${tokenFor(readerUser)}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe("API coverage — auth register/login/change-password", () => {
  it("POST /auth/register READER 201", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    const res = await request(app).post("/api/auth/register").send({
      fullName: "Новый Читатель",
      email: "newreader@test.local",
      password: "Password12!",
      role: "READER"
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
  });

  it("POST /auth/register — email занят 409", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ id: 1, email: "x@test.local" });
    const res = await request(app).post("/api/auth/register").send({
      fullName: "Иван Иванов",
      email: "x@test.local",
      password: "Password12!",
      role: "READER"
    });
    expect(res.status).toBe(409);
  });

  it("POST /auth/register LIBRARIAN — неверный код 403", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    prisma.librarianInviteCode.findFirst.mockResolvedValueOnce(null);
    const res = await request(app).post("/api/auth/register").send({
      fullName: "Либ Иванов",
      email: "newlib@test.local",
      password: "Password12!",
      role: "LIBRARIAN",
      librarianCode: "1234567890"
    });
    expect(res.status).toBe(403);
  });

  it("POST /auth/register LIBRARIAN — 201", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    prisma.librarianInviteCode.findFirst.mockResolvedValueOnce({ id: 77, code: "1234567890", used: false });
    const res = await request(app).post("/api/auth/register").send({
      fullName: "Либ Иванов",
      email: "newlib2@test.local",
      password: "Password12!",
      role: "LIBRARIAN",
      librarianCode: "1234567890"
    });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("LIBRARIAN");
  });

  it("POST /auth/login — banned 403", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 1,
      email: "b@test.local",
      passwordHash: await bcrypt.hash("Password12!", 4),
      role: "READER",
      banned: true,
      fullName: "B"
    });
    const res = await request(app).post("/api/auth/login").send({ email: "b@test.local", password: "Password12!" });
    expect(res.status).toBe(403);
  });

  it("POST /auth/login — неверный пароль 401", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 1,
      email: "u@test.local",
      passwordHash: await bcrypt.hash("Rightpass12!", 4),
      role: "READER",
      banned: false,
      fullName: "U"
    });
    const res = await request(app).post("/api/auth/login").send({ email: "u@test.local", password: "Wrongpass12!" });
    expect(res.status).toBe(401);
  });

  it("POST /auth/change-password — неверный текущий 400", async () => {
    const h = await bcrypt.hash("Goodcurr12!", 4);
    prisma.user.findUnique
      .mockResolvedValueOnce(readerUser)
      .mockResolvedValueOnce({ id: 5, passwordHash: h, email: "reader@test.local", role: "READER", banned: false });
    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${tokenFor(readerUser)}`)
      .send({ currentPassword: "Badcurr12!", newPassword: "Newpass12!" });
    expect(res.status).toBe(400);
  });

  it("POST /auth/change-password — 200", async () => {
    const h = await bcrypt.hash("Currpass12!", 4);
    prisma.user.findUnique
      .mockResolvedValueOnce(readerUser)
      .mockResolvedValueOnce({ id: 5, passwordHash: h, email: "reader@test.local", role: "READER", banned: false });
    prisma.user.update.mockResolvedValueOnce({});
    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${tokenFor(readerUser)}`)
      .send({ currentPassword: "Currpass12!", newPassword: "Newpass12!" });
    expect(res.status).toBe(200);
  });

  it("POST /auth/change-password — пользователь исчез 404", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(readerUser).mockResolvedValueOnce(null);
    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${tokenFor(readerUser)}`)
      .send({ currentPassword: "Currpass12!", newPassword: "Newpass12!" });
    expect(res.status).toBe(404);
  });
});

describe("API coverage — admin users", () => {
  it("GET /users?q= и пагинация", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(adminUser);
    prisma.user.findMany.mockResolvedValueOnce([]);
    prisma.user.count.mockResolvedValueOnce(0);
    const res = await request(app)
      .get("/api/users?page=2&limit=8&q=test")
      .set("Authorization", `Bearer ${tokenFor(adminUser)}`);
    expect(res.status).toBe(200);
    expect(res.body.page).toBe(2);
    expect(res.body.limit).toBe(8);
  });

  it("GET /users/:id — 400", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(adminUser);
    const res = await request(app).get("/api/users/0").set("Authorization", `Bearer ${tokenFor(adminUser)}`);
    expect(res.status).toBe(400);
  });

  it("GET /users/:id — 404", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(adminUser).mockResolvedValueOnce(null);
    const res = await request(app).get("/api/users/99").set("Authorization", `Bearer ${tokenFor(adminUser)}`);
    expect(res.status).toBe(404);
  });

  it("GET /users/:id — 200", async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(adminUser)
      .mockResolvedValueOnce({
        id: 3,
        fullName: "U",
        email: "u@u.co",
        role: "READER",
        banned: false,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    const res = await request(app).get("/api/users/3").set("Authorization", `Bearer ${tokenFor(adminUser)}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe("u@u.co");
  });

  it("PATCH /users/:id — пустое тело 400", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(adminUser);
    const res = await request(app)
      .patch("/api/users/5")
      .set("Authorization", `Bearer ${tokenFor(adminUser)}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it("PATCH /users/1 — нельзя забанить служебного 403", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(adminUser);
    const res = await request(app)
      .patch("/api/users/1")
      .set("Authorization", `Bearer ${tokenFor(adminUser)}`)
      .send({ banned: true });
    expect(res.status).toBe(403);
  });

  it("PATCH /users/1 — нельзя сменить роль служебного 403", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(adminUser);
    const res = await request(app)
      .patch("/api/users/1")
      .set("Authorization", `Bearer ${tokenFor(adminUser)}`)
      .send({ role: "READER" });
    expect(res.status).toBe(403);
  });

  it("PATCH /users/:id — нельзя забанить себя 403", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(adminUser);
    const res = await request(app)
      .patch("/api/users/2")
      .set("Authorization", `Bearer ${tokenFor(adminUser)}`)
      .send({ banned: true });
    expect(res.status).toBe(403);
  });

  it("PATCH /users/:id — email занят 409", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(adminUser);
    prisma.user.findFirst.mockResolvedValueOnce({ id: 99 });
    const res = await request(app)
      .patch("/api/users/5")
      .set("Authorization", `Bearer ${tokenFor(adminUser)}`)
      .send({ email: "taken@test.local" });
    expect(res.status).toBe(409);
  });

  it("PATCH /users/:id — 200", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(adminUser);
    prisma.user.findFirst.mockResolvedValueOnce(null);
    prisma.user.update.mockResolvedValueOnce({
      id: 5,
      fullName: "New Name",
      email: "reader@test.local",
      role: "READER",
      banned: false,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const res = await request(app)
      .patch("/api/users/5")
      .set("Authorization", `Bearer ${tokenFor(adminUser)}`)
      .send({ fullName: "New Name" });
    expect(res.status).toBe(200);
    expect(res.body.fullName).toBe("New Name");
  });

  it("PATCH /users/:id/password — нельзя себе 403", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(adminUser);
    const res = await request(app)
      .patch("/api/users/2/password")
      .set("Authorization", `Bearer ${tokenFor(adminUser)}`)
      .send({ newPassword: "Newpass12!" });
    expect(res.status).toBe(403);
  });

  it("PATCH /users/:id/password — 200", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(adminUser);
    prisma.user.update.mockResolvedValueOnce({});
    const res = await request(app)
      .patch("/api/users/5/password")
      .set("Authorization", `Bearer ${tokenFor(adminUser)}`)
      .send({ newPassword: "Newpass12!" });
    expect(res.status).toBe(200);
  });

  it("DELETE /users/1 — 403", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(adminUser);
    const res = await request(app).delete("/api/users/1").set("Authorization", `Bearer ${tokenFor(adminUser)}`);
    expect(res.status).toBe(403);
  });

  it("DELETE /users/:id — нельзя себя 403", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(adminUser);
    const res = await request(app).delete("/api/users/2").set("Authorization", `Bearer ${tokenFor(adminUser)}`);
    expect(res.status).toBe(403);
  });

  it("DELETE /users/:id — 204", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(adminUser);
    prisma.user.delete.mockResolvedValueOnce({});
    const res = await request(app).delete("/api/users/55").set("Authorization", `Bearer ${tokenFor(adminUser)}`);
    expect(res.status).toBe(204);
  });

  it("POST /users/librarian-codes — 201", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(adminUser);
    const res = await request(app)
      .post("/api/users/librarian-codes")
      .set("Authorization", `Bearer ${tokenFor(adminUser)}`);
    expect(res.status).toBe(201);
    expect(res.body.code).toBeTruthy();
  });

  it("POST /users/librarian-codes — 500 после коллизий", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(adminUser);
    const err = Object.assign(new Error("dup"), { code: "P2002" });
    prisma.$transaction.mockRejectedValue(err);
    const res = await request(app)
      .post("/api/users/librarian-codes")
      .set("Authorization", `Bearer ${tokenFor(adminUser)}`);
    expect(res.status).toBe(500);
  });

  it("POST /users/librarian-codes — повтор после P2002 и успех", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(adminUser);
    let n = 0;
    prisma.$transaction.mockImplementation(async (fn) => {
      n += 1;
      if (n === 1) throw Object.assign(new Error("dup"), { code: "P2002" });
      const tx = {
        librarianInviteCode: {
          deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
          create: jest.fn().mockImplementation(({ data }) =>
            Promise.resolve({ id: 900, code: data.code, createdById: data.createdById })
          ),
          update: jest.fn().mockResolvedValue({})
        },
        user: {
          create: jest.fn().mockResolvedValue({ id: 1, role: "LIBRARIAN" })
        }
      };
      return fn(tx);
    });
    const res = await request(app)
      .post("/api/users/librarian-codes")
      .set("Authorization", `Bearer ${tokenFor(adminUser)}`);
    expect(res.status).toBe(201);
  });
});

describe("API coverage — books CRUD и роли", () => {
  it("POST /books — READER 403", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(readerUser);
    const res = await request(app)
      .post("/api/books")
      .set("Authorization", `Bearer ${tokenFor(readerUser)}`)
      .send(catalogBody);
    expect(res.status).toBe(403);
  });

  it("POST /books — LIBRARIAN 201", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(libUser);
    prisma.book.findFirst.mockResolvedValueOnce(null);
    prisma.book.create.mockResolvedValueOnce({ ...catalogBookRow, id: 100 });
    const res = await request(app)
      .post("/api/books")
      .set("Authorization", `Bearer ${tokenFor(libUser)}`)
      .send(catalogBody);
    expect(res.status).toBe(201);
  });

  it("POST /books — дубликат названия 409", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(libUser);
    prisma.book.findFirst.mockResolvedValueOnce({ id: 2 });
    const res = await request(app)
      .post("/api/books")
      .set("Authorization", `Bearer ${tokenFor(libUser)}`)
      .send({ ...catalogBody, title: "Dup" });
    expect(res.status).toBe(409);
  });

  it("POST /books — P2002 от Prisma 409", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(libUser);
    prisma.book.findFirst.mockResolvedValueOnce(null);
    prisma.book.create.mockRejectedValueOnce(Object.assign(new Error("uniq"), { code: "P2002" }));
    const res = await request(app)
      .post("/api/books")
      .set("Authorization", `Bearer ${tokenFor(libUser)}`)
      .send({ ...catalogBody, title: "Other Title X" });
    expect(res.status).toBe(409);
  });

  it("POST /books/personal — 201", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(readerUser);
    prisma.book.create.mockResolvedValueOnce({
      id: 200,
      title: "My",
      author: "Me",
      isbn: "LN-5-1-abc",
      year: 2020,
      genre: "Memo",
      ownerUserId: 5
    });
    const res = await request(app)
      .post("/api/books/personal")
      .set("Authorization", `Bearer ${tokenFor(readerUser)}`)
      .send({ title: "My", author: "Me", year: 2020, genre: "Memo" });
    expect(res.status).toBe(201);
  });

  it("POST /books — валидация 400", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(libUser);
    const res = await request(app)
      .post("/api/books")
      .set("Authorization", `Bearer ${tokenFor(libUser)}`)
      .send({ title: "", author: "A", isbn: "bad", year: 100, genre: "x" });
    expect(res.status).toBe(400);
  });

  it("PATCH /books/:id каталог — READER 403", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(readerUser);
    prisma.book.findUnique.mockResolvedValueOnce({ ...catalogBookRow, id: 1 });
    const res = await request(app)
      .patch("/api/books/1")
      .set("Authorization", `Bearer ${tokenFor(readerUser)}`)
      .send({ title: "X" });
    expect(res.status).toBe(403);
  });

  it("PATCH /books/:id чужая личная — 403", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(readerUser);
    prisma.book.findUnique.mockResolvedValueOnce({
      id: 3,
      ownerUserId: 99,
      title: "Other",
      author: "A",
      isbn: "9780000000001",
      year: 2000,
      genre: "T"
    });
    const res = await request(app)
      .patch("/api/books/3")
      .set("Authorization", `Bearer ${tokenFor(readerUser)}`)
      .send({ title: "Hack" });
    expect(res.status).toBe(403);
  });

  it("PATCH /books/:id — 404", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(libUser);
    prisma.book.findUnique.mockResolvedValueOnce(null);
    const res = await request(app)
      .patch("/api/books/999")
      .set("Authorization", `Bearer ${tokenFor(libUser)}`)
      .send({ title: "N" });
    expect(res.status).toBe(404);
  });

  it("PATCH /books/:id каталог — дубликат названия 409", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(libUser);
    prisma.book.findUnique.mockResolvedValueOnce({ ...catalogBookRow, id: 10 });
    prisma.book.findFirst.mockResolvedValueOnce({ id: 11 });
    const res = await request(app)
      .patch("/api/books/10")
      .set("Authorization", `Bearer ${tokenFor(libUser)}`)
      .send({ title: "Taken Title" });
    expect(res.status).toBe(409);
  });

  it("PATCH /books/:id каталог — LIBRARIAN 200", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(libUser);
    prisma.book.findUnique.mockResolvedValueOnce({ ...catalogBookRow, id: 10 });
    prisma.book.findFirst.mockResolvedValueOnce(null);
    prisma.book.update.mockResolvedValueOnce({ ...catalogBookRow, id: 10, title: "Updated" });
    const res = await request(app)
      .patch("/api/books/10")
      .set("Authorization", `Bearer ${tokenFor(libUser)}`)
      .send({ title: "Updated" });
    expect(res.status).toBe(200);
  });

  it("PATCH /books/:id каталог — P2002 → 409", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(libUser);
    prisma.book.findUnique.mockResolvedValueOnce({ ...catalogBookRow, id: 11 });
    prisma.book.findFirst.mockResolvedValueOnce(null);
    prisma.book.update.mockRejectedValueOnce(Object.assign(new Error("uniq"), { code: "P2002" }));
    const res = await request(app)
      .patch("/api/books/11")
      .set("Authorization", `Bearer ${tokenFor(libUser)}`)
      .send({ title: "Another Title Z" });
    expect(res.status).toBe(409);
  });

  it("PATCH /books/:id личная — владелец 200", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(readerUser);
    prisma.book.findUnique.mockResolvedValueOnce({
      id: 20,
      ownerUserId: 5,
      title: "Mine",
      author: "Me",
      isbn: "LN-x",
      year: 2021,
      genre: "X"
    });
    prisma.book.update.mockResolvedValueOnce({ id: 20, title: "Mine2" });
    const res = await request(app)
      .patch("/api/books/20")
      .set("Authorization", `Bearer ${tokenFor(readerUser)}`)
      .send({ title: "Mine2" });
    expect(res.status).toBe(200);
  });

  it("DELETE каталог — READER 403", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(readerUser);
    prisma.book.findUnique.mockResolvedValueOnce({ ...catalogBookRow, id: 1 });
    const res = await request(app).delete("/api/books/1").set("Authorization", `Bearer ${tokenFor(readerUser)}`);
    expect(res.status).toBe(403);
  });

  it("DELETE каталог — LIBRARIAN 204", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(libUser);
    prisma.book.findUnique.mockResolvedValueOnce({ ...catalogBookRow, id: 1 });
    prisma.book.delete.mockResolvedValueOnce({});
    const res = await request(app).delete("/api/books/1").set("Authorization", `Bearer ${tokenFor(libUser)}`);
    expect(res.status).toBe(204);
  });

  it("DELETE личная — владелец 204", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(readerUser);
    prisma.book.findUnique.mockResolvedValueOnce({
      id: 20,
      ownerUserId: 5,
      title: "Mine",
      author: "Me",
      isbn: "LN-x",
      year: 2021,
      genre: "X"
    });
    prisma.book.delete.mockResolvedValueOnce({});
    const res = await request(app).delete("/api/books/20").set("Authorization", `Bearer ${tokenFor(readerUser)}`);
    expect(res.status).toBe(204);
  });
});

describe("API coverage — text / cover (fetch mock)", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("GET /books/:id/text — из contentText", async () => {
    prisma.book.findUnique.mockResolvedValueOnce({
      id: 1,
      title: "T1",
      contentText: "hello body",
      textUrl: null
    });
    const res = await request(app).get("/api/books/1/text");
    expect(res.status).toBe(200);
    expect(res.text).toBe("hello body");
  });

  it("GET /books/:id/text?download=1", async () => {
    prisma.book.findUnique.mockResolvedValueOnce({
      id: 1,
      title: "Book Title",
      contentText: "x",
      textUrl: null
    });
    const res = await request(app).get("/api/books/1/text?download=1");
    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toMatch(/attachment/);
  });

  it("GET /books/:id/text — нет текста 404", async () => {
    prisma.book.findUnique.mockResolvedValueOnce({
      id: 1,
      title: "T",
      contentText: "",
      textUrl: null
    });
    const res = await request(app).get("/api/books/1/text");
    expect(res.status).toBe(404);
  });

  it("GET /books/:id/text — удалённый источник 200 и update", async () => {
    prisma.book.findUnique.mockResolvedValueOnce({
      id: 1,
      title: "Remote",
      contentText: "",
      textUrl: "https://example.com/book.txt"
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array(Buffer.from("fetched text", "utf8")).buffer
    });
    prisma.book.update.mockResolvedValueOnce({});
    const res = await request(app).get("/api/books/1/text");
    expect(res.status).toBe(200);
    expect(res.text).toBe("fetched text");
    expect(prisma.book.update).toHaveBeenCalled();
  });

  it("GET /books/:id/text — fetch не ok 502", async () => {
    prisma.book.findUnique.mockResolvedValueOnce({
      id: 1,
      title: "R",
      contentText: "",
      textUrl: "https://example.com/x"
    });
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, arrayBuffer: async () => new ArrayBuffer(0) });
    const res = await request(app).get("/api/books/1/text");
    expect(res.status).toBe(502);
  });

  it("GET /books/:id/text — слишком большой ответ 413", async () => {
    prisma.book.findUnique.mockResolvedValueOnce({
      id: 1,
      title: "R",
      contentText: "",
      textUrl: "https://example.com/big"
    });
    const huge = Buffer.alloc(5 * 1024 * 1024);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => huge.buffer
    });
    const res = await request(app).get("/api/books/1/text");
    expect(res.status).toBe(413);
  });

  it("GET /books/:id/text — timeout 504", async () => {
    prisma.book.findUnique.mockResolvedValueOnce({
      id: 1,
      title: "R",
      contentText: "",
      textUrl: "https://example.com/slow"
    });
    global.fetch = jest.fn().mockRejectedValue(new Error("aborted"));
    const res = await request(app).get("/api/books/1/text");
    expect(res.status).toBe(504);
  });

  it("GET /books/:id/cover — невалидный id 400", async () => {
    const res = await request(app).get("/api/books/0/cover");
    expect(res.status).toBe(400);
  });

  it("GET /books/:id/cover — нет книги 404", async () => {
    prisma.book.findUnique.mockResolvedValueOnce(null);
    const res = await request(app).get("/api/books/9/cover");
    expect(res.status).toBe(404);
  });

  it("GET /books/:id/cover — data: 404", async () => {
    prisma.book.findUnique.mockResolvedValueOnce({ coverUrl: "data:image/png;base64,xx" });
    const res = await request(app).get("/api/books/1/cover");
    expect(res.status).toBe(404);
  });

  it("GET /books/:id/cover — не http(s) 404", async () => {
    prisma.book.findUnique.mockResolvedValueOnce({ coverUrl: "ftp://x/img" });
    const res = await request(app).get("/api/books/1/cover");
    expect(res.status).toBe(404);
  });

  it("GET /books/:id/cover — успех", async () => {
    prisma.book.findUnique.mockResolvedValueOnce({ coverUrl: "https://example.com/c.png" });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
      headers: { get: (h) => (String(h).toLowerCase() === "content-type" ? "image/png" : null) }
    });
    const res = await request(app).get("/api/books/1/cover");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/png/);
  });

  it("GET /books/:id/cover — upstream 502", async () => {
    prisma.book.findUnique.mockResolvedValueOnce({ coverUrl: "https://example.com/c.png" });
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 });
    const res = await request(app).get("/api/books/1/cover");
    expect(res.status).toBe(502);
  });

  it("GET /books/:id/cover — слишком большой 413", async () => {
    prisma.book.findUnique.mockResolvedValueOnce({ coverUrl: "https://example.com/c.png" });
    const buf = Buffer.alloc(4 * 1024 * 1024);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => buf.buffer,
      headers: { get: () => "image/jpeg" }
    });
    const res = await request(app).get("/api/books/1/cover");
    expect(res.status).toBe(413);
  });

  it("GET /books/:id/cover — не image content-type → jpeg", async () => {
    prisma.book.findUnique.mockResolvedValueOnce({ coverUrl: "https://example.com/c.bin" });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1]).buffer,
      headers: { get: () => "application/octet-stream" }
    });
    const res = await request(app).get("/api/books/1/cover");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("image/jpeg");
  });

  it("GET /books/:id/cover — сеть 504", async () => {
    prisma.book.findUnique.mockResolvedValueOnce({ coverUrl: "https://example.com/c.png" });
    global.fetch = jest.fn().mockRejectedValue(new Error("network"));
    const res = await request(app).get("/api/books/1/cover");
    expect(res.status).toBe(504);
  });
});
