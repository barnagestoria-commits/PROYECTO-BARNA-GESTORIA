-- AlterEnum: debe ir en su propia transacción (PostgreSQL no permite usar el valor nuevo en la misma).
ALTER TYPE "AccountType" ADD VALUE IF NOT EXISTS 'EMPRESA';
