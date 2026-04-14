const prisma = require("../config/prisma");
const { bookSchema } = require("../validators/book.validator");

async function listBooks(req, res, next) {
  try {
    const q = String(req.query.q || "").trim();
    const where = q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { author: { contains: q, mode: "insensitive" } },
            { genre: { contains: q, mode: "insensitive" } }
          ]
        }
      : {};

    const books = await prisma.book.findMany({ where, orderBy: { id: "desc" } });
    return res.json(books);
  } catch (error) {
    return next(error);
  }
}

async function createBook(req, res, next) {
  try {
    const input = bookSchema.parse(req.body);
    const book = await prisma.book.create({ data: input });
    return res.status(201).json(book);
  } catch (error) {
    return next(error);
  }
}

async function updateBook(req, res, next) {
  try {
    const id = Number(req.params.id);
    const input = bookSchema.partial().parse(req.body);

    const book = await prisma.book.update({
      where: { id },
      data: input
    });

    return res.json(book);
  } catch (error) {
    return next(error);
  }
}

async function deleteBook(req, res, next) {
  try {
    const id = Number(req.params.id);
    await prisma.book.delete({ where: { id } });
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listBooks,
  createBook,
  updateBook,
  deleteBook
};
