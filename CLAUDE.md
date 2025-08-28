# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **Barna Gestoría**, a Next.js web application for a Spanish accounting/administrative services company (gestoría) based in Barcelona. The application provides services for business accounting, tax advisory, and payroll management for companies and freelancers.

## Development Commands

```bash
# Development server
npm run dev

# Build production
npm run build

# Start production server
npm start

# Run linting
npm run lint
```

## Architecture & Structure

### Tech Stack
- **Framework**: Next.js 14 with TypeScript
- **Styling**: Tailwind CSS with custom design system
- **UI Components**: Custom components built with Radix UI primitives
- **State Management**: React Context (ChatProvider)
- **Deployment**: Vercel (auto-synced with v0.app)

### Key Architecture Patterns

1. **App Router Structure**: Uses Next.js app directory with route-based pages
2. **Component Organization**: 
   - `/components/ui/` - Base UI components (buttons, cards, inputs)
   - `/components/` - Feature-specific components
   - `/app/` - Pages and layouts
3. **Wrapper Pattern**: Uses `AppWrapper` for global loading state and resource preloading
4. **Provider Pattern**: `ChatProvider` manages chat/communication state

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
- **Metadata**: SEO-optimized for gestoría services in Barcelona

## Business Context

This is a professional services website for:
- **Contabilidad** (Accounting)
- **Asesoría Fiscal** (Tax Advisory)  
- **Gestión Laboral** (Payroll/HR Management)
- **Constitución de Empresas** (Business Formation)

Target audience: Spanish-speaking businesses and freelancers (autónomos) in Barcelona.

## Development Notes

- All text content is in Spanish
- Uses semantic HTML with accessibility considerations
- Responsive design with mobile-first approach
- Custom gradient backgrounds and animations
- WhatsApp integration components for customer communication
- File upload functionality for document management