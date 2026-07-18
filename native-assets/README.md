# Recursos nativos — App Store y Play Store

Carpeta centralizada para assets exigidos por Apple, Google y Capacitor/Tauri.

## Estructura

```
native-assets/
├── icon/
│   └── icon.png          # Maestro 1024×1024 (sin transparencia en iOS)
├── splash/
│   └── splash.png        # Maestro 2732×2732 o 1284×2778 (fondo sólido + logo)
└── store/
    └── metadata.template.json
```

## Identificador de paquete

Definido en `packages/platform/native-app.config.json`:

| Plataforma | Valor |
|------------|-------|
| Android / iOS / macOS | `com.gestoria.platform` |
| Nombre visible | Gestoría |

Cambiar el bundle id antes del primer envío a las tiendas; requiere recrear proyectos nativos en Xcode/Android Studio.

## Generar iconos para Capacitor

Cuando tengas `icon/icon.png` (1024×1024):

```bash
npx @capacitor/assets generate --iconBackgroundColor "#145A32" --splashBackgroundColor "#145A32"
```

Ejecutar desde `apps/mobile` tras copiar el maestro a `apps/mobile/assets/`.

## Sincronizar URL cloud en shells

No hardcodear URLs en código cliente. Usar variables de entorno y:

```bash
npm run native:config
```

Esto lee `NEXT_PUBLIC_APP_URL` (o `.env.local`) y actualiza Capacitor + Tauri.

## Tauri iconos

Copiar variantes generadas a `apps/desktop/src-tauri/icons/` antes de activar `"bundle": { "active": true }` en `tauri.conf.json`.
