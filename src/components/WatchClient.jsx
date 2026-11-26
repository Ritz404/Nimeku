'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, ArrowRight, Download, Flag, Loader2, Maximize, Minimize, Moon, Pause, PictureInPicture2, Play,
  RotateCcw, RotateCw, Settings, SkipForward, TriangleAlert, Volume2, VolumeX, X,
} from 'lucide-react';
import Loader from '@/components/Loader';
import SaveButtons from '@/components/SaveButtons';
import { read, write, remove, markSeen, touchDay } from '@/lib/store';
import { fsFlag } from '@/lib/fsflag';
const isHls = (u) => /\.m3u8(\?|$)/i.test(u);
const resOf = (s) => (`${s.resolution || ''} ${s.label || ''} ${s.quality || ''} ${s.name || ''}`.match(/(\d{3,4})p/i)?.[0] || 'Auto').toLowerCase();
const resValue = (r) => parseInt(r, 10) || 0; // 1080p -> 1080, untuk mengurutkan
const pad = (n) => String(n).padStart(2, '0');
const clock = (s) => {
  if (!Number.isFinite(s)) return '00:00';
  const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = Math.floor(s % 60);
  return h ? `${h}:${pad(m)}:${pad(x)}` : `${pad(Math.floor(s / 60))}:${pad(x)}`;
};
const fmt = (s) => `${Math.floor(s / 60)}:${pad(Math.floor(s % 60))}`;
const RATES = [0.75, 1, 1.25, 1.5, 2];
const SKIPS = [5, 10, 15, 30];
const FITS = [['contain', 'Pas'], ['cover', 'Isi layar'], ['fill', 'Regang']];
const rank = (f) => (f === 'mp4' ? 0 : f === 'hls' ? 1 : 2); // mp4 paling mudah diputar, iframe paling akhir

// Preferensi, posisi tonton, dan riwayat disimpan di browser (tanpa memicu render ulang)
const store = { get: read, set: (k, v) => write(k, v, true), del: (k) => remove(k, true) };

function Seek10({ back, n = 10 }) {
  const Icon = back ? RotateCcw : RotateCw;
  return (
    <span className="relative grid place-items-center size-12 active:scale-90 transition-transform">
      <Icon className="size-12 text-white" strokeWidth={1.4} />
      <span className="absolute text-[13px] font-bold text-white">{n}</span>
    </span>
  );
}

const Chip = ({ on, onClick, children }) => (
  <button type="button" onClick={onClick} aria-pressed={on}
    className={`rounded-full px-3 py-1.5 text-xs font-bold active:scale-95 transition ${on ? 'bg-sakura text-ink' : 'bg-ink ring-1 ring-edge text-mist'}`}>
    {children}
  </button>
);
const Row = ({ label, children }) => (
  <div className="space-y-1.5">
    <p className="text-[11px] font-bold text-mist">{label}</p>
    <div className="flex flex-wrap gap-1.5">{children}</div>
  </div>
);

