"use strict";

/**
 * Построение Prisma-where для списка книг общего каталога и сортировка по query.
 * Вынесено для unit-тестов без HTTP.
 */
function catalogWhereFromQuery(query) {
  const q = String((query && query.q) || "").trim();
  const genre = String((query && query.genre) || "").trim();
  const base = { ownerUserId: null };
  const search = q
    ? {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { author: { contains: q, mode: "insensitive" } },
          { genre: { contains: q, mode: "insensitive" } }
        ]
      }
    : {};
  const genreFilter = genre && genre !== "all" ? { genre } : {};
  return { ...base, ...search, ...genreFilter };
}

function orderByFromSort(sort) {
  const s = String(sort || "newest");
  if (s === "oldest") return [{ year: "asc" }, { id: "asc" }];
  if (s === "title") return [{ title: "asc" }, { id: "asc" }];
  return [{ id: "desc" }];
}

module.exports = { catalogWhereFromQuery, orderByFromSort };
