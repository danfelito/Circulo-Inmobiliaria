# Círculo Internacional de Bienes Raíces

Aplicación full-stack para captar, calificar y analizar solicitudes inmobiliarias de renta o compra. Presenta coincidencias del catálogo, explica restricciones y permite reconfigurar la búsqueda sin empezar de cero.

## Funciones incluidas

- Wizard móvil/escritorio para renta y compra.
- Validación de datos y contradicciones.
- Scoring explicable de propiedades.
- OpenAI Responses API con salida estructurada y fallback determinista.
- Persistencia en Supabase con RLS.
- Correo profesional mediante Resend a `patyestr@hotmail.com`.
- Idempotencia para evitar correos duplicados.
- Panel administrativo con 14 proveedores configurables.
- Importación CSV/JSON.
- Modo demo sin servicios externos.
- Aviso de Privacidad y Términos provisionales.
- Blueprint de Render y CI de GitHub.

## Requisitos

- Node.js 22.
- Cuenta de Supabase para persistencia.
- Cuenta de Resend para correo real.
- API key de OpenAI para análisis redactado por IA.

## Desarrollo local

```bash
cp .env.example .env
npm install
npm run dev
```

Frontend: `http://localhost:5173`  
API: `http://localhost:10000`

Sin credenciales, la aplicación funciona en modo demo.

## Variables de entorno

| Variable | Uso |
|---|---|
| `PORT` | Puerto del servidor. |
| `CLIENT_ORIGIN` | Origen permitido por CORS. En producción usa la URL pública. |
| `APP_BASE_URL` | URL pública de la aplicación. |
| `SUPABASE_URL` | URL del proyecto Supabase. |
| `SUPABASE_SERVICE_ROLE_KEY` | Llave secreta exclusiva del backend. |
| `OPENAI_API_KEY` | API key del proyecto OpenAI. |
| `OPENAI_MODEL` | Modelo compatible con Responses API y Structured Outputs. |
| `RESEND_API_KEY` | API key de Resend. |
| `EMAIL_FROM` | Remitente verificado en Resend. |
| `ADVISOR_EMAIL` | Destinatario de leads; por defecto `patyestr@hotmail.com`. |
| `ADMIN_PASSWORD_HASH` | Hash bcrypt de la contraseña administrativa. |
| `SESSION_SECRET` | Secreto largo para firmar tokens administrativos. |

Genera el hash administrativo:

```bash
npm run hash-admin -- "CAMBIA_ESTA_CONTRASEÑA_POR_UNA_SEGURA"
```

## Configurar Supabase

1. Crea un proyecto.
2. Ejecuta `supabase/migrations/202607120001_initial.sql` desde el SQL Editor o mediante Supabase CLI.
3. Copia la URL y la service role key a Render. No coloques la service role key en variables de Vite ni en el navegador.
4. Verifica que RLS esté activo y que `anon`/`authenticated` no tengan acceso directo.

La aplicación inserta todos los leads mediante Express; el frontend nunca escribe directamente en Supabase.

## Configurar OpenAI

1. Crea una API key de proyecto.
2. Configura `OPENAI_API_KEY` y `OPENAI_MODEL` en Render.
3. El backend usa la Responses API con salida estructurada validada por Zod y `store: false`.
4. Nombre, correo y teléfono no se envían a OpenAI.

Si OpenAI falla o no está configurado, el motor determinista continúa funcionando.

## Configurar Resend

1. Verifica un dominio o remitente en Resend.
2. Configura `RESEND_API_KEY` y `EMAIL_FROM`.
3. Conserva `ADVISOR_EMAIL=patyestr@hotmail.com`.

El remitente de prueba `onboarding@resend.dev` tiene restricciones; para producción usa un dominio verificado.

## Pruebas y compilación

```bash
npm run typecheck
npm test
npm run lint
npm run build
npm start
```

Endpoint de salud: `GET /api/health`.

## Desplegar en Render

1. En Render selecciona **New > Blueprint**.
2. Elige este repositorio; Render leerá `render.yaml`.
3. Captura las variables marcadas como `sync: false`.
4. En `CLIENT_ORIGIN` y `APP_BASE_URL` usa la URL pública generada por Render.
5. Despliega y verifica `/api/health`.

## Fuentes externas

Inmuebles24, Vivanuncios y Facebook Marketplace se incluyen como enlaces de búsqueda, no como scraping ni como inventario verificado. Para integrar datos reales se requiere API autorizada, feed acordado o carga administrativa. Consulta `docs/PROVIDERS.md`.

## Aviso legal

Los textos legales incluidos son provisionales y deben revisarse con un asesor legal antes de publicar. La aplicación no garantiza precio, disponibilidad, situación jurídica ni aceptación de crédito.
