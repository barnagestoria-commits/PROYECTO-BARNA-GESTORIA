-- Las cuentas que ya existen pueden seguir entrando. El alta nueva deja este campo vacío
-- hasta que confirma el código enviado al correo.
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
UPDATE "User" SET "emailVerifiedAt" = "createdAt" WHERE "emailVerifiedAt" IS NULL;
