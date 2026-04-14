// @ts-nocheck
export function validateBook(payload) {
  const errors = [];
  if (!payload.title || payload.title.trim().length < 2) errors.push("Название: минимум 2 символа");
  if (!payload.author || payload.author.trim().length < 2) errors.push("Автор: минимум 2 символа");
  if (!/^[0-9X-]{10,17}$/.test(payload.isbn || "")) errors.push("ISBN: формат 10-17 символов");
  if (!Number.isInteger(payload.year) || payload.year < 1800 || payload.year > new Date().getFullYear()) {
    errors.push("Год: некорректное значение");
  }
  if (!payload.genre || payload.genre.trim().length < 2) errors.push("Жанр: минимум 2 символа");
  if (!Number.isInteger(payload.inStock) || payload.inStock < 0 || payload.inStock > 999) {
    errors.push("Количество: от 0 до 999");
  }
  if (payload.coverUrl && !/^https?:\/\//.test(payload.coverUrl) && !/^data:image\/[a-zA-Z+]+;base64,/.test(payload.coverUrl)) {
    errors.push("Обложка: нужна ссылка https://... или загруженный файл");
  }
  return errors;
}

export function validateLogin(payload) {
  if (!String(payload.email || "").includes("@")) return "Введите корректный email";
  if (String(payload.password || "").length < 8) return "Пароль минимум 8 символов";
  return "";
}

export function validateRegister(payload) {
  if (String(payload.fullName || "").trim().length < 3) return "ФИО слишком короткое";
  if (!String(payload.email || "").includes("@")) return "Введите корректный email";
  if (String(payload.password || "").length < 8) return "Пароль минимум 8 символов";
  return "";
}
