// Tes menyeluruh. Pakai: node tes.mjs
// (server dev boleh menyala di terminal lain; ganti alamat dengan APP_URL=http://localhost:3005)
import fs from 'fs';
import crypto from 'node:crypto';

const API = 'https://anime.omnifylabs.sbs';
const APP = process.env.APP_URL || 'http://localhost:3005';
const env = fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : '';
const key = env.match(/OMNIFY_API_KEY=(.+)/)?.[1]?.trim() || '';

let fails = 0;
const ok = (cond, msg) => { if (!cond) fails++; console.log(`${cond ? '✓' : '✗'} ${msg}`); };
const get = async (url, opt = {}) => {
  try { return await fetch(url, { signal: AbortSignal.timeout(opt.timeout || 25000), ...opt }); }
  catch (e) { return { status: 0, headers: new Headers(), text: async () => '', body: null, error: e.message }; }
};
const secret = env.match(/TURNSTILE_SECRET_KEY=(.+)/)?.[1]?.trim();
// Tes tidak bisa menyelesaikan Turnstile, jadi membuat cookie lolos sendiri dengan kunci rahasia yang sama
const TES_UA = 'nimeku-tes';
const TES_IP = '203.0.113.9';
const hm = (m) => crypto.createHmac('sha256', secret).update(m).digest('hex');
const mkCookie = (ua, ip) => { const exp = Date.now() + 3600e3; const fp = hm(`${ip.split('.').slice(0, 3).join('.')}|${ua}`).slice(0, 24); return `${exp}.${fp}.${hm(`${exp}.${fp}`)}`; };
const cookie = secret ? mkCookie(TES_UA, TES_IP) : '';
const app = (p, opt = {}) => get(p.startsWith('http') ? p : APP + p, { ...opt, headers: { 'User-Agent': TES_UA, 'X-Forwarded-For': TES_IP, ...(cookie ? { Cookie: `nm_ok=${cookie}` } : {}), ...(opt.headers || {}) } });
const drop = async (r) => { try { await r.body?.cancel(); } catch {} };
const api = async (p) => {
  const r = await get(API + p, { headers: { 'X-API-Key': key } });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, data: j?.data ?? j };
};
const list = (d) => (Array.isArray(d) ? d : d && typeof d === 'object' ? Object.values(d).find(Array.isArray) || [] : []);

console.log('\n== 1. Kunci API ==');
ok(key.startsWith('omni_'), `.env.local berisi OMNIFY_API_KEY (${key ? key.slice(0, 10) + '...' : 'kosong'})`);

console.log('\n== 2. Endpoint API ==');
let first;
for (const p of [
  '/anime/ongoing?page=1&per_page=5', '/anime/latest?page=1&per_page=5', '/anime/popular?period=all&page=1&per_page=5',
  '/anime/donghua?page=1&per_page=5', '/anime/schedule?day=senin', '/anime/search?q=naruto&page=1&per_page=5',
]) {
  const r = await api(p); const l = list(r.data);
  ok(r.status === 200 && l.length > 0, `${p}  -> HTTP ${r.status}, ${l.length} item`);
  if (!first && l[0]) first = l[0];
}

const sch = await api('/anime/schedule?day=senin');
console.log('   bentuk jadwal:', JSON.stringify(sch.data).slice(0, 250));
const id = process.argv[2] ? process.argv[2].replace(/-ep-\d+$/, '') : first?.id || first?.slug; // node tes.mjs <id-episode> untuk menguji episode tertentu
const epNo = first?.current_episode || 1;
const epId = process.argv[2] || `${id}-ep-${epNo}`;
let streamUrl;
let q1 = '720p';
let s1 = 1;
let f1 = 'mp4';

if (id) {
  console.log(`\n== 3. Detail dan episode (${id}) ==`);
  const d = await api(`/anime/detail?id=${encodeURIComponent(id)}`);
  ok(d.status === 200 && d.data?.title, `detail: ${d.data?.title || 'gagal'} (HTTP ${d.status})`);
  console.log('   field episode di detail:', Object.keys(d.data || {}).filter((k) => /episode/i.test(k)).join(', ') || '(tidak ada)');
  const e = await api(`/anime/episode?id=${encodeURIComponent(epId)}`);
  const streams = e.data?.streams || [];
  ok(e.status === 200 && streams.length > 0, `episode ${epId}: ${streams.length} stream (HTTP ${e.status})`);
  streams.forEach((s) => console.log(`   ${s.server} | ${s.quality} | ${s.format}`));
  // pilih stream yang paling mudah diputar: mp4, lalu hls, lalu iframe
  const rk = (x) => ({ mp4: 0, hls: 1 }[x.format] ?? 2);
  const pick = [...streams].sort((a, b) => rk(a) - rk(b))[0];
  streamUrl = pick?.stream_url;
  q1 = String(pick?.quality || '').toLowerCase();
  s1 = +String(pick?.server || '').match(/server\s*(\d+)/i)?.[1] || 1;
  f1 = pick?.format || 'mp4';
  if (streamUrl) {
    const r = await get(streamUrl, { headers: { 'X-API-Key': key, Range: 'bytes=0-1023', Referer: API + '/' } });
    ok([200, 206].includes(r.status), `video langsung dari API: HTTP ${r.status} (${r.headers.get('content-type')})`);
    await drop(r);
  }
}

