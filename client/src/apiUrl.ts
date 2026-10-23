const configuredBase = import.meta.env.VITE_API_BASE_URL?.trim() || '';

export function apiUrl(path: `/api/${string}`): string {
  return configuredBase ? new URL(path, configuredBase).toString() : path;
}
