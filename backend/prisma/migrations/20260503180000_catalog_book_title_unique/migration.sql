-- Уникальное название только для опубликованных книг (каталог: ownerUserId IS NULL).
CREATE UNIQUE INDEX "Book_catalog_title_normalized_unique" ON "Book" (lower(btrim(title)))
WHERE "ownerUserId" IS NULL;
