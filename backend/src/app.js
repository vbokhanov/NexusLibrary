const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { corsOrigin } = require("./config/env");
const authRouter = require("./routes/auth.routes");
const bookRouter = require("./routes/book.routes");
const errorHandler = require("./middleware/error.middleware");

const app = express();

app.use(helmet());
app.use(cors({ origin: corsOrigin }));
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "library-backend" });
});

app.use("/api/auth", authRouter);
app.use("/api/books", bookRouter);
app.use(errorHandler);

module.exports = app;
