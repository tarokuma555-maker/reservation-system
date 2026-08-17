-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "content" TEXT,
ALTER COLUMN "filePath" DROP NOT NULL;
