const dotenv = require("dotenv");

dotenv.config();

const defaultCors = "http://localhost:5173,http://localhost,http://127.0.0.1,http://127.0.0.1:5173";

module.exports = {
  port: Number(process.env.PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
  databaseUrl: process.env.DATABASE_URL || "",
  corsOrigins: (process.env.CORS_ORIGIN || defaultCors)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
};
