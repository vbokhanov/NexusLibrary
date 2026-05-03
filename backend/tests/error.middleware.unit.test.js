"use strict";

const express = require("express");
const request = require("supertest");
const { z } = require("zod");
const errorHandler = require("../src/middleware/error.middleware");

describe("error.middleware", () => {
  function appWithThrow(err) {
    const app = express();
    app.get("/z", (req, res, next) => next(err));
    app.get("/e", (req, res, next) => next(new Error("boom")));
    app.use(errorHandler);
    return app;
  }

  it("ZodError → 400 Validation error", async () => {
    const err = z.object({ x: z.string() }).safeParse({ x: 1 }).error;
    const app = appWithThrow(err);
    const res = await request(app).get("/z");
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
    expect(Array.isArray(res.body.details)).toBe(true);
  });

  it("прочая ошибка → 500", async () => {
    const app = appWithThrow(new Error("boom"));
    const res = await request(app).get("/e");
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Internal server error");
  });
});
