const { z } = require("zod");

const registerSchema = z
  .object({
    fullName: z.string().trim().min(3).max(120),
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(8).max(64),
    role: z.enum(["LIBRARIAN", "READER"]).default("READER"),
    librarianCode: z.string().trim().optional()
  })
  .superRefine((data, ctx) => {
    if (data.role === "LIBRARIAN") {
      const digits = String(data.librarianCode || "").replace(/\D/g, "");
      if (!/^\d{10}$/.test(digits)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Нужен код из 10 цифр, выданный администратором",
          path: ["librarianCode"]
        });
      }
    }
  });

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(64)
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(8).max(64),
  newPassword: z.string().min(8).max(64)
});

module.exports = {
  registerSchema,
  loginSchema,
  changePasswordSchema
};
