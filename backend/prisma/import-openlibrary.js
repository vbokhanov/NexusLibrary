const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const SUBJECTS = [
  "fantasy",
  "science_fiction",
  "history",
  "romance",
  "mystery",
  "poetry",
  "biography",
  "adventure",
  "philosophy",
  "art",
  "education",
  "computers",
  "psychology",
  "business",
  "medicine"
];

async function ensureBaseUsers() {
  const adminPass = await bcrypt.hash("Admin123!", 10);
  const readerPass = await bcrypt.hash("Reader123!", 10);

  await prisma.user.upsert({
    where: { email: "admin@library.local" },
    update: {},
    create: {
      fullName: "System Administrator",
      email: "admin@library.local",
      passwordHash: adminPass,
      role: "ADMIN"
    }
  });

  await prisma.user.upsert({
    where: { email: "reader@library.local" },
    update: {},
    create: {
      fullName: "Test Reader",
      email: "reader@library.local",
      passwordHash: readerPass,
      role: "READER"
    }
  });
}

function mapWorkToBook(work, subject) {
  const title = String(work.title || "").trim();
  if (!title) return null;

  const author = Array.isArray(work.authors) && work.authors[0]?.name ? work.authors[0].name : "Unknown author";
  const year = Number.isInteger(work.first_publish_year) ? work.first_publish_year : 2000;
  const safeYear = Math.min(Math.max(year, 1800), new Date().getFullYear());

  const workKey = String(work.key || "").replace("/works/", "");
  const isbn = `OL-${workKey || Math.random().toString(36).slice(2, 12)}`;
  const coverUrl = work.cover_id ? `https://covers.openlibrary.org/b/id/${work.cover_id}-L.jpg` : "";

  return {
    title,
    author,
    isbn,
    year: safeYear,
    genre: subject.replace(/_/g, " "),
    coverUrl,
    description: `Imported from Open Library subject: ${subject.replace(/_/g, " ")}`,
    inStock: Math.floor(Math.random() * 8) + 1
  };
}

async function fetchSubjectBatch(subject, offset) {
  const url = `https://openlibrary.org/subjects/${subject}.json?limit=50&offset=${offset}`;
  const response = await fetch(url, {
    headers: { "User-Agent": "LibraryNexusImport/1.0 (edu project)" }
  });
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data.works) ? data.works : [];
}

async function importRealBooks(targetCount) {
  const seen = new Set();
  const buffer = [];
  let subjectIndex = 0;
  let offset = 0;

  while (buffer.length < targetCount) {
    const subject = SUBJECTS[subjectIndex % SUBJECTS.length];
    const works = await fetchSubjectBatch(subject, offset);

    if (!works.length) {
      subjectIndex += 1;
      offset = 0;
      if (subjectIndex > SUBJECTS.length * 10) break;
      continue;
    }

    for (const work of works) {
      const book = mapWorkToBook(work, subject);
      if (!book || seen.has(book.isbn)) continue;
      seen.add(book.isbn);
      buffer.push(book);
      if (buffer.length >= targetCount) break;
    }

    offset += 50;
    if (offset >= 2000) {
      subjectIndex += 1;
      offset = 0;
    }
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
  const targetCount = Number(process.argv[2] || 10000);
  if (!Number.isInteger(targetCount) || targetCount < 1) {
    throw new Error("Pass a positive integer as import count, e.g. 10000");
  }

  await ensureBaseUsers();
  const result = await importRealBooks(targetCount);
  console.log("Open Library import finished:", result);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
