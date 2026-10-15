# Buscador de Círculo Internacional

Aplicación React/Express publicada en https://circulo-inmobiliario.onrender.com.
El cliente compara anuncios antes de proporcionar datos de contacto.

## Flujo público

1. Operación, propiedad, zona/presupuesto y revisión: cuatro pasos.
2. POST /api/searches valida solo criterios. No crea un lead ni envía correos.
3. La fuente institucional consulta el catálogo público vigente de
   circulointernacionalveracruz.org. Las otras fuentes activas se consultan
   mediante búsqueda web restringida, si OpenAI está configurado.
4. Los datos ausentes quedan por confirmar. Las coincidencias cumplen todos
   los criterios comparables; las alternativas muestran sus diferencias.
   Los cambios sugeridos usan precios/zonas de anuncios concretos, sin
   incrementos porcentuales inventados.
5. El cliente abre anuncios y selecciona propiedades. Puede pedir ayuda sin
   elegir una propiedad o sin resultados.
6. POST /api/searches/:searchId/contact requiere autorización de contacto,
   privacidad y una consulta firmada, vigente durante dos horas. Solo acepta
   IDs/ligas incluidos en esa consulta.
7. Se guarda el lead y se envía un reporte a ambos asesores. El mensaje
   incluye el perfil, criterios, resultado, cobertura y únicamente las
   propiedades seleccionadas con sus ligas. Un fallo de correo permite
   reintentar y nunca se presenta como éxito.

Las consultas no representan todo el mercado. Un anuncio localizado no
garantiza disponibilidad; el asesor debe confirmarla y revisar las condiciones
de pago, contrato, mascotas y fecha de entrega con el anunciante.

En «La propiedad», la modalidad de renta muestra juntas las casillas «Tengo
mascota», «Tengo fiador» y «Cuento con póliza jurídica». Fiador y póliza se
pueden marcar o desmarcar de forma independiente. Al marcar mascota se pide
una cantidad entera de 1 a 30 y el tipo (hasta 120 caracteres). Son datos
declarados por el cliente: ni su aceptación ni las garantías exigidas por cada
anuncio se dan por verificadas. La clasificación de anuncios sigue usando
únicamente las características publicadas que sí se pueden comparar.

Los borradores de sesión conservan los demás filtros. Un borrador antiguo
convierte `guarantee=guarantor` o `guarantee=legal_policy` a la casilla
correspondiente cuando no hay selección explícita, y conserva el texto previo
de mascotas para revisión. No deduce cantidades de ese texto. Al desmarcar
mascota se limpian cantidad y tipo; al cambiar a compra se limpian las tres
casillas. Los criterios y las solicitudes de contacto se guardan como JSON;
estas casillas no requieren una migración de base de datos.

## Configuración

Las claves de OpenAI, Resend, Supabase y administración permanecen en Render.
No se incluyen secretos en el navegador, archivos de ejemplo ni Git.

- ADVISOR_EMAILS=patyestr@hotmail.com,circulointernacionalveracruz1@gmail.com
- RESEND_API_KEY: clave existente de la cuenta autorizada.
- EMAIL_FROM: correo de un dominio propio verificado en Resend. Gmail,
  Hotmail y resend.dev no sirven como remitente de estos reportes.
  Si el remitente actual es uno de esos dominios y la clave permite consultar
  dominios, el servidor puede usar un dominio de Círculo ya verificado.
  No crea dominios ni cambia DNS.
- SESSION_SECRET: secreto estable y privado; obligatorio en producción.
- SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY: configuración existente del servidor.
- OPENAI_API_KEY / OPENAI_MODEL: búsqueda en fuentes externas.
- ADMIN_LOGIN / ADMIN_PASSWORD: acceso administrativo.

El panel /admin muestra el estado de correo y permite verificar fuentes.
Un catálogo inaccesible se informa como cobertura parcial.
Supabase conserva leads después de solicitar contacto; si no está disponible
se usa memoria temporal. El correo recibido por los asesores contiene el
reporte completo aun en ese caso. Las fuentes editadas en memoria se pierden
al reiniciar: configure Supabase para conservarlas.

## Desarrollo

npm ci --include=dev
npm run typecheck
npm test
npm run lint
npm run build
npm start

GET /api/health identifica guided-search-v2.
GET /api/contact-status informa si el envío tiene configuración utilizable.
Render despliega automáticamente los commits de main.
