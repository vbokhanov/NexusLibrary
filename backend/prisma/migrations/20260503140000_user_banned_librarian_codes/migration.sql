-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "banned" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE IF NOT EXISTS "LibrarianInviteCode" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "createdById" INTEGER NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LibrarianInviteCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LibrarianInviteCode_code_key" ON "LibrarianInviteCode"("code");
CREATE INDEX IF NOT EXISTS "LibrarianInviteCode_code_used_idx" ON "LibrarianInviteCode"("code", "used");

ALTER TABLE "LibrarianInviteCode" DROP CONSTRAINT IF EXISTS "LibrarianInviteCode_createdById_fkey";
ALTER TABLE "LibrarianInviteCode" ADD CONSTRAINT "LibrarianInviteCode_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
