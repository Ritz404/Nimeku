// Dipakai pm2 (npm run serve). Jika folder .next belum ada, bangun dulu; jika build gagal, tunggu 60 detik
// sebelum keluar supaya pm2 tidak mengulang tanpa henti dan memenuhi log.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const PORT = process.env.PORT || '3005';
const NEXT = path.resolve('node_modules/next/dist/bin/next');
const env = { ...process.env, NODE_OPTIONS: '--dns-result-order=ipv4first' };
const fail = (msg) => { console.error(`[serve] ${msg}`); setTimeout(() => process.exit(1), 60000); };

if (!fs.existsSync(NEXT)) {
  console.log('[serve] node_modules belum ada, menjalankan npm install...');
  spawnSync('npm', ['install'], { stdio: 'inherit', env });
}
if (!fs.existsSync(NEXT)) fail('npm install gagal.');
else {
  if (!fs.existsSync('.next/BUILD_ID')) {
    console.log('[serve] .next belum ada, membangun dulu...');
    const r = spawnSync(process.execPath, [NEXT, 'build'], { stdio: 'inherit', env });
    if (r.status !== 0) fail('build GAGAL. Perbaiki error di atas lalu jalankan: pm2 restart nimeku');
  }
  if (fs.existsSync('.next/BUILD_ID')) {
    const p = spawn(process.execPath, [NEXT, 'start', '-p', PORT], { stdio: 'inherit', env });
    p.on('exit', (c) => process.exit(c ?? 0));
    for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => p.kill(sig));
  }
}
