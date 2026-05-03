import { describe, it, expect } from "vitest";
import { validateBook, validatePersonalBook, validateLogin, validateRegister, validateChangePassword } from "./validators";

const bookOk = {
  title: "Книга",
  author: "Автор",
  isbn: "9785446110848",
  year: 2011,
  genre: "IT",
  coverUrl: "",
  contentText: ""
};

describe("validateBook (каталог)", () => {
  it("валидное тело", () => {
    expect(validateBook(bookOk)).toHaveLength(0);
  });

  it("обложка https и data URI", () => {
    expect(validateBook({ ...bookOk, coverUrl: "https://x/c.png" })).toHaveLength(0);
    expect(validateBook({ ...bookOk, coverUrl: "data:image/png;base64,QQ==" })).toHaveLength(0);
  });

  it("обложка мусор", () => {
    const err = validateBook({ ...bookOk, coverUrl: "ftp://x" });
    expect(err.some((e) => e.includes("Обложка"))).toBe(true);
  });

  it("автор короткий / ISBN / год / жанр", () => {
    expect(validateBook({ ...bookOk, author: "A" }).length).toBeGreaterThan(0);
    expect(validateBook({ ...bookOk, isbn: "bad" }).length).toBeGreaterThan(0);
    expect(validateBook({ ...bookOk, year: 400 }).length).toBeGreaterThan(0);
    expect(validateBook({ ...bookOk, genre: "x" }).length).toBeGreaterThan(0);
  });

  it("пустое название", () => {
    const err = validateBook({
      title: " ",
      author: "Au",
      isbn: "9785446110848",
      year: 2011,
      genre: "IT"
    });
    expect(err.some((e) => e.includes("Название"))).toBe(true);
  });

  it("слишком длинный текст", () => {
    const err = validateBook({
      title: "T",
      author: "Au",
      isbn: "9785446110848",
      year: 2011,
      genre: "IT",
      contentText: "x".repeat(3_000_001)
    });
    expect(err.some((e) => e.includes("3 млн"))).toBe(true);
  });
});

describe("validatePersonalBook", () => {
  it("без ISBN", () => {
    const err = validatePersonalBook({
      title: "T",
      author: "Au",
      year: 2020,
      genre: "Essay"
    });
    expect(err).toHaveLength(0);
  });

  it("некорректный textUrl", () => {
    const err = validatePersonalBook({
      title: "T",
      author: "Au",
      year: 2020,
      genre: "Essay",
      textUrl: "not-a-url"
    });
    expect(err.some((e) => e.includes("текст"))).toBe(true);
  });

  it("год и жанр личной книги", () => {
    expect(validatePersonalBook({ title: "T", author: "Au", year: 400, genre: "Essay" }).length).toBeGreaterThan(0);
    expect(validatePersonalBook({ title: "T", author: "Au", year: 2020, genre: "x" }).length).toBeGreaterThan(0);
  });

  it("обложка не URL и не data — ошибка", () => {
    const err = validatePersonalBook({
      title: "T",
      author: "Au",
      year: 2020,
      genre: "Essay",
      coverUrl: "just-plain-wrong"
    });
    expect(err.some((e) => e.includes("Обложка"))).toBe(true);
  });

  it("обложка data URI и длинный текст", () => {
    expect(
      validatePersonalBook({
        title: "T",
        author: "Au",
        year: 2020,
        genre: "Essay",
        coverUrl: "data:image/jpeg;base64,/9j/"
      })
    ).toHaveLength(0);
    expect(
      validatePersonalBook({
        title: "T",
        author: "Au",
        year: 2020,
        genre: "Essay",
        contentText: "x".repeat(3_000_001)
      }).length
    ).toBeGreaterThan(0);
  });
});

describe("validateLogin", () => {
  it("неверный email", () => {
    expect(validateLogin({ email: "bad", password: "12345678" }).length).toBeGreaterThan(0);
  });

  it("успех", () => {
    expect(validateLogin({ email: "a@b.co", password: "12345678" })).toBe("");
  });
});

describe("validateRegister", () => {
  it("LIBRARIAN без 10 цифр", () => {
    const msg = validateRegister({
      fullName: "Иван Иванов",
      email: "i@b.co",
      password: "12345678",
      role: "LIBRARIAN",
      librarianCode: "123"
    });
    expect(msg.length).toBeGreaterThan(0);
  });

  it("READER ок и LIBRARIAN с 10 цифр", () => {
    expect(
      validateRegister({
        fullName: "Иван Иванов",
        email: "r2@b.co",
        password: "12345678",
        role: "READER"
      })
    ).toBe("");
    expect(
      validateRegister({
        fullName: "Иван Иванов",
        email: "l2@b.co",
        password: "12345678",
        role: "LIBRARIAN",
        librarianCode: "123 456 7890"
      })
    ).toBe("");
  });

  it("короткое ФИО / email / пароль", () => {
    expect(validateRegister({ fullName: "ab", email: "a@b.co", password: "12345678" }).length).toBeGreaterThan(0);
    expect(validateRegister({ fullName: "Иван", email: "bad", password: "12345678" }).length).toBeGreaterThan(0);
    expect(validateRegister({ fullName: "Иван", email: "a@b.co", password: "short" }).length).toBeGreaterThan(0);
  });
});

describe("validateChangePassword", () => {
  it("несовпадение новых", () => {
    expect(
      validateChangePassword({
        currentPassword: "12345678",
        newPassword: "87654321",
        newPassword2: "87654320"
      }).length
    ).toBeGreaterThan(0);
  });

  it("короткие пароли и успех", () => {
    expect(validateChangePassword({ currentPassword: "short", newPassword: "12345678", newPassword2: "12345678" }).length).toBeGreaterThan(0);
    expect(validateChangePassword({ currentPassword: "12345678", newPassword: "short", newPassword2: "short" }).length).toBeGreaterThan(0);
    expect(
      validateChangePassword({
        currentPassword: "12345678",
        newPassword: "87654321",
        newPassword2: "87654321"
      })
    ).toBe("");
  });
});
