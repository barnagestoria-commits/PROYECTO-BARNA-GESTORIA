-- Los usuarios que ya existen siguen con acceso (DEFAULT true). Solo cambia lo que decida el código al registrar.
ALTER TABLE "User" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "pagos_pendientes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "comprobante_url" TEXT,
    "comprobante_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revisado_por" TEXT,
    "revisado_at" TIMESTAMP(3),

    CONSTRAINT "pagos_pendientes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pagos_pendientes_estado_check" CHECK ("estado" IN ('pendiente', 'aprobado', 'rechazado'))
);

-- CreateTable
CREATE TABLE "bank_transfer_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "iban" TEXT NOT NULL,
    "beneficiary" TEXT NOT NULL,
    "bankName" TEXT,
    "instructions" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "bank_transfer_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pagos_pendientes_estado_fecha_idx" ON "pagos_pendientes"("estado", "fecha");
CREATE INDEX "pagos_pendientes_user_id_fecha_idx" ON "pagos_pendientes"("user_id", "fecha");
CREATE INDEX "pagos_pendientes_sha256_idx" ON "pagos_pendientes"("sha256");

-- AddForeignKey
ALTER TABLE "pagos_pendientes" ADD CONSTRAINT "pagos_pendientes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
