const request = require("supertest");
const app = require("../src/app");

describe("Auth API", () => {
  it("returns 400 for invalid login shape", async () => {
    const response = await request(app).post("/api/auth/login").send({ email: "bad" });
    expect(response.status).toBe(400);
  });
});