// Pemutar dengan kontrol sendiri di dalam video (menggantikan kontrol bawaan browser)
function Player({ playUrl, kind, embedUrl, resume, vref, posKey, rate, poster, title, settings, skip = 10, fit = 'contain', loop = false, nextHref, nextNum, onNext, onEnded, onResumed, onProgress, onFail }) {
  const boxRef = useRef(null);
  const hideT = useRef(null);
  const playingRef = useRef(false);
  const [state, setState] = useState('loading'); // loading | ready | failed
  const [tries, setTries] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [muted, setMuted] = useState(false);
  const [ui, setUi] = useState(true);
  const [menu, setMenu] = useState(false);
  const [fs, setFs] = useState(() => typeof document !== 'undefined' && fsFlag.on && !!document.fullscreenElement);
  const [canPip, setCanPip] = useState(false);
  const [drag, setDrag] = useState(null);
  const [why, setWhy] = useState('');
  const rateRef = useRef(rate); rateRef.current = rate;
  const skipRef = useRef(skip); skipRef.current = skip;
  const fsRef = useRef(null); // selalu menunjuk toggleFs terbaru (dipakai handler keyboard)
  const thr = useRef(false); // true = kecepatan sementara diturunkan ke 1x karena buffer menipis
  const [throttled, setThrottled] = useState(false);
  const lastTap = useRef({ t: 0, x: 0 });
  const flashT = useRef(null);
  const [flash, setFlash] = useState(null); // umpan balik ketuk dua kali: { side, n }
  const endedRef = useRef(onEnded); endedRef.current = onEnded;
  const resumedRef = useRef(onResumed); resumedRef.current = onResumed;
  const progressRef = useRef(onProgress); progressRef.current = onProgress;
  const failRef = useRef(onFail); failRef.current = onFail;

  // Kontrol tampil saat disentuh, lalu menghilang sendiri 3 detik setelahnya (hanya saat video berjalan)
  const poke = () => {
    setUi(true);
    clearTimeout(hideT.current);
    if (playingRef.current) hideT.current = setTimeout(() => { setUi(false); setMenu(false); }, 3200);
  };

  useEffect(() => {
    const v = vref.current;
    if (!v) return;
    let h, wd;
    let dead = false;
    let last = 0;
    setState('loading');
    setWaiting(false);
    setWhy('');
    thr.current = false;
    setThrottled(false);
    if (kind === 'iframe') { setState('ready'); return; } // halaman embed: tidak butuh elemen video

    const onMeta = () => {
      setDur(v.duration || 0);
      v.playbackRate = rateRef.current;
      // Prioritas: posisi sebelum ganti kualitas, lalu posisi tersimpan dari kunjungan lalu
      let t = resume.current.time;
      if (!t) {
        const saved = store.get(posKey, 0);
        if (saved > 15 && saved < v.duration - 30) { t = saved; resumedRef.current(saved); }
      }
      if (t) v.currentTime = t;
      if (resume.current.playing) v.play().catch(() => {});
      setState('ready');
    };
    const onErr = async () => {
      const code = v.error?.code;
      if (failRef.current()) return; // coba server/kualitas lain dulu
      setState('failed');
      // Detail teknis hanya ke console; pengunjung cukup melihat pesan singkat tanpa alamat server
      console.warn('[player] gagal, kode browser', code ?? '-');
      if (!dead) setWhy('Video belum bisa diputar. Coba ganti server atau kualitas lain.');
    };
    const onTime = () => {
      setTime(v.currentTime);
      if (!v.paused && v.readyState >= 3) setWaiting(false); // video jalan = tidak sedang menunggu
      const n = Date.now();
      if (n - last > 4000) { last = n; store.set(posKey, Math.floor(v.currentTime)); progressRef.current(v.currentTime, v.duration); }
    };
    const onPlay = () => { playingRef.current = true; setPlaying(true); poke(); };
    const onPause = () => {
      playingRef.current = false; setPlaying(false); setUi(true); clearTimeout(hideT.current);
      if (v.currentTime > 5) { store.set(posKey, Math.floor(v.currentTime)); progressRef.current(v.currentTime, v.duration); }
    };
    const onWait = () => setWaiting(true);
    const onReady = () => setWaiting(false);
    const onVol = () => setMuted(v.muted);
    const onEnd = () => endedRef.current();
    const ev = { loadedmetadata: onMeta, durationchange: () => setDur(v.duration || 0), error: onErr, timeupdate: onTime, play: onPlay, pause: onPause,
      waiting: onWait, seeking: onWait, playing: onReady, canplay: onReady, canplaythrough: onReady, loadeddata: onReady, seeked: onReady, volumechange: onVol, ended: onEnd };
    Object.entries(ev).forEach(([k, f]) => v.addEventListener(k, f));
    // Penjaga: kadang browser tidak mengirim event "playing" setelah macet sebentar, jadi cek langsung kondisi video
    const ahead = () => {
      const b = v.buffered;
      for (let i = 0; i < b.length; i++) if (b.start(i) <= v.currentTime + 0.3 && b.end(i) >= v.currentTime) return b.end(i) - v.currentTime;
      return 0;
    };
    wd = setInterval(() => {
      if (dead) return;
      if (!v.paused && v.readyState >= 3) {
        setWaiting(false);
        setState((st) => (st === 'loading' ? 'ready' : st));
      }
      // Dipercepat (mis. 2x) membuat buffer cepat habis bila koneksi/server lambat, lalu video macet berulang.
      // Saat buffer menipis, kecepatan turun ke 1x sementara; kembali ke pilihan semula setelah buffer terisi.
      const want = rateRef.current;
      if (want <= 1) { if (thr.current) { thr.current = false; setThrottled(false); } return; }
      if (v.paused || v.seeking || !v.duration) return;
      const a = ahead();
      const nearEnd = v.duration - v.currentTime < 20;
      if (!thr.current && !nearEnd && (v.readyState < 3 || a < 2.5)) {
        thr.current = true; v.playbackRate = 1; setThrottled(true);
      } else if (thr.current && (a >= 12 || nearEnd)) {
        thr.current = false; v.playbackRate = want; setThrottled(false);
      } else if (thr.current && v.playbackRate !== 1) v.playbackRate = 1;
    }, 500);

    if (kind === 'hls' && !v.canPlayType('application/vnd.apple.mpegurl')) {
      // Chrome/Firefox tidak bisa memutar HLS sendiri, jadi pakai hls.js
      import('hls.js').then(({ default: Hls }) => {
        if (dead) return;
        if (!Hls.isSupported()) return setState('failed');
        h = new Hls();
        h.loadSource(playUrl);
        h.attachMedia(v);
        h.on(Hls.Events.ERROR, (_, d) => d.fatal && setState('failed'));
      });
    } else {
      v.src = playUrl;
    }

    return () => {
      dead = true;
      clearInterval(wd);
      clearTimeout(hideT.current);
      resume.current = { time: v.currentTime, playing: !v.paused };
      Object.entries(ev).forEach(([k, f]) => v.removeEventListener(k, f));
      h?.destroy();
      v.removeAttribute('src');
      v.load();
    };
  }, [playUrl, kind, tries, resume, vref, posKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = () => { const v = vref.current; if (v) (v.paused ? v.play().catch(() => {}) : v.pause()); };
  const seekBy = (d) => { const v = vref.current; if (v) v.currentTime = Math.max(0, Math.min(v.duration || 1e9, v.currentTime + d)); };
  // Layar penuh + otomatis miring (landscape), meski HP sedang mengunci rotasi. iPhone memakai pemutar bawaan.
  // Yang dilayarpenuhkan adalah seluruh halaman dan pemutar dibentangkan menutup layar. Dengan begitu layar penuh
  // dan posisi miring tetap bertahan ketika pindah ke episode berikutnya (halaman diganti, dokumen tidak).
  const toggleFs = async () => {
    if (fs) {
      fsFlag.on = false;
      setFs(false);
      try { if (document.fullscreenElement) await document.exitFullscreen(); } catch {}
      try { screen.orientation.unlock(); } catch {}
      return;
    }
    try {
      const root = document.documentElement;
      if (root.requestFullscreen) {
        await root.requestFullscreen({ navigationUI: 'hide' });
        fsFlag.on = true;
        setFs(true);
        try { await screen.orientation.lock('landscape'); } catch {} // tidak semua browser mendukung
      } else vref.current?.webkitEnterFullscreen?.();
    } catch {}
  };
  fsRef.current = toggleFs;
  const togglePip = async () => {
    try { document.pictureInPictureElement ? await document.exitPictureInPicture() : await vref.current.requestPictureInPicture(); } catch {}
  };
  const act = (fn) => (e) => { e.stopPropagation(); fn(); poke(); };
  // Ketuk dua kali di sisi kiri/kanan layar video untuk mundur/maju; ketuk sekali menampilkan atau menyembunyikan kontrol
  const onTap = (e) => {
    const now = Date.now();
    const r = boxRef.current?.getBoundingClientRect();
    const x = r ? (e.clientX - r.left) / r.width : 0.5;
    const dbl = kind !== 'iframe' && now - lastTap.current.t < 300 && (x < 0.38 || x > 0.62) && Math.abs(x - lastTap.current.x) < 0.25;
    lastTap.current = { t: dbl ? 0 : now, x };
    if (dbl) {
      const back = x < 0.5;
      seekBy(back ? -skipRef.current : skipRef.current);
      setFlash({ side: back ? 'l' : 'r', n: skipRef.current });
      clearTimeout(flashT.current);
      flashT.current = setTimeout(() => setFlash(null), 600);
      poke();
      return;
    }
    if (ui && playingRef.current) { setUi(false); setMenu(false); } else poke();
  };
  const commit = () => { if (drag != null) { const v = vref.current; if (v) v.currentTime = drag; setDrag(null); } };

  useEffect(() => {
    const onFs = () => {
      if (!document.fullscreenElement) { fsFlag.on = false; setFs(false); }
      if (!document.fullscreenElement) { try { screen.orientation.unlock(); } catch {} } // kembalikan rotasi normal
    };
    document.addEventListener('fullscreenchange', onFs);
    setCanPip(!!document.pictureInPictureEnabled);
    // Pintasan keyboard (desktop): spasi/k, panah kiri-kanan, f, m
    const onKey = (e) => {
      const t = e.target;
      if (t?.tagName === 'TEXTAREA' || (t?.tagName === 'INPUT' && t.type !== 'range')) return;
      if (e.key === ' ' || e.key === 'k') { if (t?.tagName !== 'BUTTON') { e.preventDefault(); toggle(); } }
      else if (e.key === 'ArrowLeft') seekBy(-skipRef.current);
      else if (e.key === 'ArrowRight') seekBy(skipRef.current);
      else if (e.key === 'f') fsRef.current?.();
      else if (e.key === 'm') { const v = vref.current; if (v) v.muted = !v.muted; }
    };
    window.addEventListener('keydown', onKey);
    // Pemutar hilang dan tidak ada pemutar baru dalam 15 detik (pindah ke halaman lain): keluar dari layar penuh
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      window.removeEventListener('keydown', onKey);
      if (fsFlag.on) setTimeout(() => { if (!document.querySelector('[data-player]')) { fsFlag.on = false; try { document.exitFullscreen?.(); } catch {} } }, 15000);
    };
  }, []);

  // Selama layar penuh, halaman di belakang tidak ikut bergulir
  useEffect(() => {
    document.documentElement.style.overflow = fs ? 'hidden' : '';
    return () => { document.documentElement.style.overflow = ''; };
  }, [fs]); // eslint-disable-line react-hooks/exhaustive-deps

  const busy = state === 'loading' || waiting;
  const now = drag ?? time;

  return (
    <div ref={boxRef} data-player onContextMenu={(e) => e.preventDefault()}
      onClick={onTap}
      onPointerMove={(e) => e.pointerType === 'mouse' && poke()}
      className={`overflow-hidden bg-black select-none ${fs ? 'fixed inset-0 z-[1000] h-[100dvh] w-screen' : 'relative w-full aspect-video rounded-2xl ring-1 ring-edge'}`}>
      <video ref={vref} playsInline preload="auto" poster={poster || undefined} referrerPolicy="no-referrer"
        controlsList="nodownload noremoteplayback" onContextMenu={(e) => e.preventDefault()} style={{ WebkitTouchCallout: 'none' }}
        loop={loop} className={`size-full ${fit === 'cover' ? 'object-cover' : fit === 'fill' ? 'object-fill' : 'object-contain'} ${state === 'failed' || kind === 'iframe' ? 'hidden' : ''}`} />
      {kind === 'iframe' && <iframe src={playUrl} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen className="absolute inset-0 size-full border-0 bg-black" title="Pemutar" />}

      {busy && state !== 'failed' && kind !== 'iframe' && (
        <div className="absolute inset-0 grid place-items-center bg-ink/55 pointer-events-none">
          <Loader size={72} label="Memuat video…" />
        </div>
      )}

      {flash && (
        <div className={`absolute ${flash.side === 'c' ? 'left-1/2 -translate-x-1/2 top-14' : `top-1/2 -translate-y-1/2 ${flash.side === 'l' ? 'left-[10%]' : 'right-[10%]'}`} pointer-events-none rounded-full bg-black/55 px-4 py-2 text-sm font-bold text-white`}>
          {flash.text || `${flash.side === 'l' ? '−' : '+'}${flash.n} dtk`}
        </div>
      )}

      {throttled && playing && state !== 'failed' && kind !== 'iframe' && (
        <div className={`absolute left-3 ${ui ? 'bottom-16' : 'bottom-3'} pointer-events-none rounded-full bg-black/60 px-3 py-1.5 text-[11px] font-semibold text-lantern`}>
          Buffer menipis, kecepatan 1× sementara
        </div>
      )}

      {nextHref && state !== 'failed' && kind !== 'iframe' && dur > 0 && dur - time <= 75 && (
        <button type="button" onClick={(e) => { e.stopPropagation(); onNext(); }}
          className={`absolute right-3 ${ui ? 'bottom-16' : 'bottom-3'} z-10 inline-flex items-center gap-1.5 rounded-full bg-sakura px-4 py-2 text-xs font-bold text-ink shadow-lg active:scale-95 transition-all`}>
          Episode {nextNum} <SkipForward className="size-4" />
        </button>
      )}

      {state === 'failed' && (
        embedUrl ? <iframe src={embedUrl} allowFullScreen className="absolute inset-0 size-full border-0" title="Pemutar cadangan" /> : (
          <div className="absolute inset-0 overflow-y-auto bg-night p-4 text-center" onClick={(e) => e.stopPropagation()}>
            <TriangleAlert className="size-7 mx-auto text-lantern" />
            <p className="mt-2 text-sm text-mist">Video belum bisa dimuat. Coba lagi, atau pilih server dan kualitas lain.</p>
            {why && <p className="mt-1 text-[11px] text-mist/80 break-words">{why}</p>}
            <button type="button" onClick={() => setTries((n) => n + 1)} className="mt-3 rounded-full bg-sakura text-ink px-4 py-2 text-xs font-bold active:scale-95">Coba lagi</button>
            <div className="mt-4 text-left">{settings}</div>
          </div>
        )
      )}

      {state !== 'failed' && kind !== 'iframe' && (
        <div className={`absolute inset-0 transition-opacity duration-200 ${ui ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div className="absolute top-0 inset-x-0 px-4 pt-3 pb-8 text-center bg-gradient-to-b from-black/70 to-transparent">
            <p className="text-[11px] text-white/70">Sedang menonton</p>
            <p className="text-sm font-bold text-white truncate">{title}</p>
          </div>

          {!busy && (
            <div className="absolute inset-0 flex items-center justify-center gap-8 sm:gap-16">
              <button type="button" aria-label={`Mundur ${skip} detik`} onClick={act(() => seekBy(-skip))}><Seek10 back n={skip} /></button>
              <button type="button" aria-label={playing ? 'Jeda' : 'Putar'} onClick={act(toggle)}
                className="size-16 grid place-items-center rounded-full bg-black/45 active:scale-90 transition-transform">
                {playing ? <Pause className="size-9 fill-white text-white" /> : <Play className="size-9 fill-white text-white ml-1" />}
              </button>
              <button type="button" aria-label={`Maju ${skip} detik`} onClick={act(() => seekBy(skip))}><Seek10 n={skip} /></button>
            </div>
          )}

          <div className="absolute bottom-0 inset-x-0 px-3 pb-2 pt-10 bg-gradient-to-t from-black/80 to-transparent">
            <input type="range" className="seek" aria-label="Posisi video" min={0} max={dur || 0} step={0.1}
              value={Math.min(now, dur || 0)} style={{ '--p': `${dur ? (now / dur) * 100 : 0}%` }}
              onClick={(e) => e.stopPropagation()} onChange={(e) => { setDrag(+e.target.value); poke(); }}
              onPointerUp={commit} onTouchEnd={commit} onKeyUp={commit} onBlur={commit} />
            <div className="mt-2 flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <button type="button" aria-label={muted ? 'Aktifkan suara' : 'Bisukan'} onClick={act(() => { const v = vref.current; if (v) v.muted = !v.muted; })}>
                  {muted ? <VolumeX className="size-6" /> : <Volume2 className="size-6" />}
                </button>
                <span className="text-xs tabular-nums text-white/90">{clock(now)} / {clock(dur)}</span>
              </div>
              <div className="flex items-center gap-4">
                {nextHref && <button type="button" aria-label={`Episode ${nextNum}`} onClick={act(onNext)}><SkipForward className="size-6" /></button>}
                <button type="button" aria-label="Pengaturan" onClick={act(() => setMenu((m) => !m))}><Settings className="size-6" /></button>
                {canPip && <button type="button" aria-label="Gambar dalam gambar" onClick={act(togglePip)}><PictureInPicture2 className="size-6" /></button>}
                <button type="button" aria-label="Layar penuh" onClick={act(toggleFs)}>{fs ? <Minimize className="size-6" /> : <Maximize className="size-6" />}</button>
              </div>
            </div>
          </div>

          {menu && (
            <div onClick={(e) => e.stopPropagation()} className="absolute right-3 bottom-16 w-60 max-h-[72%] overflow-y-auto space-y-3 rounded-2xl bg-night ring-1 ring-edge p-3 shadow-xl">
              {settings}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const SLEEP = [15, 30, 45, 60];
const momentTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// Alat di bawah pemutar: tandai momen favorit (dicatat per episode, ketuk untuk lompat) dan timer tidur
// (video dijeda otomatis setelah beberapa menit). Semua tersimpan di browser ini.
function Tools({ vref, slug }) {
  const key = `moments:${slug}`;
  const [moments, setMoments] = useState([]);
  const [open, setOpen] = useState(false);
  const [sleepAt, setSleepAt] = useState(0);
  const [left, setLeft] = useState(0);

  useEffect(() => { setMoments(read(key, [])); }, [key]);
  useEffect(() => {
    if (!sleepAt) return;
    const id = setInterval(() => {
      const ms = sleepAt - Date.now();
      if (ms <= 0) { vref.current?.pause(); setSleepAt(0); setLeft(0); } else setLeft(Math.ceil(ms / 60000));
    }, 1000);
    return () => clearInterval(id);
  }, [sleepAt, vref]);

  const save = (list) => { setMoments(list); write(key, list, true); };
  const mark = () => {
    const v = vref.current;
    if (!v || !Number.isFinite(v.currentTime)) return;
    const t = Math.floor(v.currentTime);
    if (moments.some((m) => Math.abs(m - t) < 3)) return;
    save([...moments, t].sort((a, b) => a - b).slice(0, 30));
  };
  const seek = (t) => { const v = vref.current; if (v) { v.currentTime = t; v.play?.().catch(() => {}); } };
  const start = (min) => { setSleepAt(Date.now() + min * 60000); setLeft(min); setOpen(false); };
  const btn = 'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-night ring-1 ring-edge py-3 text-xs font-bold active:scale-95 transition-transform';

  return (
    <section className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={mark} className={btn}><Flag className="size-4 text-sakura" /> Tandai momen</button>
        <button type="button" onClick={() => (sleepAt ? (setSleepAt(0), setLeft(0)) : setOpen((v) => !v))} aria-expanded={open} className={btn}>
          <Moon className="size-4 text-lantern" /> {sleepAt ? `Mati ${left} mnt (batal)` : 'Timer tidur'}
        </button>
      </div>
      {open && (
        <div className="grid grid-cols-4 gap-2">
          {SLEEP.map((m) => <button key={m} type="button" onClick={() => start(m)} className="rounded-xl bg-ink ring-1 ring-edge py-2.5 text-xs font-bold active:bg-sakura active:text-ink">{m} mnt</button>)}
        </div>
      )}
      {moments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {moments.map((t) => (
            <span key={t} className="inline-flex items-center rounded-full bg-night ring-1 ring-edge text-xs font-bold">
              <button type="button" onClick={() => seek(t)} className="pl-3 pr-2 py-1.5 tabular-nums">{momentTime(t)}</button>
              <button type="button" onClick={() => save(moments.filter((m) => m !== t))} aria-label={`Hapus momen ${momentTime(t)}`} className="pr-2.5 text-mist"><X className="size-3" /></button>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

export default function WatchClient({ episodeData, slug, anime, episodes = [] }) {
  const router = useRouter();
  const vref = useRef(null);
  const resume = useRef({ time: 0, playing: false });

  const servers = useMemo(() => {
    const d = episodeData || {};
    const src = [d.streams, d.servers, d.sources].find((x) => Array.isArray(x) && x.length) || [];
    return src
      .map((s, i) => {
        const url = s.stream_url || s.url || s.link || s.src || s.file || '';
        // "format" dari API: mp4, hls, atau iframe. Alamat HLS tidak berakhiran .m3u8, jadi jangan menebak dari alamat
        const format = String(s.format || '').toLowerCase() || (isHls(url) ? 'hls' : 'mp4');
        return { id: i, url, format, res: resOf(s), server: +String(s.server || s.label || s.name || '').match(/server\s*(\d+)/i)?.[1] || i + 1 };
      })
      .filter((s) => s.url);
  }, [episodeData]);

  const resolutions = useMemo(() => [...new Set(servers.map((s) => s.res))].sort((a, b) => resValue(b) - resValue(a)), [servers]);
  // Kualitas awal: pilih yang bisa diputar langsung (bukan iframe), utamakan 720p
  const playableRes = resolutions.filter((r) => servers.some((s) => s.res === r && s.format !== 'iframe'));
  const [res, setRes] = useState(() => (playableRes.includes('720p') ? '720p' : playableRes[0] || resolutions[0]));
  const [selId, setSelId] = useState(null);
  const [rate, setRate] = useState(1);
  const [auto, setAuto] = useState(true);
  const [resumedAt, setResumedAt] = useState(null);
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState('');
  const [skip, setSkip] = useState(10);
  const [fit, setFit] = useState('contain');
  const [loopOn, setLoopOn] = useState(false);

  // Baca preferensi tersimpan setelah halaman tampil (menghindari beda tampilan server vs browser)
  useEffect(() => {
    const pref = store.get('res', null);
    if (pref && resolutions.includes(pref)) setRes(pref);
    else {
      // Belum pernah memilih kualitas dan koneksi lambat/hemat data: mulai dari kualitas terendah supaya video cepat tampil
      const c = navigator.connection;
      if (c && (c.saveData || /2g|3g/.test(c.effectiveType || ''))) {
        const low = [...playableRes].sort((x, y) => resValue(x) - resValue(y))[0];
        if (low) setRes(low);
      }
    }
    setRate(store.get('rate', 1));
    setAuto(store.get('auto', true));
    setSkip(store.get('skip', 10));
    setFit(store.get('fit', 'contain'));
    const el = document.getElementById('ep-active');
    const box = el?.parentElement;
    if (box) box.scrollLeft = el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2;
  }, [resolutions]);

  const base = String(slug).replace(/-ep-\d+$/, '');
  const animeId = episodeData?.anime_id || base;
  const num = Number(episodeData?.episode_number) || Number(String(slug).match(/-ep-(\d+)$/)?.[1]) || 1;
  const title = anime?.title || animeId.replace(/-sub-indo$/, '').replace(/-/g, ' ');
  const maxEp = episodes.length ? episodes[episodes.length - 1].n : 0;
  const nextHref = (episodeData?.has_next_episode || num < maxEp) ? `/watch/${encodeURIComponent(`${base}-ep-${num + 1}`)}` : null;
  // Sambil menonton, siapkan episode berikutnya di latar belakang (data + server video) agar pindah episode terasa instan
  useEffect(() => {
    if (!nextHref) return;
    const t = setTimeout(() => {
      router.prefetch(nextHref);
      fetch(`/api/warm?ep=${encodeURIComponent(`${base}-ep-${num + 1}`)}`, { priority: 'low' }).catch(() => {});
    }, 6000);
    return () => clearTimeout(t);
  }, [nextHref, base, num, router]);
  const prevHref = (episodeData?.has_prev_episode || num > 1) ? `/watch/${encodeURIComponent(`${base}-ep-${num - 1}`)}` : null;
  const posKey = `pos:${slug}`;
  const embedUrl = episodeData?.embed_url || episodeData?.embed || episodeData?.iframe_url || '';

  // Catat riwayat: satu entri per anime, selalu episode terakhir yang ditonton
  const record = (t, d) => {
    if (t < 5) return;
    touchDay(); // hari ini tercatat aktif menonton
    if (d > 0 && t / d >= 0.85) markSeen(animeId, num); // hampir selesai = dianggap sudah ditonton
    const rest = store.get('history', []).filter((h) => h.animeId !== animeId);
    store.set('history', [{ animeId, title, poster: anime?.poster || '', epId: slug, n: num, t: Math.floor(t), d: Math.floor(d || 0), at: Date.now() }, ...rest].slice(0, 40));
  };

  const options = servers.filter((s) => s.res === res).sort((a, b) => rank(a.format) - rank(b.format) || a.server - b.server);
  const active = options.find((s) => s.id === selId) || options[0];
  // Browser tidak pernah menerima link stream asli: server kita yang meminta dan meneruskannya
  const epUrl = (q, s, f, extra = {}) => `/api/stream?${new URLSearchParams({ ep: slug, q: String(q).toLowerCase(), s: String(s), f: f || '', ...extra })}`;
  const playUrl = active ? epUrl(active.res, active.server, active.format) : '';
  const [playNote, setPlayNote] = useState('');

  // Video belum tersedia (API gagal sesaat atau episode baru rilis): muat ulang otomatis tiap 10 detik, maksimal 6 kali
  const noVideo = !active && !embedUrl;
  const [retryN, setRetryN] = useState(0);
  useEffect(() => {
    if (!noVideo || retryN >= 6) return;
    const t = setTimeout(() => { setRetryN((n) => n + 1); router.refresh(); }, 10000);
    return () => clearTimeout(t);
  }, [noVideo, retryN, router]);

  // Gagal diputar: coba otomatis server lain di kualitas yang sama, lalu kualitas terdekat
  const tried = useRef(new Set());
  const failover = () => {
    if (!active) return false;
    tried.current.add(active.id);
    const next = servers
      .filter((s) => !tried.current.has(s.id))
      .sort((a, b) => (a.format === 'iframe') - (b.format === 'iframe') || Math.abs(resValue(a.res) - resValue(active.res)) - Math.abs(resValue(b.res) - resValue(active.res)) || a.server - b.server)[0];
    if (!next) return false;
    setPlayNote(`Server ${active.server} (${active.res.toUpperCase()}) gagal, mencoba Server ${next.server} (${next.res.toUpperCase()}, ${next.format.toUpperCase()}).`);
    setRes(next.res);
    setSelId(next.id);
    return true;
  };

  const downloads = useMemo(() => {
    if (Array.isArray(episodeData?.downloads) && episodeData.downloads.length) {
      return episodeData.downloads.map((d) => ({ res: resOf(d), url: d.url || d.link || d.links?.[0]?.url || '' })).filter((d) => d.url);
    }
    return resolutions.map((r) => { const m = servers.find((s) => s.res === r && s.format === 'mp4'); return m ? { res: r, url: null, server: m.server } : null; }).filter(Boolean);
  }, [episodeData, resolutions]);

  const fileBase = `${title}-ep-${num}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const pickRes = (r) => { tried.current.clear(); setPlayNote(''); setSelId(null); setRes(r); store.set('res', r); };
  const seek = (d) => { const v = vref.current; if (v) v.currentTime = Math.max(0, v.currentTime + d); };
  const setSpeed = (r) => { setRate(r); store.set('rate', r); if (vref.current) vref.current.playbackRate = r; };
  const toggleAuto = () => { setAuto(!auto); store.set('auto', !auto); };
  const pickSkip = (n) => { setSkip(n); store.set('skip', n); };
  const pickFit = (f) => { setFit(f); store.set('fit', f); };
  const startOver = () => { if (vref.current) vref.current.currentTime = 0; store.del(posKey); setResumedAt(null); };
  const handleEnded = () => {
    markSeen(animeId, num);
    store.del(posKey);
    if (nextHref) {
      // Riwayat langsung menunjuk ke episode berikutnya agar "Lanjut menonton" tepat sasaran
      const rest = store.get('history', []).filter((h) => h.animeId !== animeId);
      store.set('history', [{ animeId, title, poster: anime?.poster || '', epId: `${base}-ep-${num + 1}`, n: num + 1, t: 0, d: 0, at: Date.now() }, ...rest].slice(0, 40));
      if (auto) router.push(nextHref);
    }
  };

  const download = (d) => {
    setNotice('');
    setBusy(d.res);
    const name = `${fileBase}-${d.res}.mp4`;
    const a = document.createElement('a');
    a.href = d.url ? `/api/stream?${new URLSearchParams({ url: d.url, download: '1', filename: name })}` : epUrl(d.res, d.server, 'mp4', { download: '1', filename: name });
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setNotice(`Unduhan ${d.res.toUpperCase()} dimulai. Cek folder Download atau notifikasi browser.`);
    setTimeout(() => setBusy(null), 2500);
  };

  // Menu pengaturan di dalam video: kecepatan, kualitas, server, ukuran lompatan, tampilan, dan beberapa alat
  const settings = (
    <>
      <Row label="Kecepatan">{RATES.map((r) => <Chip key={r} on={r === rate} onClick={() => setSpeed(r)}>{r}x</Chip>)}</Row>
      {resolutions.length > 0 && (
        <Row label="Kualitas">{resolutions.map((r) => <Chip key={r} on={r === res} onClick={() => pickRes(r)}>{r.toUpperCase()}</Chip>)}</Row>
      )}
      {options.length > 1 && (
        <Row label="Server (ganti jika macet)">{options.map((o) => <Chip key={o.id} on={active?.id === o.id} onClick={() => { tried.current.clear(); setPlayNote(''); setSelId(o.id); }}>Server {o.server}{o.format !== 'mp4' ? ` (${o.format.toUpperCase()})` : ''}</Chip>)}</Row>
      )}
      <Row label="Lompat (detik)">{SKIPS.map((n) => <Chip key={n} on={n === skip} onClick={() => pickSkip(n)}>{n}</Chip>)}</Row>
      <Row label="Tampilan video">
        {FITS.map(([v, l]) => <Chip key={v} on={v === fit} onClick={() => pickFit(v)}>{l}</Chip>)}
      </Row>
      <Row label="Lainnya">
        <Chip onClick={() => seek(85)}>Lewati OP</Chip>
        <Chip on={loopOn} onClick={() => setLoopOn((v) => !v)}>Ulangi</Chip>
        <Chip on={auto} onClick={toggleAuto}>Lanjut otomatis</Chip>
      </Row>
    </>
  );

  // Deretan episode: untuk anime panjang, tampilkan 60 episode di sekitar episode ini
  const idx = Math.max(0, episodes.findIndex((e) => e.n === num));
  const shown = episodes.length > 60 ? episodes.slice(Math.max(0, idx - 30), idx + 30) : episodes;

  return (
    <div className="max-w-4xl mx-auto px-4 pt-3 pb-28 space-y-5">
      <Link href={`/anime/${encodeURIComponent(animeId)}`} className="inline-flex items-center gap-2 text-xs font-semibold text-mist active:text-sakura">
        <ArrowLeft className="size-4" /> Semua episode
      </Link>

      {active ? (
        <Player playUrl={playUrl} kind={active.format === 'iframe' ? 'iframe' : active.format === 'hls' ? 'hls' : 'video'} embedUrl={embedUrl} resume={resume} vref={vref} posKey={posKey} rate={rate}
          poster={anime?.banner || anime?.poster} title={`${title}, Episode ${num}`} settings={settings}
          skip={skip} fit={fit} loop={loopOn} nextHref={nextHref} nextNum={num + 1} onNext={() => nextHref && router.push(nextHref)}
          onEnded={handleEnded} onResumed={setResumedAt} onProgress={record} onFail={failover} />
      ) : embedUrl ? (
        <div className="aspect-video rounded-2xl overflow-hidden ring-1 ring-edge"><iframe src={embedUrl} allowFullScreen className="size-full border-0" title="Pemutar" /></div>
      ) : (
        <div className="aspect-video rounded-2xl bg-night ring-1 ring-edge grid place-items-center p-6 text-center">
          <div className="space-y-3">
            <TriangleAlert className="size-7 mx-auto text-lantern" />
            <p className="text-sm font-bold">Video episode ini belum tersedia</p>
            <p className="text-xs text-mist max-w-xs">Episode baru biasanya muncul beberapa jam setelah rilis. {retryN < 6 ? `Mencoba lagi otomatis (${retryN}/6)…` : 'Coba lagi nanti atau pilih episode lain.'}</p>
            <div className="flex justify-center gap-2">
              <button type="button" onClick={() => { setRetryN(0); router.refresh(); }} className="rounded-full bg-sakura text-ink px-4 py-2 text-xs font-bold active:scale-95">Muat ulang</button>
              {prevHref && <Link href={prevHref} className="rounded-full bg-ink ring-1 ring-edge px-4 py-2 text-xs font-bold">Episode {num - 1}</Link>}
              {nextHref && <Link href={nextHref} className="rounded-full bg-ink ring-1 ring-edge px-4 py-2 text-xs font-bold">Episode {num + 1}</Link>}
            </div>
          </div>
        </div>
      )}

      {resumedAt != null && (
        <p className="text-xs text-mist">
          Dilanjutkan dari menit {fmt(resumedAt)}.{' '}
          <button type="button" onClick={startOver} className="font-bold text-sakura">Mulai dari awal</button>
        </p>
      )}

      {playNote && <p className="text-xs text-lantern">{playNote}</p>}

      <div className="space-y-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-bold text-lantern">Episode {num}</p>
          {anime?.status && <p className="text-xs text-mist">{anime.status}</p>}
        </div>
        <h1 className="font-display text-xl leading-tight capitalize">{title}</h1>
      </div>

      {(prevHref || nextHref) && (
        <div className="space-y-2.5">
          <div className="flex gap-2">
            {prevHref && (
              <Link href={prevHref} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-night ring-1 ring-edge py-3 text-xs font-bold active:scale-95 transition-transform">
                <ArrowLeft className="size-4" /> Episode {num - 1}
              </Link>
            )}
            {nextHref && (
              <Link href={nextHref} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-sakura text-ink py-3 text-xs font-bold active:scale-95 transition-transform">
                Episode {num + 1} <ArrowRight className="size-4" />
              </Link>
            )}
          </div>
          {nextHref && (
            <button type="button" onClick={toggleAuto} role="switch" aria-checked={auto} className="flex w-full items-center justify-between text-xs text-mist">
              <span>Putar episode berikutnya otomatis</span>
              <span className={`w-10 h-6 rounded-full p-0.5 transition-colors ${auto ? 'bg-sakura' : 'bg-edge'}`}>
                <span className={`block size-5 rounded-full bg-paper transition-transform ${auto ? 'translate-x-4' : ''}`} />
              </span>
            </button>
          )}
        </div>
      )}

      <Tools vref={vref} slug={slug} />

      {episodes.length > 1 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold">Pilih episode</h2>
          <div className="relative flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-2">
            {shown.map((e) => (
              <Link key={e.id} id={e.n === num ? 'ep-active' : undefined} href={`/watch/${encodeURIComponent(e.id)}`}
                className={`shrink-0 min-w-11 text-center rounded-lg px-3 py-2 text-xs font-bold ${e.n === num ? 'bg-sakura text-ink' : 'bg-night ring-1 ring-edge text-mist'}`}>
                {e.n}
              </Link>
            ))}
          </div>
        </section>
      )}

      {anime && (
        <section className="space-y-3">
          <Link href={`/anime/${encodeURIComponent(animeId)}`} className="flex gap-3 rounded-2xl bg-night ring-1 ring-edge p-3 active:scale-[.99] transition-transform">
            {anime.poster && <img src={anime.poster} alt="" decoding="async" className="w-16 aspect-[3/4] rounded-lg object-cover shrink-0" />}
            <div className="min-w-0 space-y-1.5">
              <p className="text-sm font-bold leading-snug">{anime.title}</p>
              <p className="text-xs text-mist">{[anime.type, anime.studio, anime.season].filter(Boolean).join(', ')}</p>
              {anime.genres.length > 0 && <p className="text-xs text-lantern">{anime.genres.slice(0, 4).join(', ')}</p>}
            </div>
          </Link>
          {anime.synopsis && (
            <details className="group text-sm text-mist">
              <summary className="cursor-pointer font-bold text-paper list-none">Sinopsis <span className="text-sakura text-xs group-open:hidden">(buka)</span></summary>
              <p className="mt-2 leading-relaxed max-w-prose">{anime.synopsis}</p>
            </details>
          )}
        </section>
      )}

      {downloads.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold">Unduh episode</h2>
          <div className="grid grid-cols-3 gap-2.5">
            {downloads.map((d) => (
              <button key={d.res} type="button" disabled={busy === d.res} onClick={() => download(d)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-night ring-1 ring-edge px-3 py-3 text-xs font-bold enabled:active:scale-95 enabled:hover:ring-sakura disabled:opacity-40 transition">
                {busy === d.res ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                {busy === d.res ? 'Memulai…' : d.res.toUpperCase()}
              </button>
            ))}
          </div>
          {notice && <p className="text-xs text-mist" role="status">{notice}</p>}
        </section>
      )}

      {anime && <SaveButtons item={{ id: animeId, title: anime.title, poster: anime.poster, type: anime.type }} />}
    </div>
  );
}
