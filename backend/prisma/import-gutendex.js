const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const UA = { "User-Agent": "LibraryNexusGutendexImport/1.0 (edu project)" };

function mapRecord(rec) {
  const title = String(rec.title || "").trim();
  if (!title) return null;

  const author =
    Array.isArray(rec.authors) && rec.authors[0]?.name ? String(rec.authors[0].name) : "Unknown author";
  const formats = rec.formats || {};
  const textUrl =
    formats["text/plain; charset=utf-8"] ||
    formats["text/plain"] ||
    formats["text/plain; charset=us-ascii"] ||
    null;
  if (!textUrl) return null;

  const coverUrl =
    formats["image/jpeg"] ||
    formats["image/png"] ||
    formats["image/jpeg; charset=binary"] ||
    null;

  const genreRaw =
    Array.isArray(rec.bookshelves) && rec.bookshelves.length
      ? rec.bookshelves[0]
      : Array.isArray(rec.subjects) && rec.subjects.length
        ? rec.subjects[0]
        : "Классика";
  const genre = String(genreRaw).replace(/^Project Gutenberg needs your /i, "Классика").slice(0, 60);

  return {
    title: title.slice(0, 180),
    author: author.slice(0, 120),
    isbn: `GT-${rec.id}`,
    year: 1910,
    genre,
    coverUrl: coverUrl || null,
    description: "Импорт из Project Gutenberg (Gutendex)",
    inStock: 1,
    ownerUserId: null,
    textUrl,
    contentText: null
  };
}

async function importFromGutendex(targetCount) {
  const seen = new Set();
  const buffer = [];
  let url = "https://gutendex.com/books/?page=1";

  while (buffer.length < targetCount && url) {
    const response = await fetch(url, { headers: UA });
    if (!response.ok) throw new Error(`Gutendex HTTP ${response.status}`);
    const data = await response.json();
    const results = Array.isArray(data.results) ? data.results : [];

    for (const rec of results) {
      const book = mapRecord(rec);
      if (!book || seen.has(book.isbn)) continue;
      seen.add(book.isbn);
      buffer.push(book);
      if (buffer.length >= targetCount) break;
    }

    url = data.next || null;
    await new Promise((r) => setTimeout(r, 350));
  }

  let inserted = 0;
  for (let i = 0; i < buffer.length; i += 200) {
    const chunk = buffer.slice(i, i + 200);
    const result = await prisma.book.createMany({
      data: chunk,
      skipDuplicates: true
    });
    inserted += result.count;
  }

  return { fetched: buffer.length, inserted };
}

async function main() {
  const targetCount = Number(process.argv[2] || 1200);
  if (!Number.isInteger(targetCount) || targetCount < 1) {
    throw new Error("Pass a positive integer, e.g. 1200");
  }

  const result = await importFromGutendex(targetCount);
  console.log("Gutendex import finished:", result);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
