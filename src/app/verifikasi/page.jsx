'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';

// Site key bersifat publik (aman ada di kode). Kunci rahasia hanya di .env.local
const SITEKEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '0x4AAAAAAF5CNjddPZwJfHJz';

// CSS ditanam langsung di halaman (bukan lewat Tailwind), jadi tampilan tetap rapi walau file CSS situs
// gagal dimuat, tertahan cache Cloudflare, atau diblokir peramban.
const CSS = `
html,body{margin:0;padding:0;background:#000;color-scheme:dark}
.vf{min-height:100vh;min-height:100dvh;display:flex;flex-direction:column;background:#000;color:#ececec;font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;-webkit-text-size-adjust:100%}
.vf *{box-sizing:border-box}
.vf-main{flex:none;width:100%;min-height:100vh;min-height:100svh;max-width:768px;margin:0 auto;padding:6vh 16px 40px}
.vf-head{display:flex;align-items:center;gap:14px}
.vf-ico{width:36px;height:36px;border-radius:8px;flex:none;display:block}
.vf h1{margin:0;font-weight:300;font-size:clamp(1.5rem,7vw,2.75rem);line-height:1.15;word-break:break-all}
.vf h2{margin:12px 0 0;font-weight:400;font-size:clamp(1.15rem,4.6vw,1.75rem)}
.vf .lead{margin:12px 0 0;font-size:clamp(.95rem,3.8vw,1.25rem);line-height:1.6;color:#a3a3a3}
.vf-box{margin-top:24px;min-height:80px;width:100%;overflow:visible}
.vf-widget{width:300px;min-height:65px;overflow:visible;transform-origin:0 0}
@media (max-width:339px){.vf-widget{transform:scale(.88)}}
.vf-msg{margin:0;font-size:clamp(1.1rem,4.6vw,1.6rem);line-height:1.35}
.vf-btn{margin-top:12px;background:none;color:#ececec;border:1px solid #555;border-radius:4px;padding:8px 16px;font:inherit;font-size:14px;cursor:pointer}
.vf-btn:active{background:#222}
.vf-spin{display:block;width:28px;height:28px;border-radius:50%;border:2px solid #666;border-top-color:transparent;animation:vf-spin .8s linear infinite}
@keyframes vf-spin{to{transform:rotate(360deg)}}
.vf-foot{width:100%;max-width:768px;margin:0 auto;padding:0 16px 28px}
.vf-foot div{border-top:1px solid #3a3a3a;padding-top:16px;text-align:center;font-size:12px;color:#d0d0d0}
.vf-foot p{margin:4px 0}
.vf-foot code{font-family:ui-monospace,Menlo,Consolas,monospace}
.vf-foot a{color:#8ab4f8;text-decoration:underline}
`;

// Halaman tantangan bergaya Cloudflare: tampil di alamat yang sama, lalu situs terbuka otomatis setelah lolos
export default function VerifikasiPage() {
  const box = useRef(null);
  const widgetId = useRef(null);
  const [ready, setReady] = useState(false);
  const [host, setHost] = useState('');
  const [ray, setRay] = useState('');
  const [phase, setPhase] = useState('loading'); // loading | widget | checking | ok | fail

  useEffect(() => {
    setHost(location.host);
    document.title = 'Memverifikasi… | Nimeku';
    fetch('/api/turnstile').then((r) => r.json()).then((j) => setRay(j.ray || '')).catch(() => {});
  }, []);

  const verify = async (token) => {
    setPhase('checking');
    try {
      const r = await fetch('/api/turnstile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
      if (r.ok) {
        setPhase('ok');
        const next = new URLSearchParams(location.search).get('next');
        setTimeout(() => {
          // dibuka lewat alamat apa pun: muat ulang alamat itu; dibuka langsung: ke beranda
          if (location.pathname === '/verifikasi') location.replace(next?.startsWith('/') && !next.startsWith('//') ? next : '/');
          else location.reload();
        }, 800);
        return;
      }
    } catch {}
    setPhase('fail');
  };

  useEffect(() => {
    if (!ready || !box.current || !window.turnstile) return;
    widgetId.current = window.turnstile.render(box.current, {
      sitekey: SITEKEY, action: 'gate', theme: 'dark', size: 'normal', callback: verify,
      'error-callback': () => setPhase('fail'),
      'expired-callback': () => window.turnstile.reset(widgetId.current),
    });
    setPhase('widget');
    return () => window.turnstile?.remove?.(widgetId.current);
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const retry = () => { setPhase('widget'); window.turnstile?.reset(widgetId.current); };

  const hide = phase === 'ok' || phase === 'fail';

  return (
    <div className="vf">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={() => setReady(true)} />

      <main className="vf-main">
        <div className="vf-head">
          <img src="/icon.svg" alt="" width="36" height="36" className="vf-ico" />
          <h1>{host || '\u00a0'}</h1>
        </div>
        <h2>Melakukan verifikasi keamanan</h2>
        <p className="lead">
          Situs web menggunakan layanan keamanan untuk melindungi dari bot jahat. Halaman ini ditunjukkan semasa kami memverifikasi bahwa Anda bukan bot.
        </p>

        <div className="vf-box">
          {phase === 'loading' && <span className="vf-spin" role="status" aria-label="Memuat" />}
          <div ref={box} className="vf-widget" style={hide ? { display: 'none' } : undefined} />
          {phase === 'ok' && <p className="vf-msg" role="status">Verifikasi berhasil. Menunggu response dari {host}...</p>}
          {phase === 'fail' && (
            <div role="alert">
              <p className="vf-msg">Verifikasi gagal.</p>
              <button type="button" onClick={retry} className="vf-btn">Coba lagi</button>
            </div>
          )}
        </div>
      </main>

      <footer className="vf-foot">
        <div>
          {ray && <p>Ray ID: <code>{ray}</code></p>}
          <p>
            Performa dan Keamanan dari{' '}
            <a href="https://www.cloudflare.com/" target="_blank" rel="noopener noreferrer">Cloudflare</a>
            <span style={{ margin: '0 8px' }}>|</span>
            <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">Privasi</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
