"use strict";

const jwt = require("jsonwebtoken");
const { signAccessToken, verifyAccessToken } = require("../src/utils/tokens");
const { jwtSecret } = require("../src/config/env");

describe("tokens", () => {
  it("sign → verify возвращает payload", () => {
    const token = signAccessToken({ id: 42, email: "u@test.local", role: "READER" });
    const p = verifyAccessToken(token);
    expect(p.id).toBe(42);
    expect(p.email).toBe("u@test.local");
    expect(p.role).toBe("READER");
  });

  it("неверная подпись — verify бросает", () => {
    const bad = jwt.sign({ id: 1 }, "wrong-secret");
    expect(() => verifyAccessToken(bad)).toThrow();
  });

  it("используется тот же секрет, что в env", () => {
    const token = jwt.sign({ id: 1, email: "a@b.co", role: "ADMIN" }, jwtSecret, { expiresIn: "1h" });
    const p = verifyAccessToken(token);
    expect(p.id).toBe(1);
  });
});
