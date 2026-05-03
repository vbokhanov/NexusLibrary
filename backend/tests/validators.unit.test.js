"use strict";

const { loginSchema, registerSchema, changePasswordSchema } = require("../src/validators/auth.validator");
const {
  catalogBookSchema,
  personalBookSchema,
  bookSchema
} = require("../src/validators/book.validator");

describe("Validators — login", () => {
  it("принимает корректные данные", () => {
    const r = loginSchema.safeParse({ email: "A@B.CO", password: "12345678" });
    expect(r.success).toBe(true);
    expect(r.data.email).toBe("a@b.co");
  });

  it("отклоняет короткий пароль", () => {
    const r = loginSchema.safeParse({ email: "a@b.co", password: "short" });
    expect(r.success).toBe(false);
  });
});

describe("Validators — register", () => {
  it("READER без кода", () => {
    const r = registerSchema.safeParse({
      fullName: "Иван Иванов",
      email: "ivan@example.com",
      password: "Password123",
      role: "READER"
    });
    expect(r.success).toBe(true);
  });

  it("LIBRARIAN без 10 цифр — ошибка", () => {
    const r = registerSchema.safeParse({
      fullName: "Иван Иванов",
      email: "ivan@example.com",
      password: "Password123",
      role: "LIBRARIAN",
      librarianCode: "123"
    });
    expect(r.success).toBe(false);
  });
});

describe("Validators — change password", () => {
  it("два поля >= 8", () => {
    const r = changePasswordSchema.safeParse({
      currentPassword: "Oldpass12",
      newPassword: "Newpass12"
    });
    expect(r.success).toBe(true);
  });
});

describe("Validators — catalog book", () => {
  const valid = {
    title: "Title",
    author: "Author Name",
    isbn: "9785446110848",
    year: 2011,
    genre: "IT",
    inStock: 1
  };

  it("минимальный корректный объект", () => {
    const r = catalogBookSchema.safeParse(valid);
    expect(r.success).toBe(true);
    expect(r.data.title).toBe("Title");
  });

  it("title с пробелами — trim", () => {
    const r = catalogBookSchema.safeParse({ ...valid, title: "  X  " });
    expect(r.success).toBe(true);
    expect(r.data.title).toBe("X");
  });

  it("неверный ISBN", () => {
    const r = catalogBookSchema.safeParse({ ...valid, isbn: "bad" });
    expect(r.success).toBe(false);
  });

  it("contentText слишком длинный", () => {
    const r = catalogBookSchema.safeParse({ ...valid, contentText: "x".repeat(3_000_001) });
    expect(r.success).toBe(false);
  });
});

describe("Validators — personal book", () => {
  it("без ISBN в схеме", () => {
    const r = personalBookSchema.safeParse({
      title: "T",
      author: "Au",
      year: 2020,
      genre: "Essay"
    });
    expect(r.success).toBe(true);
  });
});

describe("Validators — catalog coverUrl / bookSchema alias", () => {
  const base = {
    title: "T",
    author: "Au",
    isbn: "9785446110848",
    year: 2010,
    genre: "IT"
  };

  it("data URI обложки", () => {
    const r = catalogBookSchema.safeParse({
      ...base,
      coverUrl: "data:image/png;base64,iVBORw0KGgo="
    });
    expect(r.success).toBe(true);
  });

  it("https обложки", () => {
    const r = catalogBookSchema.safeParse({
      ...base,
      coverUrl: "https://cdn.example/x.png"
    });
    expect(r.success).toBe(true);
  });

  it("bookSchema — алиас на catalogBookSchema", () => {
    expect(bookSchema).toBe(catalogBookSchema);
  });
});
