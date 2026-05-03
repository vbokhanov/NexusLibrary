"use strict";

const { catalogWhereFromQuery, orderByFromSort } = require("../src/utils/catalogBookQuery");

describe("catalogWhereFromQuery", () => {
  it("база: только каталог (ownerUserId null)", () => {
    expect(catalogWhereFromQuery({})).toEqual({ ownerUserId: null });
  });

  it("поиск q добавляет OR по title/author/genre", () => {
    const w = catalogWhereFromQuery({ q: "  war  ", genre: "all" });
    expect(w.ownerUserId).toBeNull();
    expect(w.OR).toHaveLength(3);
  });

  it("genre !== all добавляет фильтр жанра", () => {
    const w = catalogWhereFromQuery({ q: "", genre: "Роман" });
    expect(w.genre).toBe("Роман");
  });
});

describe("orderByFromSort", () => {
  it("newest / по умолчанию — id desc", () => {
    expect(orderByFromSort("newest")).toEqual([{ id: "desc" }]);
    expect(orderByFromSort("")).toEqual([{ id: "desc" }]);
    expect(orderByFromSort("unknown")).toEqual([{ id: "desc" }]);
  });

  it("oldest / title", () => {
    expect(orderByFromSort("oldest")).toEqual([{ year: "asc" }, { id: "asc" }]);
    expect(orderByFromSort("title")).toEqual([{ title: "asc" }, { id: "asc" }]);
  });
});
