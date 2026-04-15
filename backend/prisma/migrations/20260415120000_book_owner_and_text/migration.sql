-- AlterTable
ALTER TABLE "Book" ADD COLUMN "ownerUserId" INTEGER;
ALTER TABLE "Book" ADD COLUMN "textUrl" TEXT;
ALTER TABLE "Book" ADD COLUMN "contentText" TEXT;

-- AddForeignKey
ALTER TABLE "Book" ADD CONSTRAINT "Book_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Book_ownerUserId_idx" ON "Book"("ownerUserId");
