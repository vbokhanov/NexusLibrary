const { Router } = require("express");
const {
  listBooks,
  listGenres,
  getCatalogCount,
  listFavoritesBatch,
  listMyBooks,
  getBookById,
  createCatalogBook,
  createPersonalBook,
  updateBook,
  deleteBook,
  getBookText,
  getBookCover
} = require("../controllers/book.controller");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");

const bookRouter = Router();

bookRouter.get("/meta/genres", listGenres);
bookRouter.get("/meta/count", getCatalogCount);
bookRouter.get("/", listBooks);
bookRouter.get("/favorites/batch", requireAuth, listFavoritesBatch);
bookRouter.get("/mine", requireAuth, listMyBooks);
bookRouter.get("/:id/cover", getBookCover);
bookRouter.get("/:id/text", getBookText);
bookRouter.get("/:id", getBookById);
bookRouter.post("/", requireAuth, requireRole(["ADMIN", "LIBRARIAN"]), createCatalogBook);
bookRouter.post("/personal", requireAuth, createPersonalBook);
bookRouter.patch("/:id", requireAuth, updateBook);
bookRouter.delete("/:id", requireAuth, deleteBook);

module.exports = bookRouter;
