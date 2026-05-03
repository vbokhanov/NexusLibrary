const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const readerPass = await bcrypt.hash("Reader123!", 10);
  const librarianPass = await bcrypt.hash("Librarian123!", 10);

  /* Служебный администратор id=1 создаётся при старте API (ensureBootstrapAdmin). */

  const librarian = await prisma.user.upsert({
    where: { email: "librarian@library.local" },
    update: {},
    create: {
      fullName: "Тестовый библиотекарь",
      email: "librarian@library.local",
      passwordHash: librarianPass,
      role: "LIBRARIAN"
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
      inStock: 1,
      ownerUserId: null,
      textUrl: null,
      contentText:
        "Демонстрационный фрагмент (учебный проект).\n\n" +
        "«Чистый код» Роберта Мартина — практическое руководство о том, как писать программы, " +
        "которые легко читать и сопровождать: осмысленные имена, короткие функции, обработка ошибок, тесты.\n\n" +
        "Полный текст издания доступен только в легальных источниках; здесь показан лишь интерфейс чтения в каталоге."
    },
    {
      title: "1984",
      author: "Джордж Оруэлл",
      isbn: "9785170801157",
      year: 1949,
      genre: "Антиутопия",
      inStock: 1,
      ownerUserId: null,
      textUrl: null,
      contentText:
        "Демонстрационный фрагмент (учебный проект).\n\n" +
        "«1984» — антиутопический роман о тотальном надзоре, переписывании истории и подавлении частной жизни. " +
        "Здесь размещён не полный роман, а краткое содержание для проверки кнопки «Читать».\n\n" +
        "Для полноценного чтения используйте лицензионные издания."
    },
    {
      title: "Мастер и Маргарита",
      author: "Михаил Булгаков",
      isbn: "9785171347944",
      year: 1967,
      genre: "Роман",
      inStock: 1,
      ownerUserId: null,
      textUrl: null,
      contentText:
        "Демонстрационный фрагмент (учебный проект).\n\n" +
        "«Мастер и Маргарита» — роман о Москве 1930-х, Воланде и любви Мастера к своему тексту. " +
        "Это не полный текст произведения, а иллюстрация работы электронного каталога.\n\n" +
        "Полный текст доступен в правомерных изданиях."
    }
  ];

  for (const book of books) {
    await prisma.book.upsert({
      where: { isbn: book.isbn },
      update: {
        contentText: book.contentText,
        textUrl: book.textUrl,
        inStock: 1,
        ownerUserId: null
      },
      create: book
    });
  }

  const firstBook = await prisma.book.findFirst({ where: { title: "1984" } });
  if (firstBook) {
    try {
      await prisma.borrow.create({
        data: {
          userId: reader.id,
          bookId: firstBook.id,
          dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14)
        }
      });
    } catch (_) {
      /* ignore duplicate seed borrow */
    }
  }

  console.log("Seed completed:", { librarianId: librarian.id, readerId: reader.id });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
