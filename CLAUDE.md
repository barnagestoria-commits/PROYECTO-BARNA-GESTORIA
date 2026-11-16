# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **Taxlyn**, a Next.js web application for a Spanish accounting and tax management program (software), not a gestoría and not payroll. It is used by companies, freelancers (autónomos), and accounting firms (despachos).

## Development Commands

```bash
npm run dev            # servidor de desarrollo
npm run build          # prisma generate + next build
npm start              # servidor de producción
npm run lint
npm run test           # vitest run
npm run db:migrate     # prisma migrate dev (local)
npm run db:setup       # migrate deploy + seed (el seed borra datos: requiere ALLOW_DESTRUCTIVE_SEED=1)
```

`npm run vercel-build` (usado por Vercel) ejecuta `prisma generate && prisma migrate deploy && next build`,
así que **cada despliegue aplica las migraciones pendientes a la base de datos de producción**.

## Architecture & Structure

### Tech Stack
- **Framework**: Next.js 15.5.x (App Router) + React 18 + TypeScript. Next se subió de la 14 a la 15.5.x para
  corregir vulnerabilidades críticas (commit 03a3118); no fue por una integración incompatible. No bajar de versión.
- **Styling**: Tailwind CSS 3 con sistema de diseño propio; componentes con primitivas Radix UI
- **Datos**: Prisma 6 + PostgreSQL (hoy Neon; previsto migrar a Supabase, región UE). `DATABASE_URL` / `DIRECT_URL`
- **Autenticación**: sesión propia con cookie `barna_session` (no NextAuth como sesión), OAuth Google/Microsoft,
  verificación por correo y dispositivos de confianza (`taxlyn_device`). Helpers en `lib/auth/api-auth.ts`
  (`requireRequestSession`, `requirePlatformOperator`, `authErrorResponse`)
- **Archivos**: Vercel Blob privado vía `lib/storage/object-storage.ts` (límite de 4 MB por subida por el tope de 4,5 MB de Vercel)
- **OCR**: DeepSeek (los contenidos de facturas/extractos salen del EEE: está declarado en la política de privacidad)
- **Correo**: nodemailer (SMTP por variables de entorno)
- **Tests**: vitest
- **Despliegue**: Vercel (plan Hobby), auto-despliegue desde `main`. Cron diario en `vercel.json`
- **Estado cliente**: React Context (ChatProvider y proveedores de sesión)

### Custom Design System

The application uses a sophisticated color palette focused on business/eco-friendly themes:
- **Primary Colors**: Verde Esmeralda Oscuro (#145A32), Verde Pino Profundo (#0F3D2E)
- **Secondary Colors**: Beige Arena Suave (#EAE3D2), Dorado Suave (#C2A878)
- **Utility Colors**: Gris Grafito (#2C2C2C) for text
- **Extended Palette**: `pine`, `emerald`, `graphite`, `sand`, `gold` color scales

### Key Components

1. **AppWrapper** (`components/app-wrapper.tsx`): Global loading state with seasonal loading screen
2. **ResponsiveLogo** (`components/responsive-logo.tsx`): Adaptive logo display
3. **SeasonalLoadingScreen** (`components/seasonal-loading-screen.tsx`): Branded loading experience
4. **ChatProvider** (`components/chat-provider.tsx`): Communication state management
5. **ProcessAnimation** (`components/process-animation.tsx`): Service flow visualization

### Build Configuration

- **TypeScript**: Strict mode with build error ignoring (Next.js config)
- **ESLint**: Available but ignored during builds for rapid development
- **Images**: Unoptimized for deployment compatibility
- **Metadata**: SEO-optimized for Spanish accounting and tax software

## Business Context

Taxlyn is a **programa de gestión contable y fiscal** (Spanish software):
- **Contabilidad** (Accounting)
- **Fiscal** (Tax: IVA, models, IRPF, sociedades)
- **Documentos** (Invoices, bank statements, company file)

It is **not** a gestoría and **not** laboral/payroll. Despacho accounts are accounting firms *using* Taxlyn, not a claim that Taxlyn itself is a firm.

Target audience: Spanish-speaking businesses, autónomos, and despachos.

## Product rules (billing and access)

- **Prueba gratuita**: 7 días con todas las funciones (`trial`), luego 15 días de solo lectura con descarga de datos
  (`readonly`: las escrituras responden HTTP 402), después borrado (`expired`). Lógica en `lib/billing/access-state.ts`.
- **Descarga de datos**: `/api/account/export` (ZIP en streaming) desde el banner de acceso.
- **Borrado automático**: cron `/api/cron/trial-lifecycle` (`CRON_SECRET`); solo borra si `TRIAL_PURGE_ENABLED=1`.
- **Pago**: por transferencia con validación manual (`/checkout/transferencia`, `/admin/pagos`). Aprobar un pago activa
  usuario y cuenta, y aplica el plan solicitado. **Ningún cambio de plan se aplica sin pago aprobado por el operador**
  (`/api/account/upgrade` solo registra la solicitud).
- **Operador**: cuenta `infotaxlyn@gmail.com`; las cuentas demo (juan@empresa.com, gestor@gestoria.com,
  admin@gestoria.com) no se listan y se pueden borrar desde el panel de soporte.
- **Textos legales**: `app/terminos-servicio`, `app/politica-privacidad`, versión en `lib/legal/versions.ts` (súbela al
  cambiar los textos) y datos del titular en `lib/legal/company-info.ts`.

## Workflow

- Claude hace los commits y los despliegues a producción, pero **solo cuando la titular lo confirma en el chat**.
  Trabajar en una rama; el despliegue es fusionar a `main`.
- Al tocar el esquema de Prisma, crear la migración en `prisma/migrations/`.

## Development Notes

- All text content is in Spanish
- Uses semantic HTML with accessibility considerations
- Responsive design with mobile-first approach
- Custom gradient backgrounds and animations
- WhatsApp integration components for customer communication
- File upload functionality for document management