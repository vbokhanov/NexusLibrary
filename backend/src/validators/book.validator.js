const { z } = require("zod");

const coverRefine = (value) =>
  value === "" || value === undefined || /^https?:\/\//.test(value) || /^data:image\/[a-zA-Z+]+;base64,/.test(value);

const catalogBookSchema = z.object({
  title: z.string().min(1).max(180),
  author: z.string().min(2).max(120),
  isbn: z.string().regex(/^[0-9X-]{10,17}$/),
  year: z.number().int().min(1800).max(new Date().getFullYear()),
  genre: z.string().min(2).max(60),
  coverUrl: z
    .string()
    .refine(coverRefine, "Cover must be URL or image data URI")
    .optional(),
  description: z.string().max(1000).optional(),
  inStock: z.number().int().min(0).max(999).default(1),
  textUrl: z.union([z.string().url(), z.literal("")]).optional(),
  contentText: z.string().max(250000).optional()
});

const personalBookSchema = z.object({
  title: z.string().min(1).max(180),
  author: z.string().min(2).max(120),
  year: z.number().int().min(1800).max(new Date().getFullYear()),
  genre: z.string().min(2).max(60),
  coverUrl: z
    .string()
    .refine(coverRefine, "Cover must be URL or image data URI")
    .optional(),
  description: z.string().max(1000).optional(),
  textUrl: z.union([z.string().url(), z.literal("")]).optional(),
  contentText: z.string().max(250000).optional()
});

module.exports = {
  catalogBookSchema,
  personalBookSchema,
  /** @deprecated use catalogBookSchema */
  bookSchema: catalogBookSchema
};
