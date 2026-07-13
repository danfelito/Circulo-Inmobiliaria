# Círculo Internacional de Bienes Raíces

Aplicación full-stack para captar solicitudes de compra o renta, consultar internamente hasta diez fuentes configuradas y enviar al asesor las propiedades encontradas. El cliente no recibe enlaces directos a portales: únicamente se le informa si se localizaron opciones y que un asesor se las hará llegar.

## Funciones

- Wizard para renta y compra.
- Validación de criterios y presupuesto.
- Consulta privada de hasta 10 fuentes administrables.
- OpenAI Responses API con búsqueda web restringida a los dominios configurados.
- Correo al asesor con las propiedades y sus ligas.
- Respuesta pública sin ligas ni datos de los anuncios.
- Persistencia en Supabase con RLS.
- Inicio de sesión administrativo protegido mediante variables de entorno.
- Diseño rojo, negro y blanco con el logotipo institucional.
- Aviso de Privacidad integral.
- Blueprint de Render y CI de GitHub.

## Render

Variables secretas requeridas:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `ADMIN_PASSWORD`

Variables predefinidas en `render.yaml`:

- `ADMIN_LOGIN=circulointernacionalveracruz1`
- `OPENAI_MODEL=gpt-5.6`
- `ADVISOR_EMAIL=patyestr@hotmail.com`

En Render, configure `ADMIN_PASSWORD` con la clave administrativa acordada. No guarde esa clave en GitHub.

## Supabase

Ejecute, en orden, las migraciones de `supabase/migrations/`. Esto permite persistir leads, resultados y las diez fuentes del panel. Sin Supabase, la aplicación opera en memoria y los cambios de fuentes se pierden cuando el servicio se reinicia.

## Desarrollo y verificación

```bash
cp .env.example .env
npm install --include=dev
npm run typecheck
npm test
npm run lint
npm run build
npm start
```

Endpoint de salud: `GET /api/health`.

## Fuentes

Las ligas configuradas se transforman en dominios permitidos para la búsqueda web. El sistema no elude autenticación, CAPTCHA ni restricciones técnicas. Solo debe utilizar fuentes cuyo acceso y uso estén autorizados.
