# OAuth en producción — Google y Microsoft Entra ID

Guía técnica para pasar de entorno de pruebas a producción comercial y cumplir la verificación de Google Cloud y Microsoft Publisher Verification.

## URL de producción canónica

Configura **una sola** URL pública en Vercel (Settings → Environment Variables):

```env
NEXT_PUBLIC_APP_URL=https://tu-dominio-definitivo.com
NEXTAUTH_URL=https://tu-dominio-definitivo.com
```

Hasta tener dominio de marca, la URL temporal oficial es:

`https://v0-factura-y-extractos-web.vercel.app`

El código resuelve automáticamente el origen en este orden: `NEXT_PUBLIC_APP_URL` → `NEXTAUTH_URL` → `VERCEL_URL` → localhost (solo desarrollo).

**Importante:** No registres `http://localhost:3000` en Google Cloud ni Azure para producción comercial.

## URIs de redirección OAuth

Registrar en cada proveedor (copiar desde `GET /api/auth/oauth-status` en producción):

| Proveedor | URI principal (obligatoria) | URI legacy (compatibilidad) |
|-----------|----------------------------|----------------------------|
| Google | `{ORIGIN}/api/oauth/callback/google` | `{ORIGIN}/api/auth/callback/google` |
| Microsoft | `{ORIGIN}/api/oauth/callback/azure-ad` | `{ORIGIN}/api/auth/callback/azure-ad` |

Post-login interno: `{ORIGIN}/auth/complete`

### Ejemplo con dominio Vercel actual

```
https://v0-factura-y-extractos-web.vercel.app/api/oauth/callback/google
https://v0-factura-y-extractos-web.vercel.app/api/oauth/callback/azure-ad
```

## Páginas legales (verificación OAuth)

URLs públicas ya enrutadas:

| Página | Ruta |
|--------|------|
| Política de privacidad | `/politica-privacidad` |
| Términos del servicio | `/terminos-servicio` |

Sustituir los marcadores `[PLACEHOLDER]` por textos legales definitivos antes de enviar la app a revisión de Google/Microsoft.

Indicar estas URLs en:

- Google Cloud Console → OAuth consent screen → Privacy policy / Terms of service
- Microsoft Entra → Branding & properties → Privacy statement / Terms of use
- App Store Connect / Play Console (ver `native-assets/store/metadata.template.json`)

## Microsoft Entra ID — Application (client) ID

El **Application (client) ID** se configura en Vercel como `AZURE_AD_CLIENT_ID`.

Para consultarlo en Azure Portal:

