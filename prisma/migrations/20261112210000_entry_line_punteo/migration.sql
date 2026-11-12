-- AlterTable
ALTER TABLE "EntryLine" ADD COLUMN "punteado" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "EntryLine" ADD COLUMN "punteadoAt" TIMESTAMP(3);
