import { PrismaClient } from "@prisma/client"
import { hashPassword } from "../lib/auth/password"

const prisma = new PrismaClient()

async function main() {
  await prisma.fiscalDocument.deleteMany()
  await prisma.userCompanyAccess.deleteMany()
  await prisma.session.deleteMany()
  await prisma.user.deleteMany()
  await prisma.company.deleteMany()
  await prisma.account.deleteMany()

  const gestoriaAccount = await prisma.account.create({
    data: {
      name: "Barna Gestoría",
      accountType: "GESTORIA",
      users: {
        create: [
          {
            email: "admin@gestoria.com",
            passwordHash: hashPassword("demo123"),
            name: "Admin Gestoría",
            role: "ADMIN_GESTOR",
          },
          {
            email: "gestor@gestoria.com",
            passwordHash: hashPassword("demo123"),
            name: "María Gestor",
            role: "GESTOR",
          },
        ],
      },
      companies: {
        create: [
          { name: "Empresa ABC SL", cif: "B12345678" },
          { name: "Comercio XYZ", cif: "B87654321" },
          { name: "Servicios 123 SL", cif: "B11223344" },
        ],
      },
    },
    include: { users: true, companies: true },
  })

  const admin = gestoriaAccount.users.find((user) => user.role === "ADMIN_GESTOR")!
  const gestor = gestoriaAccount.users.find((user) => user.role === "GESTOR")!

  for (const company of gestoriaAccount.companies) {
    await prisma.userCompanyAccess.create({
      data: { userId: admin.id, companyId: company.id },
    })
  }

  for (const company of gestoriaAccount.companies.slice(0, 2)) {
    await prisma.userCompanyAccess.create({
      data: { userId: gestor.id, companyId: company.id },
    })
  }

  const clienteAccount = await prisma.account.create({
    data: {
      name: "Autónomo Juan Pérez",
      accountType: "CLIENTE_FINAL",
      users: {
        create: {
          email: "juan@empresa.com",
          passwordHash: hashPassword("demo123"),
          name: "Juan Pérez",
          phone: "+34 600 111 222",
          role: "CLIENTE",
        },
      },
      companies: {
        create: {
          name: "Juan Pérez Autónomo",
          cif: "12345678Z",
        },
      },
    },
    include: { users: true, companies: true },
  })

  await prisma.userCompanyAccess.create({
    data: {
      userId: clienteAccount.users[0].id,
      companyId: clienteAccount.companies[0].id,
    },
  })

  await prisma.fiscalDocument.createMany({
    data: [
      {
        companyId: gestoriaAccount.companies[0].id,
        name: "Factura_Proveedor_001.pdf",
        type: "FACTURA_RECIBIDA",
        status: "PROCESADO",
        sizeBytes: 250880,
      },
      {
        companyId: clienteAccount.companies[0].id,
        name: "Extracto_Enero_2024.pdf",
        type: "EXTRACTO_BANCARIO",
        status: "PROCESADO",
        sizeBytes: 1258291,
      },
    ],
  })

  console.log("Seed completado:")
  console.log("  Gestoría admin → admin@gestoria.com / demo123")
  console.log("  Gestor        → gestor@gestoria.com / demo123")
  console.log("  Cliente final → juan@empresa.com / demo123")
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
