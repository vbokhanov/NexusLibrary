"use strict";

const fc = require("fast-check");
const { registerSchema } = require("../src/validators/auth.validator");

describe("Fuzz — registerSchema", () => {
  it("случайные объекты не проходят, если нет валидной пары fullName+email+password", () => {
    fc.assert(
      fc.property(fc.json(), (value) => {
        const r = registerSchema.safeParse(value);
        if (
          typeof value === "object" &&
          value &&
          typeof value.fullName === "string" &&
          value.fullName.trim().length >= 3 &&
          typeof value.email === "string" &&
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email.trim()) &&
          typeof value.password === "string" &&
          value.password.length >= 8 &&
          (value.role === undefined || value.role === "READER" || value.role === "LIBRARIAN")
        ) {
          if (value.role === "LIBRARIAN") {
            const d = String(value.librarianCode || "").replace(/\D/g, "");
            if (d.length !== 10) return !r.success;
          }
          return true;
        }
        return !r.success;
      }),
      { numRuns: 300 }
    );
  });
});
