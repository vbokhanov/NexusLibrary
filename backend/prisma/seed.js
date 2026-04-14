const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const adminPass = await bcrypt.hash("Admin123!", 10);
  const readerPass = await bcrypt.hash("Reader123!", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@library.local" },
    update: {},
    create: {
      fullName: "System Administrator",
      email: "admin@library.local",
      passwordHash: adminPass,
      role: "ADMIN"
    }
  });

  const reader = await prisma.user.upsert({
    where: { email: "reader@library.local" },
    update: {},
    create: {
      fullName: "Test Reader",
      email: "reader@library.local",
      passwordHash: readerPass,
      role: "READER"
    }
  });

  const books = [
    {
      title: "Чистый код",
      author: "Роберт Мартин",
      isbn: "9785446110848",
      year: 2011,
      genre: "IT",
      inStock: 4
    },
    {
      title: "1984",
      author: "Джордж Оруэлл",
      isbn: "9785170801157",
      year: 1949,
      genre: "Антиутопия",
      inStock: 2
    },
    {
      title: "Мастер и Маргарита",
      author: "Михаил Булгаков",
      isbn: "9785171347944",
      year: 1967,
      genre: "Роман",
      inStock: 3
    }
  ];

  for (const book of books) {
    await prisma.book.upsert({
      where: { isbn: book.isbn },
      update: {},
      create: book
    });
  }

  const firstBook = await prisma.book.findFirst({ where: { title: "1984" } });
  if (firstBook) {
    await prisma.borrow.create({
      data: {
        userId: reader.id,
        bookId: firstBook.id,
        dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14)
      }
    });
  }

  console.log("Seed completed:", { adminId: admin.id, readerId: reader.id });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
