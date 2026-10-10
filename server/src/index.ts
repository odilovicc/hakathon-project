import { createApp } from './app.js';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { openDb, SERVER_ROOT } from './db.js';

const envFile = resolve(SERVER_ROOT, '..', '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const PORT = Number(process.env.PORT ?? 3001);

const db = openDb();
createApp(db).listen(PORT, () => {
  console.log(`Kubyshka API: http://localhost:${PORT}`);
});
