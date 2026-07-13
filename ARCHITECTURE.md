# Arquitectura

## Componentes

- `client/`: React, TypeScript, Vite, React Hook Form y Zod.
- `server/`: Express, OpenAI, Resend y Supabase.
- `supabase/migrations/`: tablas, índices y RLS.
- `render.yaml`: despliegue de un único servicio web.

## Flujo de búsqueda

1. El cliente completa la solicitud y acepta privacidad y contacto.
2. Express valida el formulario y aplica idempotencia y limitación de tasa.
3. El servidor carga las diez fuentes guardadas en Supabase o memoria.
4. OpenAI realiza una búsqueda web restringida a los dominios habilitados.
5. Los resultados se normalizan, filtran y califican según los criterios del cliente.
6. El asesor recibe por correo las opciones y sus ligas.
7. El cliente solo recibe el número de opciones localizadas y un aviso de seguimiento; nunca recibe las ligas de los portales.

## Seguridad

- Las claves de OpenAI, Resend y Supabase permanecen en el servidor.
- La clave administrativa se configura como secreto de Render, no en el repositorio.
- Las tablas públicas tienen RLS habilitado y acceso revocado para `anon` y `authenticated`.
- Los tokens administrativos son firmados y expiran.
- Nombre, correo y teléfono no se envían a OpenAI.
- No se implementan mecanismos para saltar autenticación, CAPTCHA o restricciones de portales.
