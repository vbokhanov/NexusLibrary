function errorHandler(err, req, res, next) {
  if (err?.name === "ZodError") {
    return res.status(400).json({
      message: "Validation error",
      details: err.issues
    });
  }

  if (process.env.NODE_ENV !== "test") {
    console.error(err);
  }
  return res.status(500).json({ message: "Internal server error" });
}

module.exports = errorHandler;