1. [Azure Portal](https://portal.azure.com) → Microsoft Entra ID → App registrations → tu app
2. Copiar **Application (client) ID** (GUID público, no es secreto)
3. Crear **Client secret** en Certificates & secrets → pegar en `AZURE_AD_CLIENT_SECRET` (solo servidor)

Consulta en runtime (sin secretos): `GET /api/auth/oauth-status` → campo `microsoftEntra.applicationId`.

### Publisher Verification (Partner Center)

Microsoft exige **Publisher Verification** para apps multi-tenant comerciales con permisos delegados amplios.

Pasos resumidos:

1. **Registrar la organización** en [Microsoft Partner Center](https://partner.microsoft.com/dashboard/v2/enrollment/introduction/partnership) con cuenta de trabajo verificada (dominio corporativo).
2. En Entra ID → App registration → **Brand & properties**:
   - Publisher domain verificado (DNS TXT en tu dominio)
   - Logo, URLs de soporte, privacidad y términos
3. En Partner Center → **Account settings → Identifiers** → vincular el tenant de Entra con Partner Center (MPN ID).
4. En la app registration → **Publisher verification** → marcar como verificado (badge azul).
5. Configurar `AZURE_AD_TENANT_ID`:
   - `common` — cualquier cuenta Microsoft/Azure AD (multi-tenant, requiere publisher verification)
   - `{tenant-id}` — solo tu organización (intranet / pilotos)

Documentación: [Mark an app as publisher verified](https://learn.microsoft.com/en-us/entra/identity-platform/mark-app-as-publisher-verified)

## Google Cloud — OAuth verification

1. Crear proyecto en [Google Cloud Console](https://console.cloud.google.com/)
2. APIs & Services → OAuth consent screen → **External** (producción)
3. Añadir scopes mínimos: `openid`, `email`, `profile`
4. Authorized redirect URIs (ver tabla arriba)
5. Enviar a **Verification** cuando salgas de modo Testing (más de 100 usuarios o scopes sensibles)

## Variables de entorno — separación servidor / cliente

| Variable | Dónde | Expuesta al cliente |
|----------|-------|---------------------|
| `NEXT_PUBLIC_APP_URL` | Vercel Production | Sí (URL pública) |
| `NEXTAUTH_URL` | Vercel Production | No |
| `NEXTAUTH_SECRET` | Vercel Production | **Nunca** |
| `GOOGLE_CLIENT_SECRET` | Vercel Production | **Nunca** |
| `AZURE_AD_CLIENT_SECRET` | Vercel Production | **Nunca** |
| `GOOGLE_CLIENT_ID` | Vercel Production | Solo vía flujo OAuth (público por diseño) |
| `AZURE_AD_CLIENT_ID` | Vercel Production | Solo vía flujo OAuth / API setup |
| `DATABASE_URL`, `DEEPSEEK_API_KEY` | Vercel Production | **Nunca** |

Los secretos solo existen en rutas API (`app/api/**`) y `lib/**` del servidor. No usar `NEXT_PUBLIC_` para credenciales.

## Configuraciones de seguridad OAuth aplicadas

| Medida | Implementación |
|--------|----------------|
| Secretos solo servidor | `GOOGLE_*`, `AZURE_*`, `NEXTAUTH_SECRET` sin prefijo `NEXT_PUBLIC_` |
| Cookies de sesión httpOnly | Token opaco `barna_session` en BD; no JWT en localStorage |
| secure + sameSite | `secure: true` en producción; `sameSite: "lax"` (OAuth redirect + WebView) |
| NextAuth cookies seguras | `useSecureCookies: true` en producción |
| Host de confianza | `NEXTAUTH_URL` auto-resuelto en Vercel (sin localhost en prod) |
| Redirect whitelist | Callback `redirect()` limita a mismo origen |
| Rewrites legacy | `/api/auth/callback/*` → `/api/oauth/callback/*` |
| URIs centralizadas | `lib/auth/oauth-urls.ts` desde `NEXTAUTH_URL` |
| Avisos producción | `GET /api/auth/oauth-status` → `warnings` si localhost en prod |

## Multi-tenant (múltiples empresas externas)

**Sí, el flujo actual ya soporta multi-tenant a nivel de datos:**

- Modelo Prisma: `Account` (GESTORIA / CLIENTE_FINAL), `Company`, `UserCompanyAccess`, `Session.activeCompanyId`
- OAuth nuevos usuarios → cuenta `CLIENTE_FINAL` auto-provisionada (`lib/auth/oauth-service.ts`)
- APIs aisladas por empresa activa vía `requireActiveCompany()`
- Gestorías pueden gestionar múltiples empresas cliente con roles y permisos

**OAuth multi-tenant a nivel de identidad:**

- Google: consent screen External cubre usuarios de cualquier dominio
- Microsoft: `AZURE_AD_TENANT_ID=common` permite cuentas de cualquier organización Azure AD / Microsoft personal
- Publisher Verification necesaria para escala comercial con Microsoft

## Shells móviles (Capacitor / Tauri)

Los shells cargan la URL cloud (no empaquetan secretos):

```bash
npm run native:config   # sincroniza URL desde .env.local / env
npm run mobile:sync
```

OAuth en WebView: el flujo usa el dominio cloud como first-party; las cookies de sesión se establecen en ese dominio. Para OAuth en apps nativas puras (Custom Tabs / ASWebAuthenticationSession), evaluar `@capacitor/browser` en una fase posterior.

## Checklist pre-lanzamiento

- [ ] Dominio definitivo en `NEXT_PUBLIC_APP_URL` y `NEXTAUTH_URL`
- [ ] URIs registradas en Google y Azure (sin localhost)
- [ ] Textos legales definitivos en `/politica-privacidad` y `/terminos-servicio`
- [ ] Google OAuth consent screen en producción / verificado
- [ ] Microsoft Publisher Verification completada
- [ ] `npm run native:config` ejecutado con URL de producción
- [ ] Iconos en `native-assets/icon/` y splash generados
- [ ] Revisar `warnings` en `/api/auth/oauth-status` (debe estar vacío)
