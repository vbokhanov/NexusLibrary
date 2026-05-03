"use strict";

const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../src/app");
const prisma = require("../src/config/prisma");
const { signAccessToken } = require("../src/utils/tokens");

describe("API — health", () => {
  it("GET /api/health", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});

describe("API — каталог (мок Prisma)", () => {
  it("GET /api/books — пустой список", async () => {
    const res = await request(app).get("/api/books?take=10&skip=0&sort=newest&q=&genre=all");
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it("GET /api/books — с записями", async () => {
    prisma.book.findMany.mockResolvedValueOnce([
      {
        id: 1,
        title: "Test Book",
        author: "Author",
        isbn: "9780000000001",
        year: 2000,
        genre: "Fiction",
        coverUrl: null,
        description: null,
        inStock: 1,
        ownerUserId: null,
        textUrl: null,
        contentText: "Hello",
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
    prisma.book.count.mockResolvedValueOnce(1);
    const res = await request(app).get("/api/books?take=10&skip=0");
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].title).toBe("Test Book");
    expect(res.body.total).toBe(1);
  });

  it("GET /api/books/meta/count", async () => {
    prisma.book.count.mockResolvedValueOnce(42);
    const res = await request(app).get("/api/books/meta/count");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(42);
  });

  it("GET /api/books/meta/genres", async () => {
    prisma.book.findMany.mockResolvedValueOnce([{ genre: "Роман" }, { genre: "IT" }]);
    const res = await request(app).get("/api/books/meta/genres");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toContain("Роман");
  });

  it("GET /api/books/:id", async () => {
    prisma.book.findUnique.mockResolvedValueOnce({
      id: 5,
      title: "One",
      author: "A",
      isbn: "9785170000000",
      year: 1999,
      genre: "X",
      coverUrl: null,
      description: null,
      inStock: 1,
      ownerUserId: null,
      textUrl: null,
      contentText: "txt",
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const res = await request(app).get("/api/books/5");
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(5);
  });
});

describe("API — auth (мок Prisma)", () => {
  it("POST /api/auth/login — невалидное тело", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "not-email" });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
  });

  it("POST /api/auth/login — пользователь не найден", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@test.local", password: "Password123!" });
    expect(res.status).toBe(401);
  });

  it("POST /api/auth/login — успех", async () => {
    const hash = await bcrypt.hash("Password123!", 10);
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 1,
      email: "user@test.local",
      passwordHash: hash,
      role: "READER",
      banned: false,
      fullName: "User"
    });
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "user@test.local", password: "Password123!" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.role).toBe("READER");
  });

  it("POST /api/auth/register — невалидное тело", async () => {
    const res = await request(app).post("/api/auth/register").send({ fullName: "ab" });
    expect(res.status).toBe(400);
  });
});

describe("API — защищённые маршруты", () => {
  it("GET /api/books/mine без токена — 401", async () => {
    const res = await request(app).get("/api/books/mine");
    expect(res.status).toBe(401);
  });

  it("GET /api/users без токена — 401", async () => {
    const res = await request(app).get("/api/users?page=1&limit=12");
    expect(res.status).toBe(401);
  });

  it("GET /api/users с токеном читателя — 403", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 2,
      email: "r@test.local",
      role: "READER",
      fullName: "R",
      banned: false
    });
    const token = signAccessToken({ id: 2, email: "r@test.local", role: "READER" });
    const res = await request(app).get("/api/users?page=1&limit=12").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("GET /api/users с токеном админа — 200", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 1,
      email: "admin@test.local",
      role: "ADMIN",
      fullName: "Admin",
      banned: false
    });
    prisma.user.findMany.mockResolvedValueOnce([
      { id: 1, fullName: "Admin", email: "admin@test.local", role: "ADMIN", banned: false, createdAt: new Date() }
    ]);
    prisma.user.count.mockResolvedValueOnce(1);
    const token = signAccessToken({ id: 1, email: "admin@test.local", role: "ADMIN" });
    const res = await request(app).get("/api/users?page=1&limit=12").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
  });

  it("POST /api/books без токена — 401", async () => {
    const res = await request(app).post("/api/books").send({ title: "X" });
    expect(res.status).toBe(401);
  });
});
