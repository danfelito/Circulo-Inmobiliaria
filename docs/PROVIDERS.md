# Proveedores y fuentes inmobiliarias

La aplicación no incluye robots para saltar autenticación, CAPTCHA, bloqueos o restricciones de portales. Cada fuente se configura con uno de estos modos:

- `authorized_api`: API oficial o contrato de integración.
- `csv_feed`: archivo o feed CSV autorizado.
- `json_feed`: archivo o feed JSON autorizado.
- `search_link`: enlace externo que abre una búsqueda; no se considera resultado verificado.
- `manual`: captura o importación administrada por el asesor.

## Los 14 espacios iniciales

Los primeros cuatro corresponden a Círculo Internacional de Bienes Raíces, Inmuebles24, Vivanuncios y Facebook Marketplace. Los otros diez espacios pueden editarse desde `/admin`.

## Importación

El panel acepta CSV y JSON. Los campos reconocidos son:

`id`, `title`, `transaction_type` o `transactionType`, `property_type` o `propertyType`, `city`, `neighborhood`, `price`, `bedrooms`, `bathrooms`, `parking`, `land_area` o `landArea`, `construction_area` o `constructionArea`, `floors`, `yard`, `garden`, `pool`, `amenities`, `source_name` o `sourceName`, `source_url` o `sourceUrl`, `verified_at` y `demo`.

En CSV, `amenities` puede separarse con `|`, coma o punto y coma.
