'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { showSystem } from '@/lib/notif';
import { Bell, Download, Trash2, Upload, Users } from 'lucide-react';
import { read, write } from '@/lib/store';

const P = 'nimeku:';
// Hanya data milik Nimeku yang boleh dicadangkan/dipulihkan
const OK = /^(history|later|bookmark|recentSearch|res|rate|auto|skip|fit|notif|notifon|notifbrowser|eplast|accent|days|moments:[\w.-]+|seen:[\w.-]+|pos:[\w.-]+)$/;
const RATES = [0.75, 1, 1.25, 1.5, 2];
const ACCENTS = [['', 'Sakura', '#ff6b8b'], ['#ff9f5a', 'Jingga', '#ff9f5a'], ['#5fd39a', 'Hijau', '#5fd39a'], ['#62b6ff', 'Biru', '#62b6ff'], ['#b79bff', 'Ungu', '#b79bff'], ['#ff5a5a', 'Merah', '#ff5a5a']];
const RES = [['', 'Otomatis'], ['1080p', '1080p'], ['720p', '720p'], ['480p', '480p'], ['360p', '360p']];

const card = 'rounded-2xl bg-night ring-1 ring-edge p-4 space-y-4';
const Chip = ({ on, onClick, children }) => (
  <button type="button" onClick={onClick} aria-pressed={on}
    className={`rounded-full px-3.5 py-2 text-xs font-bold transition-colors ${on ? 'bg-sakura text-ink' : 'bg-ink text-mist ring-1 ring-edge'}`}>{children}</button>
);

