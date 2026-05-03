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
  if (
    payload.coverUrl &&
    !/^https?:\/\//.test(payload.coverUrl) &&
    !/^data:image\/[a-zA-Z+]+;base64,/.test(payload.coverUrl)
  ) {
    errors.push("Обложка: нужна ссылка https://... или загруженный файл");
  }
  if (payload.textUrl && String(payload.textUrl).trim() && !/^https?:\/\//.test(payload.textUrl)) {
    errors.push("Текст: укажите ссылку https://... на .txt или оставьте пустым");
  }
  return errors;
}

export function validatePersonalBook(payload) {
  const errors = [];
  if (!payload.title || payload.title.trim().length < 1) errors.push("Название: минимум 1 символ");
  if (!payload.author || payload.author.trim().length < 2) errors.push("Автор: минимум 2 символа");
  if (!Number.isInteger(payload.year) || payload.year < 500 || payload.year > new Date().getFullYear()) {
    errors.push("Год: от 500 до текущего года");
  }
  if (!payload.genre || payload.genre.trim().length < 2) errors.push("Жанр: минимум 2 символа");
  if (
    payload.coverUrl &&
    !/^https?:\/\//.test(payload.coverUrl) &&
    !/^data:image\/[a-zA-Z+]+;base64,/.test(payload.coverUrl)
  ) {
    errors.push("Обложка: нужна ссылка https://... или загруженный файл");
  }
  if (payload.textUrl && String(payload.textUrl).trim() && !/^https?:\/\//.test(payload.textUrl)) {
    errors.push("Ссылка на текст: только https://... или пусто");
  }
  if (payload.contentText && String(payload.contentText).length > 250000) errors.push("Текст слишком длинный");
  return errors;
}

export function validateLogin(payload) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(payload.email || "").trim())) return "Введите корректный email";
  if (String(payload.password || "").length < 8) return "Пароль минимум 8 символов";
  return "";
}

export function validateRegister(payload) {
  if (String(payload.fullName || "").trim().length < 3) return "ФИО слишком короткое";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(payload.email || "").trim())) return "Введите корректный email";
  if (String(payload.password || "").length < 8) return "Пароль минимум 8 символов";
  const role = String(payload.role || "READER").toUpperCase();
  if (role === "LIBRARIAN") {
    const digits = String(payload.librarianCode || "").replace(/\D/g, "");
    if (!/^\d{10}$/.test(digits)) return "Введите код из 10 цифр (его выдаёт администратор)";
  }
  return "";
}

export function validateChangePassword(payload) {
  if (String(payload.currentPassword || "").length < 8) return "Текущий пароль: минимум 8 символов";
  if (String(payload.newPassword || "").length < 8) return "Новый пароль: минимум 8 символов";
  if (String(payload.newPassword) !== String(payload.newPassword2 || "")) return "Новые пароли не совпадают";
  return "";
}