console.log(`\n== 4. Aplikasi Nimeku di ${APP} ==`);
const pages = ['/', '/riwayat', '/simpan', '/jelajah?tab=donghua', '/jelajah', '/jelajah?q=naruto', '/jadwal', '/donghua', `/anime/${id}`, `/watch/${epId}`];
let up = true;
for (const p of pages) {
  const r = await app(p);
  if (!r.status) { ok(false, `Server tidak menyala (${r.error}). Jalankan "npm run dev" di terminal lain`); up = false; break; }
  const t = await r.text();
  const empty = !/^\/(riwayat|simpan)/.test(p) && /Data belum bisa|Jadwal belum|Belum ada|tidak ditemukan|Build Error|ReferenceError|Application error/i.test(t);
  ok(r.status === 200 && !empty, `${p}  -> HTTP ${r.status}${empty ? ' (halaman kosong atau error)' : ''}`);
}

if (up && secret) {
  const none = { 'User-Agent': 'Mozilla/5.0 (tes)' };
  const g = await get(APP + '/', { headers: none });
  ok(/verifikasi keamanan/i.test(await g.text()), 'gerbang aktif: tanpa cookie, halaman verifikasi tampil di alamat yang sama');
  const sc = await get(APP + '/', { headers: { 'User-Agent': 'curl/8.5.0' } });
  ok(sc.status === 403, `skrip (curl) ditolak: HTTP ${sc.status} (harus 403)`);
  const stolen = await get(APP + '/', { headers: { 'User-Agent': 'Mozilla/5.0 (perangkat lain)', 'X-Forwarded-For': TES_IP, Cookie: `nm_ok=${cookie}` } });
  ok(/verifikasi keamanan/i.test(await stolen.text()), 'cookie curian ditolak: dipakai dari perangkat/UA lain, diminta verifikasi ulang');
  const hot = await app(`${APP}/api/stream?ep=x&q=720p&s=1`, { headers: { 'Sec-Fetch-Site': 'cross-site' } });
  ok(hot.status === 403, `hotlink dari situs lain ditolak: HTTP ${hot.status} (harus 403)`);
}

if (up) {
  const ac = await app('/acak', { redirect: 'manual' });
  ok(ac.status === 307, `/acak mengarahkan ke anime acak: HTTP ${ac.status} (harus 307)`);
}

if (up && streamUrl) {
  console.log('\n== 5. Proxy video dan download (mode episode) ==');
  const base = `${APP}/api/stream?ep=${encodeURIComponent(epId)}&q=${q1}&s=${s1}&f=${f1}`;
  const v = await app(base, { timeout: 70000, headers: { Range: 'bytes=0-1023' } }); // permintaan pertama ke server video bisa lambat
  ok([200, 206].includes(v.status), `putar (${f1}): HTTP ${v.status}${v.error ? ` (${v.error})` : ''}, ${v.headers.get('content-type')}, range ${v.headers.get('content-range') || '-'}`);
  await drop(v);
  if (f1 === 'mp4') {
    const dl = await app(`${base}&download=1&filename=tes.mp4`, { headers: { Range: 'bytes=0-1' } });
    ok((dl.headers.get('content-disposition') || '').includes('attachment'), `unduh: header attachment, HTTP ${dl.status}`);
    await drop(dl);
  } else console.log('- unduh dilewati: stream pilihan bukan mp4');
  const bad = await app(`${APP}/api/stream?url=${encodeURIComponent('http://127.0.0.1:22')}`);
  ok(bad.status === 400, `menolak alamat internal: HTTP ${bad.status} (harus 400)`);
}

console.log('\n== 6. Kunci Turnstile ==');
if (!secret) ok(false, 'TURNSTILE_SECRET_KEY belum ada di .env.local');
else {
  const r = await get('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: new URLSearchParams({ secret, response: 'tes' }) });
  const j = r.status ? await r.json().catch(() => null) : null;
  const codes = j?.['error-codes'] || [];
  ok(codes.includes('invalid-input-response') && !codes.includes('invalid-input-secret'), `secret key diterima Cloudflare (kode: ${codes.join(', ') || 'tidak ada respons'})`);
}

console.log(fails ? `\n${fails} tes gagal. Kirim screenshot hasil ini.` : '\nSemua tes lulus.');
