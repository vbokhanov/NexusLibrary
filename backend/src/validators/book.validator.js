const { z } = require("zod");

const bookSchema = z.object({
  title: z.string().min(1).max(180),
  author: z.string().min(2).max(120),
  isbn: z.string().regex(/^[0-9X-]{10,17}$/),
  year: z.number().int().min(1800).max(new Date().getFullYear()),
  genre: z.string().min(2).max(60),
  coverUrl: z.string().url().optional().or(z.literal("")),
  description: z.string().max(1000).optional(),
  inStock: z.number().int().min(0).max(999).default(1)
});

module.exports = { bookSchema };
