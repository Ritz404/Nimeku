// Pantau perubahan file/folder, lalu bangun ulang dan restart server otomatis.
// Pakai: node watch.mjs   (atau: npm run watch)
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const PORT = process.env.PORT || '3005';
const NEXT = path.resolve('node_modules/next/dist/bin/next');
const ENV = { ...process.env, NODE_OPTIONS: '--dns-result-order=ipv4first' };
const WATCH = ['src', 'public', 'package.json', 'next.config.mjs', 'postcss.config.mjs', 'jsconfig.json', '.env.local'];
const STAMP = '.next/.nimeku-hash'; // sidik isi file saat build terakhir berhasil
const log = (m) => console.log(`[watch ${new Date().toLocaleTimeString('id-ID')}] ${m}`);

let server = null;
let building = false;
let pending = false;
let timer = null;

function listFiles() {
  const out = [];
  const walk = (p) => {
    let st;
    try { st = fs.statSync(p); } catch { return; }
    if (st.isDirectory()) for (const f of fs.readdirSync(p).sort()) walk(path.join(p, f));
    else out.push([p, st]);
  };
  WATCH.forEach(walk);
  return out;
}
// Cek cepat (nama + waktu ubah + ukuran) untuk mendeteksi ada yang berubah
const signature = () => listFiles().map(([p, st]) => `${p}:${st.mtimeMs}:${st.size}`).join(';');
// Sidik isi file: menentukan apakah build ulang benar-benar perlu (unzip file yang sama tidak memicu build)
const contentHash = () => {
  const h = crypto.createHash('sha1');
  for (const [p] of listFiles()) { h.update(p); try { h.update(fs.readFileSync(p)); } catch {} }
  return h.digest('hex');
};
const readStamp = () => { try { return fs.readFileSync(STAMP, 'utf8').trim(); } catch { return ''; } };

const run = (cmd, args) => new Promise((resolve) => {
  const p = spawn(cmd, args, { stdio: 'inherit', env: ENV });
  p.on('exit', (c) => resolve(c));
  p.on('error', () => resolve(1));
});

const stop = () => new Promise((resolve) => {
  if (!server) return resolve();
  const s = server;
  server = null; // dikosongkan dulu agar tidak dianggap crash
  s.once('exit', resolve);
  s.kill('SIGTERM');
  setTimeout(() => s.kill('SIGKILL'), 4000);
});

// Bebaskan port jika masih dipegang proses lama (mis. server yang tertinggal setelah update)
function freePort() {
  try { spawnSync('fuser', ['-k', `${PORT}/tcp`], { stdio: 'ignore' }); } catch {}
}

function start() {
  freePort();
  const me = spawn(process.execPath, [NEXT, 'start', '-p', PORT], { stdio: 'inherit', env: ENV });
  server = me;
  me.on('exit', (c) => {
    if (server === me) { log(`server berhenti (kode ${c}), dihidupkan lagi...`); server = null; setTimeout(start, 2000); }
  });
  log(`server berjalan di port ${PORT}`);
}

// Jika daftar dependensi berubah (package.json), npm install dijalankan dulu
const depsOf = () => { try { const j = JSON.parse(fs.readFileSync('package.json', 'utf8')); return JSON.stringify([j.dependencies, j.devDependencies]); } catch { return ''; } };
let deps = depsOf();

async function rebuild() {
  if (building) { pending = true; return; }
  building = true;
  log('perubahan terdeteksi, membangun ulang...');
  await stop();
  const d = depsOf();
  if (d !== deps) { log('dependensi berubah, menjalankan npm install...'); await run('npm', ['install']); deps = d; }
  const hash = contentHash();
  const code = await run(process.execPath, [NEXT, 'build']);
  if (code === 0) {
    try { fs.writeFileSync(STAMP, hash); } catch {}
    start();
  } else log('build GAGAL. Perbaiki file lalu simpan ulang; server belum dijalankan.');
  building = false;
  if (pending) { pending = false; rebuild(); }
}

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => { await stop(); process.exit(0); });

(async () => {
  log(`memantau: ${WATCH.join(', ')}`);
  let last = signature();
  // Saat dinyalakan: kalau isi file beda dengan build terakhir (misalnya baru di-unzip), bangun ulang dulu
  if (!fs.existsSync('.next/BUILD_ID') || readStamp() !== contentHash()) await rebuild();
  else start();
  setInterval(() => {
    const now = signature();
    if (now === last) return;
    last = now;
    clearTimeout(timer);
    timer = setTimeout(() => { if (contentHash() !== readStamp()) rebuild(); }, 2500); // tunggu unzip selesai
  }, 2000);
})();
