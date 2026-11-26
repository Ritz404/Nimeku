// Token verifikasi Turnstile yang terikat ke perangkat: "<kedaluwarsa>.<sidik jari>.<tanda tangan>".
// Sidik jari = IP (dibulatkan) + User-Agent. Cookie yang dicuri atau dibagikan ke bot lain tidak berlaku.
// Memakai Web Crypto supaya jalan di middleware (Edge) maupun di Node.
export const COOKIE = 'nm_ok';
export const TTL_MS = 6 * 60 * 60 * 1000; // 6 jam
const enc = new TextEncoder();

async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Bandingkan tanpa berhenti di karakter pertama yang beda
function same(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// IP asli dari Cloudflare (header cf-connecting-ip), cadangan: X-Forwarded-For
export const clientIp = (h) => h.get('cf-connecting-ip') || (h.get('x-forwarded-for') || '').split(',')[0].trim() || '';

// IPv4 dibulatkan ke /24 dan IPv6 ke /64: berpindah menara seluler tidak langsung memicu verifikasi ulang
export function ipPrefix(ip) {
  return ip.includes(':') ? ip.split(':').slice(0, 4).join(':') : ip.split('.').slice(0, 3).join('.');
}

export async function fingerprint(secret, ip, ua) {
  return (await hmac(secret, `${ipPrefix(ip || '')}|${ua || ''}`)).slice(0, 24);
}

export async function makeToken(secret, ip, ua) {
  const exp = Date.now() + TTL_MS;
  const fp = await fingerprint(secret, ip, ua);
  return `${exp}.${fp}.${await hmac(secret, `${exp}.${fp}`)}`;
}

export async function checkToken(secret, token, ip, ua) {
  if (!token) return false;
  const [exp, fp, sig] = String(token).split('.');
  if (!exp || !fp || !sig || Number(exp) < Date.now()) return false;
  const signed = same(await hmac(secret, `${exp}.${fp}`), sig);
  const mine = same(await fingerprint(secret, ip, ua), fp);
  return signed && mine;
}
