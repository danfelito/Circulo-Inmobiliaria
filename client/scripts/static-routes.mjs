import { copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
for (const route of ['admin', 'privacidad', 'terminos']) {
  const directory = path.join(dist, route);
  await mkdir(directory, { recursive: true });
  await copyFile(path.join(dist, 'index.html'), path.join(directory, 'index.html'));
}
