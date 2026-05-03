"use strict";

const fc = require("fast-check");
const { catalogWhereFromQuery, orderByFromSort } = require("../src/utils/catalogBookQuery");

describe("fuzz — catalogWhereFromQuery", () => {
  it("всегда содержит ownerUserId: null", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (q, genre) => {
        const w = catalogWhereFromQuery({ q, genre });
        expect(w.ownerUserId).toBeNull();
      }),
      { numRuns: 80 }
    );
  });

  it("genre all или пусто не добавляет поле genre", () => {
    fc.assert(
      fc.property(fc.string(), (q) => {
        const w1 = catalogWhereFromQuery({ q, genre: "all" });
        const w2 = catalogWhereFromQuery({ q, genre: "" });
        expect(w1.genre).toBeUndefined();
        expect(w2.genre).toBeUndefined();
      }),
      { numRuns: 40 }
    );
  });
});

describe("fuzz — orderByFromSort", () => {
  it("допустимые строки sort дают массив orderBy", () => {
    fc.assert(
      fc.property(fc.string(), (sort) => {
        const ob = orderByFromSort(sort);
        expect(Array.isArray(ob)).toBe(true);
        expect(ob.length).toBeGreaterThanOrEqual(1);
      }),
      { numRuns: 60 }
    );
  });
});
