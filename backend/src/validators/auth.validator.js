const { z } = require("zod");

const registerSchema = z.object({
  fullName: z.string().min(3).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(64),
  role: z.enum(["ADMIN", "LIBRARIAN", "READER"]).optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(64)
});

module.exports = {
  registerSchema,
  loginSchema
};
