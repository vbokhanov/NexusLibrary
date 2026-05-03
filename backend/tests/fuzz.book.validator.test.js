"use strict";

const fc = require("fast-check");
const { catalogBookSchema } = require("../src/validators/book.validator");

describe("Fuzz — catalogBookSchema", () => {
  it("случайный JSON редко совпадает с полной валидной книгой", () => {
    fc.assert(
      fc.property(fc.json(), (value) => {
        const r = catalogBookSchema.safeParse(value);
        if (r.success) {
          return (
            typeof r.data.title === "string" &&
            r.data.title.length >= 1 &&
            typeof r.data.isbn === "string" &&
            /^[0-9X-]{10,17}$/.test(r.data.isbn)
          );
        }
        return true;
      }),
      { numRuns: 350 }
    );
  });
});
