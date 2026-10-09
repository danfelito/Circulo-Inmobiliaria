# Verificación del buscador guiado

Validación local:
- TypeScript en cliente y servidor: correcto.
- ESLint en cliente y servidor: sin errores ni advertencias.
- Compilación de producción: correcta.
- 29 pruebas en 7 archivos: aprobadas.

Cobertura: búsqueda sin contacto ni correos; separación de coincidencias y
alternativas; datos desconocidos y características negadas; precios y zonas
con evidencia; consultas firmadas y vencimiento; URLs permitidas; catálogo
público y cobertura parcial; consentimiento; selección ajena rechazada;
contacto sin resultados; reintento de correo y ausencia de falsos éxitos;
destinatarios, remitente verificado y ligas de interés en el reporte.

Las pruebas de correo usan un proveedor simulado y no envían mensajes reales.
El envío real requiere una clave Resend vigente y un dominio propio verificado.
La publicación se valida aparte mediante Render y /api/health.
