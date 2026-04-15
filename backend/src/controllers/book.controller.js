const prisma = require("../config/prisma");
const { catalogBookSchema, personalBookSchema } = require("../validators/book.validator");

const MAX_TEXT_FETCH_BYTES = 4 * 1024 * 1024;

function catalogWhereFromQuery(req) {
  const q = String(req.query.q || "").trim();
  const genre = String(req.query.genre || "").trim();
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
  if (sort === "oldest") return [{ year: "asc" }, { id: "asc" }];
  if (sort === "title") return [{ title: "asc" }, { id: "asc" }];
  return [{ id: "desc" }];
}

async function listBooks(req, res, next) {
  try {
    const where = catalogWhereFromQuery(req);
    const sort = String(req.query.sort || "newest");
    const take = Math.min(60, Math.max(1, Number(req.query.take) || 24));
    const skip = Math.max(0, Number(req.query.skip) || 0);

    const [items, total] = await Promise.all([
      prisma.book.findMany({
        where,
        orderBy: orderByFromSort(sort),
        skip,
        take
      }),
      prisma.book.count({ where })
    ]);

    return res.json({
      items,
      total,
      skip,
      take,
      hasMore: skip + items.length < total
    });
  } catch (error) {
    return next(error);
  }
}

async function listGenres(req, res, next) {
  try {
    const rows = await prisma.book.findMany({
      where: { ownerUserId: null },
      select: { genre: true },
      distinct: ["genre"],
      orderBy: { genre: "asc" }
    });
    return res.json(rows.map((r) => r.genre).filter(Boolean));
  } catch (error) {
    return next(error);
  }
}

async function listFavoritesBatch(req, res, next) {
  try {
    const raw = String(req.query.ids || "");
    const ids = raw
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0)
      .slice(0, 200);
    if (!ids.length) return res.json([]);
    const books = await prisma.book.findMany({ where: { id: { in: ids } } });
    const order = new Map(ids.map((id, i) => [id, i]));
    books.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    return res.json(books);
  } catch (error) {
    return next(error);
  }
}

async function listMyBooks(req, res, next) {
  try {
    const userId = req.user.id;
    const books = await prisma.book.findMany({
      where: { ownerUserId: userId },
      orderBy: { id: "desc" }
    });
    return res.json(books);
  } catch (error) {
    return next(error);
  }
}

async function getBookById(req, res, next) {
  try {
    const id = Number(req.params.id);
    const book = await prisma.book.findUnique({ where: { id } });
    if (!book) return res.status(404).json({ message: "Book not found" });
    return res.json(book);
  } catch (error) {
    return next(error);
  }
}

async function createCatalogBook(req, res, next) {
  try {
    const input = catalogBookSchema.parse(req.body);
    const data = { ...input, ownerUserId: null };
    if (data.coverUrl === "") delete data.coverUrl;
    if (data.textUrl === "") delete data.textUrl;
    if (data.contentText === "") delete data.contentText;
    const book = await prisma.book.create({ data });
    return res.status(201).json(book);
  } catch (error) {
    return next(error);
  }
}

async function createPersonalBook(req, res, next) {
  try {
    const input = personalBookSchema.parse(req.body);
    const userId = req.user.id;
    const isbn = `LN-${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const data = {
      ...input,
      isbn,
      ownerUserId: userId,
      inStock: 1
    };
    if (data.coverUrl === "") delete data.coverUrl;
    if (data.textUrl === "") delete data.textUrl;
    if (data.contentText === "") delete data.contentText;
    const book = await prisma.book.create({ data });
    return res.status(201).json(book);
  } catch (error) {
    return next(error);
  }
}

function canEditCatalog(user) {
  return user && ["ADMIN", "LIBRARIAN"].includes(user.role);
}

function canDeleteCatalog(user) {
  return user && ["ADMIN", "LIBRARIAN"].includes(user.role);
}

async function updateBook(req, res, next) {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.book.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "Book not found" });

    const user = req.user;
    const isOwner = existing.ownerUserId != null && existing.ownerUserId === user.id;
    const isCatalog = existing.ownerUserId == null;
    if (isCatalog && !canEditCatalog(user)) {
      return res.status(403).json({ message: "Insufficient role level" });
    }
    if (!isCatalog && !isOwner) {
      return res.status(403).json({ message: "You can only edit your own books" });
    }

    const input = (isCatalog ? catalogBookSchema : personalBookSchema).partial().parse(req.body);
    const data = { ...input };
    if (data.coverUrl === "") data.coverUrl = null;
    if (data.textUrl === "") data.textUrl = null;
    if (data.contentText === "") data.contentText = null;

    const book = await prisma.book.update({
      where: { id },
      data
    });

    return res.json(book);
  } catch (error) {
    return next(error);
  }
}

async function deleteBook(req, res, next) {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.book.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "Book not found" });

    const user = req.user;
    const isOwner = existing.ownerUserId != null && existing.ownerUserId === user.id;
    const isCatalog = existing.ownerUserId == null;
    if (isCatalog && !canDeleteCatalog(user)) {
      return res.status(403).json({ message: "Insufficient role level" });
    }
    if (!isCatalog && !isOwner) {
      return res.status(403).json({ message: "You can only delete your own books" });
    }

    await prisma.book.delete({ where: { id } });
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

async function getBookText(req, res, next) {
  try {
    const id = Number(req.params.id);
    const book = await prisma.book.findUnique({ where: { id } });
    if (!book) return res.status(404).json({ message: "Book not found" });

    let text = "";
    if (book.contentText && book.contentText.length) {
      text = book.contentText;
    } else if (book.textUrl) {
      const response = await fetch(book.textUrl, {
        headers: { "User-Agent": "LibraryNexusReader/1.0 (edu project)" },
        redirect: "follow"
      });
      if (!response.ok) return res.status(502).json({ message: "Failed to fetch book text" });
      const buf = Buffer.from(await response.arrayBuffer());
      if (buf.length > MAX_TEXT_FETCH_BYTES) {
        return res.status(413).json({ message: "Book text is too large" });
      }
      text = buf.toString("utf8");
    } else {
      return res.status(404).json({ message: "No text available for this book" });
    }

    const filename = `${String(book.title).replace(/[^\wа-яА-ЯёЁ0-9-]+/gi, "_").slice(0, 80) || "book"}.txt`;
    if (String(req.query.download || "") === "1") {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    } else {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
    }
    return res.send(text);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listBooks,
  listGenres,
  listFavoritesBatch,
  listMyBooks,
  getBookById,
  createCatalogBook,
  createPersonalBook,
  updateBook,
  deleteBook,
  getBookText
};
