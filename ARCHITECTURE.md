# Arquitectura

## Resumen

El proyecto es un monorepo npm:

- `client/`: React, TypeScript, Vite, React Hook Form y Zod.
- `server/`: Node.js, Express, OpenAI, Resend y cliente de Supabase.
- `supabase/migrations/`: esquema PostgreSQL y configuración de seguridad.
- `render.yaml`: Blueprint para un Web Service de Render.

En producción, Express sirve los archivos compilados de `client/dist` y expone `/api/*`. Esto permite desplegar todo en un único servicio.

## Flujo de una solicitud

1. El cliente completa el wizard y acepta privacidad/contacto.
2. El navegador crea una llave de idempotencia y envía el formulario a `POST /api/leads`.
3. Express valida con Zod, aplica rate limit y honeypot.
4. El repositorio guarda el lead en Supabase o memoria de demostración.
5. El motor determinista compara el lead con propiedades normalizadas.
6. OpenAI, cuando está configurado, recibe solo criterios sanitizados y redacta una explicación estructurada. No recibe nombre, correo ni teléfono.
7. El servidor guarda resultados, intenta enviar el correo por Resend y responde al navegador.
8. Una petición repetida con la misma llave devuelve el resultado anterior y no vuelve a enviar correo.

## Seguridad

- `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY` y `RESEND_API_KEY` solo existen en el backend.
- Las tablas públicas tienen RLS habilitado y no conceden acceso a `anon` o `authenticated`.
- El panel usa una contraseña bcrypt y tokens HMAC con vencimiento.
- Helmet, CORS, limitación de tasa, tamaño máximo de JSON y validación Zod están activados.
- Los logs evitan imprimir payloads completos o datos personales.

## Modos de operación

### Demo

Si no hay Supabase, los datos se mantienen en memoria y se utilizan propiedades ficticias claramente marcadas. Si no hay OpenAI se usa el análisis determinista. Si no hay Resend se omite el correo sin impedir la respuesta.

### Producción

Supabase persiste leads, búsquedas, proveedores y propiedades. Resend envía al asesor. OpenAI mejora la explicación, sin sustituir el motor de coincidencias.
