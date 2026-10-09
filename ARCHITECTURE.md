# Arquitectura del buscador

client/: React, Vite y React Hook Form.
server/: Express, clasificación determinista, búsqueda en fuentes, Resend y Supabase.

La consulta anónima y la solicitud de contacto son operaciones distintas.
No se almacenan los datos de contacto en borradores del navegador. Los criterios
se conservan durante la sesión; el borrador antiguo con datos personales se retira.

La fuente institucional lee únicamente GET /api/properties del portal Cloudflare
publicado. No escribe en D1 ni altera el portal. Solo se incluyen propiedades
publicadas, disponibles y con precio en MXN. No se utilizan datos demostrativos.
Otras fuentes se buscan únicamente dentro de los dominios activos, y las ligas
deben aparecer en fuentes/citas realmente consultadas.

La clasificación compara presupuesto, ciudad, zonas, mínimos y requisitos
indispensables publicados. Los datos ausentes impiden una coincidencia exacta.
Las alternativas y recomendaciones llevan evidencia de anuncios y cambios
estructurados que el cliente revisa antes de aplicar.

El resultado se firma con HMAC y SESSION_SECRET, incluye criterios y anuncios
públicos, caduca en dos horas y sobrevive a un reinicio de Render. El endpoint de
contacto valida esa firma, la selección y el consentimiento. La consulta no
crea leads ni envía correos. La solicitud explícita sí guarda el lead y envía
el reporte a los dos asesores configurados.

Las tablas Supabase existentes mantienen RLS y acceso reservado al servidor.
Los resultados web se guardan como snapshots sin claves foráneas inexistentes.
Los estados de leads usan los valores compatibles con la migración original.
El envío utiliza idempotencia del proveedor y control de solicitudes concurrentes;
si falla no se comunica una confirmación de éxito.

No se eluden autenticación, CAPTCHA, bloqueos ni condiciones de los portales.
