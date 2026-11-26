// Pakai: node peek.mjs "/anime/ongoing?page=1&per_page=2"
// Menampilkan nama field dan tipe data dari API (ringkas, tidak terpotong)
import fs from 'fs';
const env = fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : '';
const key = env.match(/OMNIFY_API_KEY=(.+)/)?.[1]?.trim() || '';
const path = process.argv[2] || '/anime/ongoing?page=1&per_page=2';
const r = await fetch('https://anime.omnifylabs.sbs' + path, { headers: { 'X-API-Key': key } });
const j = await r.json();
const shape = (v, d = 0) => {
  if (Array.isArray(v)) return `[${v.length}] ` + (v.length ? shape(v[0], d) : '');
  if (v && typeof v === 'object') {
    if (d > 2) return '{...}';
    return '{ ' + Object.entries(v).map(([k, x]) => `${k}: ${shape(x, d + 1)}`).join(', ') + ' }';
  }
  return typeof v === 'string' ? JSON.stringify(v.slice(0, 30)) : String(v);
};
console.log('HTTP', r.status);
const data = j.data ?? j;
if (data && typeof data === 'object' && !Array.isArray(data)) {
  for (const [k, v] of Object.entries(data)) console.log(k, '=', shape(v, 1));
} else console.log(shape(data));
