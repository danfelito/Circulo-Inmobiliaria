# Círculo Internacional de Bienes Raíces

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/danfelito/Circulo-Inmobiliaria)

Aplicación full-stack para captar, calificar y analizar solicitudes inmobiliarias de renta o compra. Presenta coincidencias del catálogo, explica restricciones y permite reconfigurar la búsqueda sin empezar de cero.

## Funciones incluidas

- Wizard móvil/escritorio para renta y compra.
- Validación de datos y contradicciones.
- Scoring explicable de propiedades.
- OpenAI Responses API con respuesta JSON y fallback determinista.
- Persistencia en Supabase con RLS.
- Correo profesional mediante Resend a `patyestr@hotmail.com`.
- Idempotencia para evitar correos duplicados.
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
| `PORT` | Puerto del servidor. Render usa `10000`. |
| `SUPABASE_URL` | URL del proyecto Supabase. |
| `SUPABASE_SERVICE_ROLE_KEY` | Llave secreta exclusiva del backend. |
| `OPENAI_API_KEY` | API key del proyecto OpenAI. |
| `OPENAI_MODEL` | Modelo compatible con Responses API; por defecto `gpt-5.6`. |
| `RESEND_API_KEY` | API key de Resend. |
| `EMAIL_FROM` | Remitente verificado en Resend. |
| `ADVISOR_EMAIL` | Destinatario de leads; por defecto `patyestr@hotmail.com`. |
| `SESSION_SECRET` | Secreto generado automáticamente por Render. |

`CLIENT_ORIGIN` y `APP_BASE_URL` solo son necesarios en desarrollo o si posteriormente se separan frontend y backend. En Render, ambos se sirven desde el mismo dominio.

## Configurar Supabase

1. Crea o selecciona un proyecto.
2. Ejecuta `supabase/migrations/202607120001_initial.sql` desde SQL Editor.
3. Copia la URL del proyecto y la `service_role` key a Render.
4. No coloques la `service_role` key en variables de Vite ni en el navegador.
5. Verifica que RLS esté activo y que `anon`/`authenticated` no tengan acceso directo.

La aplicación inserta los leads mediante Express; el frontend nunca escribe directamente en Supabase.

## Configurar OpenAI

1. Crea una API key de proyecto.
2. Configura `OPENAI_API_KEY` en Render.
3. Conserva `OPENAI_MODEL=gpt-5.6` o reemplázalo por otro modelo compatible con Responses API.
4. El backend usa `store: false` y no envía nombre, correo ni teléfono al modelo.

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

1. Pulsa el botón **Deploy to Render** al inicio de este README.
2. Inicia sesión o crea una cuenta de Render.
3. Autoriza el acceso al repositorio `danfelito/Circulo-Inmobiliaria`.
4. Render leerá automáticamente `render.yaml`.
5. Captura las variables marcadas como `sync: false`.
6. Crea el Blueprint y espera a que termine el build.
7. Abre `/api/health`; debe responder con `ok: true`.
8. Envía una solicitud de prueba antes de habilitar tráfico real.

El Blueprint usa `npm ci`, ejecuta la compilación completa, inicia Express, verifica `/api/health` y despliega automáticamente únicamente cuando pasan los checks de GitHub.

## Fuentes externas

Inmuebles24, Vivanuncios y Facebook Marketplace se incluyen como enlaces de búsqueda, no como scraping ni como inventario verificado. Para integrar datos reales se requiere API autorizada, feed acordado o carga administrativa.

## Aviso legal

Los textos legales incluidos son provisionales y deben revisarse con un asesor legal antes de publicar. La aplicación no garantiza precio, disponibilidad, situación jurídica ni aceptación de crédito.
