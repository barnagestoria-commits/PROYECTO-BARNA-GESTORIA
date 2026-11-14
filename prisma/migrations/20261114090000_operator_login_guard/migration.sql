-- CreateTable
CREATE TABLE "LoginGuard" (
    "emailKey" TEXT NOT NULL,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginGuard_pkey" PRIMARY KEY ("emailKey")
);
