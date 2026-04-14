const { Router } = require("express");
const {
  listBooks,
  createBook,
  updateBook,
  deleteBook
} = require("../controllers/book.controller");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");

const bookRouter = Router();

bookRouter.get("/", listBooks);
bookRouter.post("/", requireAuth, requireRole(["ADMIN", "LIBRARIAN"]), createBook);
bookRouter.patch("/:id", requireAuth, requireRole(["ADMIN", "LIBRARIAN"]), updateBook);
bookRouter.delete("/:id", requireAuth, requireRole(["ADMIN"]), deleteBook);

module.exports = bookRouter;
