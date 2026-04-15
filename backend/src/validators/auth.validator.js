const { z } = require("zod");

const registerSchema = z.object({
  fullName: z.string().trim().min(3).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(64),
  role: z.enum(["ADMIN", "LIBRARIAN", "READER"]).optional()
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(64)
});

module.exports = {
  registerSchema,
  loginSchema
};
