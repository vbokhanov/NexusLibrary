"use strict";

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const prisma = require("../src/config/prisma");
const { requireAuth, requireRole } = require("../src/middleware/auth.middleware");
const { jwtSecret } = require("../src/config/env");

describe("middleware requireAuth", () => {
  function miniApp() {
    const app = express();
    app.get("/p", requireAuth, (req, res) => res.json({ id: req.user.id }));
    return app;
  }

  it("без заголовка — 401", async () => {
    const res = await request(miniApp()).get("/p");
    expect(res.status).toBe(401);
  });

  it("не Bearer — 401", async () => {
    const res = await request(miniApp()).get("/p").set("Authorization", "Basic x");
    expect(res.status).toBe(401);
  });

  it("битый JWT — 401", async () => {
    const res = await request(miniApp()).get("/p").set("Authorization", "Bearer not-a-jwt");
    expect(res.status).toBe(401);
  });

  it("JWT с нецелым id — 401", async () => {
    const token = jwt.sign({ id: 1.2, email: "a@b.co", role: "READER" }, jwtSecret, { expiresIn: "1h" });
    const res = await request(miniApp()).get("/p").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it("пользователь не найден — 401", async () => {
    const token = jwt.sign({ id: 999, email: "a@b.co", role: "READER" }, jwtSecret, { expiresIn: "1h" });
    prisma.user.findUnique.mockResolvedValueOnce(null);
    const res = await request(miniApp()).get("/p").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it("заблокирован — 403", async () => {
    const token = jwt.sign({ id: 2, email: "b@b.co", role: "READER" }, jwtSecret, { expiresIn: "1h" });
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 2,
      email: "b@b.co",
      role: "READER",
      fullName: "B",
      banned: true
    });
    const res = await request(miniApp()).get("/p").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("успех — 200 и req.user", async () => {
    const token = jwt.sign({ id: 3, email: "c@b.co", role: "READER" }, jwtSecret, { expiresIn: "1h" });
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 3,
      email: "c@b.co",
      role: "READER",
      fullName: "C",
      banned: false
    });
    const res = await request(miniApp()).get("/p").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(3);
  });
});

describe("requireRole", () => {
  it("403 если роль не из списка", () => {
    const req = { user: { role: "READER" } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    requireRole(["ADMIN"])(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("next если роль подходит", () => {
    const req = { user: { role: "LIBRARIAN" } };
    const res = { status: jest.fn() };
    const next = jest.fn();
    requireRole(["ADMIN", "LIBRARIAN"])(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
