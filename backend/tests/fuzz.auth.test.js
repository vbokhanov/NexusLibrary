const fc = require("fast-check");
const { loginSchema } = require("../src/validators/auth.validator");

describe("Fuzz login validation", () => {
  it("rejects random malformed payloads", () => {
    fc.assert(
      fc.property(fc.anything(), (value) => {
        const result = loginSchema.safeParse(value);
        if (
          typeof value === "object" &&
          value &&
          "email" in value &&
          "password" in value &&
          typeof value.email === "string" &&
          typeof value.password === "string" &&
          value.password.length >= 8 &&
          value.email.includes("@")
        ) {
          return true;
        }
        return !result.success;
      }),
      { numRuns: 400 }
    );
  });
});
