import { describe, it, expect, beforeEach } from "vitest";
import { bookHasReadableText, buildBookCard, notify } from "./render";
import { state } from "../core/state";

describe("bookHasReadableText", () => {
  it("contentText или textUrl", () => {
    expect(bookHasReadableText({ contentText: "a" })).toBe(true);
    expect(bookHasReadableText({ textUrl: "https://x" })).toBe(true);
    expect(bookHasReadableText({ contentText: "   ", textUrl: "" })).toBe(false);
  });
});

describe("buildBookCard", () => {
  beforeEach(() => {
    state.token = "tok";
    state.favorites = [];
  });

  it("каталог: кнопки для библиотекаря", () => {
    state.role = "LIBRARIAN";
    const html = buildBookCard(
      {
        id: 1,
        title: "T",
        author: "Author Name",
        genre: "G",
        isbn: "9785446110848",
        year: 2000,
        ownerUserId: null,
        contentText: "x",
        coverUrl: "https://example.com/cover.png"
      },
      "catalog"
    );
    expect(html).toContain("Редактировать");
    expect(html).toContain("book-cover");
  });

  it("личная полка: свои действия", () => {
    state.role = "READER";
    const html = buildBookCard(
      {
        id: 2,
        title: "Mine",
        author: "Me",
        genre: "Memo",
        isbn: "LN-1",
        year: 2020,
        ownerUserId: 5,
        textUrl: "https://t"
      },
      "mine"
    );
    expect(html).toContain("edit-mine");
  });
});

describe("notify", () => {
  it("создаёт toast в DOM", () => {
    document.body.innerHTML = "";
    notify("Hello", "info");
    const host = document.querySelector("#toastHost");
    expect(host).toBeTruthy();
    expect(host?.textContent).toContain("Hello");
  });
});
