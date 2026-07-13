-- Diez fuentes configurables de búsqueda privada.
insert into public.providers (id, position, name, base_url, integration_type, enabled) values
  ('source-1', 1, 'Círculo Internacional', 'https://circulointernacional.com/home-page/properties/home', 'search_link', true),
  ('source-2', 2, 'Fuente 2', '', 'search_link', false),
  ('source-3', 3, 'Fuente 3', '', 'search_link', false),
  ('source-4', 4, 'Fuente 4', '', 'search_link', false),
  ('source-5', 5, 'Fuente 5', '', 'search_link', false),
  ('source-6', 6, 'Fuente 6', '', 'search_link', false),
  ('source-7', 7, 'Fuente 7', '', 'search_link', false),
  ('source-8', 8, 'Fuente 8', '', 'search_link', false),
  ('source-9', 9, 'Fuente 9', '', 'search_link', false),
  ('source-10', 10, 'Fuente 10', '', 'search_link', false)
on conflict (id) do update set
  position = excluded.position,
  name = excluded.name,
  base_url = excluded.base_url,
  integration_type = excluded.integration_type,
  enabled = excluded.enabled,
  updated_at = now();