export default function PengaturanPage() {
  const [auto, setAuto] = useState(true);
  const [res, setRes] = useState('');
  const [rate, setRate] = useState(1);
  const [accent, setAccent] = useState('');
  const [stat, setStat] = useState({ h: 0, l: 0, b: 0, s: 0 });
  const [msg, setMsg] = useState('');
  const [sure, setSure] = useState(false);
  const [nOn, setNOn] = useState(true);
  const [nSys, setNSys] = useState(false);
  const [nMsg, setNMsg] = useState('');
  const file = useRef(null);

  const load = () => {
    setAuto(read('auto', true));
    setRes(read('res', '') || '');
    setRate(read('rate', 1));
    setAccent(read('accent', '') || '');
    setNOn(read('notifon', true));
    setNSys(read('notifbrowser', false) && typeof Notification !== 'undefined' && Notification.permission === 'granted');
    let s = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith(`${P}seen:`)) s += (JSON.parse(localStorage.getItem(k)) || []).length;
      }
    } catch {}
    setStat({ h: read('history', []).length, l: read('later', []).length, b: read('bookmark', []).length, s });
  };
  useEffect(() => {
    load();
    window.addEventListener('nimeku:store', load);
    return () => window.removeEventListener('nimeku:store', load);
  }, []);

  const set = (k, v, fn) => { write(k, v, true); fn(v); };

  // Notifikasi sistem: perlu izin dari browser. Hanya muncul saat Nimeku terbuka (tanpa push dari server).
  const toggleSys = async () => {
    setNMsg('');
    if (nSys) { write('notifbrowser', false, true); setNSys(false); return; }
    if (typeof Notification === 'undefined') { setNMsg('Browser ini belum mendukung notifikasi sistem. Update tetap muncul di lonceng.'); return; }
    let perm = Notification.permission;
    if (perm === 'default') perm = await Notification.requestPermission();
    if (perm !== 'granted') { setNMsg('Izin notifikasi ditolak. Ubah di pengaturan situs pada browser, lalu coba lagi.'); return; }
    write('notifbrowser', true, true);
    setNSys(true);
    try { await navigator.serviceWorker?.register('/sw.js'); } catch {}
    setNMsg('Notifikasi sistem aktif.');
  };

  const testSys = async () => {
    const ok = await showSystem({ id: 'tes', title: 'Nimeku', ep: 1, from: 1, poster: '', epId: '' }, { force: true });
    setNMsg(ok ? 'Notifikasi tes dikirim. Cek bilah notifikasi HP kamu.' : 'Notifikasi tidak bisa ditampilkan. Pastikan izin notifikasi untuk situs ini diizinkan di browser.');
  };

  const backup = () => {
    const data = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k?.startsWith(P)) continue;
        const name = k.slice(P.length);
        if (OK.test(name)) data[name] = JSON.parse(localStorage.getItem(k));
      }
    } catch {}
    const blob = new Blob([JSON.stringify({ app: 'nimeku', v: 1, at: Date.now(), data })], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `nimeku-cadangan-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    setMsg('Cadangan diunduh. Simpan file-nya di tempat aman.');
  };

  const restore = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 2_000_000) { setMsg('File terlalu besar.'); return; }
    try {
      const j = JSON.parse(await f.text());
      if (j?.app !== 'nimeku' || typeof j.data !== 'object' || !j.data) throw new Error('bukan cadangan');
      let n = 0;
      for (const [k, v] of Object.entries(j.data)) {
        if (OK.test(k)) { localStorage.setItem(P + k, JSON.stringify(v)); n++; }
      }
      window.dispatchEvent(new Event('nimeku:store'));
      setMsg(`${n} data dipulihkan (menimpa data di perangkat ini).`);
    } catch { setMsg('File cadangan tidak valid.'); }
  };

  const wipe = () => {
    if (!sure) { setSure(true); setTimeout(() => setSure(false), 4000); return; }
    try {
      const del = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith(P) && k !== `${P}communityHideUntil`) del.push(k);
      }
      del.forEach((k) => localStorage.removeItem(k));
    } catch {}
    window.dispatchEvent(new Event('nimeku:store'));
    setSure(false);
    setMsg('Semua data di perangkat ini sudah dihapus.');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 pt-5 pb-28 space-y-5">
      <h1 className="font-display text-lg">Pengaturan</h1>

      <section className={card}>
        <h2 className="text-sm font-bold">Pemutar</h2>
        <button type="button" role="switch" aria-checked={auto} onClick={() => set('auto', !auto, setAuto)} className="w-full flex items-center justify-between gap-3 text-left">
          <span>
            <span className="block text-sm">Putar episode berikutnya otomatis</span>
            <span className="block text-xs text-mist">Pindah sendiri saat episode selesai</span>
          </span>
          <span className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${auto ? 'bg-sakura' : 'bg-ink ring-1 ring-edge'}`}>
            <span className={`absolute top-1 left-1 size-4 rounded-full bg-paper transition-transform ${auto ? 'translate-x-4' : ''}`} />
          </span>
        </button>
        <div className="space-y-2">
          <p className="text-xs text-mist">Kualitas awal</p>
          <div className="flex flex-wrap gap-2">{RES.map(([v, l]) => <Chip key={v} on={res === v} onClick={() => set('res', v, setRes)}>{l}</Chip>)}</div>
        </div>
        <div className="space-y-2">
          <p className="text-xs text-mist">Kecepatan awal</p>
          <div className="flex flex-wrap gap-2">{RATES.map((r) => <Chip key={r} on={rate === r} onClick={() => set('rate', r, setRate)}>{r}x</Chip>)}</div>
        </div>
      </section>

      <section className={card}>
        <h2 className="text-sm font-bold">Notifikasi</h2>
        <button type="button" role="switch" aria-checked={nOn} onClick={() => set('notifon', !nOn, setNOn)} className="w-full flex items-center justify-between gap-3 text-left">
          <span>
            <span className="block text-sm">Update episode baru</span>
            <span className="block text-xs text-mist">Memantau anime di bookmark, tonton nanti, dan riwayat</span>
          </span>
          <span className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${nOn ? 'bg-sakura' : 'bg-ink ring-1 ring-edge'}`}>
            <span className={`absolute top-1 left-1 size-4 rounded-full bg-paper transition-transform ${nOn ? 'translate-x-4' : ''}`} />
          </span>
        </button>
        <button type="button" role="switch" aria-checked={nSys} disabled={!nOn} onClick={toggleSys} className="w-full flex items-center justify-between gap-3 text-left disabled:opacity-50">
          <span>
            <span className="block text-sm">Notifikasi di HP/browser</span>
            <span className="block text-xs text-mist">Muncul di bilah notifikasi, hanya saat Nimeku sedang terbuka</span>
          </span>
          <span className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${nSys ? 'bg-sakura' : 'bg-ink ring-1 ring-edge'}`}>
            <span className={`absolute top-1 left-1 size-4 rounded-full bg-paper transition-transform ${nSys ? 'translate-x-4' : ''}`} />
          </span>
        </button>
        {nSys && <button type="button" onClick={testSys} className="text-xs font-bold text-sakura">Kirim notifikasi tes</button>}
        {nMsg && <p className="text-xs text-lantern" role="status">{nMsg}</p>}
        <Link href="/notifikasi" className="inline-flex items-center gap-2 rounded-xl bg-ink ring-1 ring-edge px-4 py-2.5 text-xs font-bold active:scale-95 transition-transform"><Bell className="size-4" /> Lihat daftar update</Link>
      </section>

      <section className={card}>
        <h2 className="text-sm font-bold">Tampilan</h2>
        <div className="space-y-2">
          <p className="text-xs text-mist">Warna aksen</p>
          <div className="flex flex-wrap gap-2">
            {ACCENTS.map(([v, l, c]) => (
              <button key={l} type="button" aria-pressed={accent === v}
                onClick={() => { write('accent', v, true); setAccent(v); window.dispatchEvent(new Event('nimeku:store')); }}
                className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-bold transition-colors ${accent === v ? 'bg-paper text-ink' : 'bg-ink text-mist ring-1 ring-edge'}`}>
                <span className="size-3.5 rounded-full" style={{ background: c }} /> {l}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className={card}>
        <h2 className="text-sm font-bold">Data di perangkat ini</h2>
        <div className="grid grid-cols-2 gap-2 text-center">
          {[['Riwayat', stat.h], ['Bookmark', stat.b], ['Tonton nanti', stat.l], ['Episode ditonton', stat.s]].map(([l, n]) => (
            <div key={l} className="rounded-xl bg-ink ring-1 ring-edge py-3">
              <p className="font-display text-xl text-lantern">{n}</p>
              <p className="text-[11px] text-mist">{l}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-mist leading-relaxed">Semua data tersimpan di browser ini saja, tanpa akun. Cadangkan sebelum ganti HP atau membersihkan data browser.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={backup} className="inline-flex items-center gap-2 rounded-xl bg-sakura text-ink px-4 py-2.5 text-xs font-bold active:scale-95 transition-transform"><Download className="size-4" /> Cadangkan</button>
          <button type="button" onClick={() => file.current?.click()} className="inline-flex items-center gap-2 rounded-xl bg-ink ring-1 ring-edge px-4 py-2.5 text-xs font-bold active:scale-95 transition-transform"><Upload className="size-4" /> Pulihkan</button>
          <input ref={file} type="file" accept="application/json,.json" onChange={restore} className="hidden" />
        </div>
        <button type="button" onClick={wipe} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold active:scale-95 transition ${sure ? 'bg-sakura text-ink' : 'bg-ink ring-1 ring-edge text-mist'}`}>
          <Trash2 className="size-4" /> {sure ? 'Yakin? Ketuk sekali lagi' : 'Hapus semua data'}
        </button>
        {msg && <p className="text-xs text-lantern" role="status">{msg}</p>}
      </section>

      <section className={card}>
        <h2 className="text-sm font-bold">Komunitas</h2>
        <p className="text-xs text-mist">Channel dan grup WhatsApp untuk info anime baru, request judul, dan bantuan.</p>
        <button type="button" onClick={() => window.dispatchEvent(new Event('nimeku:community'))} className="inline-flex items-center gap-2 rounded-xl bg-ink ring-1 ring-edge px-4 py-2.5 text-xs font-bold active:scale-95 transition-transform"><Users className="size-4" /> Buka komunitas</button>
      </section>
    </div>
  );
}
