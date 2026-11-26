'use client';

import { useEffect, useState } from 'react';

const parse = (t) => {
  const m = String(t).match(/(\d{1,2})[:.](\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

// Menit sejak tengah malam di WIB, diperbarui tiap 30 detik (hanya jika aktif)
function useJakartaMinutes(active) {
  const [now, setNow] = useState(null);
  useEffect(() => {
    if (!active) return;
    const tick = () => {
      const parts = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Jakarta' }).formatToParts(new Date());
      setNow(Number(parts.find((x) => x.type === 'hour').value) * 60 + Number(parts.find((x) => x.type === 'minute').value));
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

// d = selisih menit (positif = belum tayang)
function describe(d) {
  if (d > 0) return { text: d >= 60 ? `${Math.floor(d / 60)} jam ${d % 60} menit lagi` : `${d} menit lagi`, tone: 'soon' };
  if (d > -180) return { text: 'baru tayang', tone: 'live' };
  return { text: 'sudah tayang', tone: 'done' };
}

// Jam tayang; untuk jadwal hari ini ditambah hitung mundur menurut WIB ("2 jam 10 menit lagi")
export default function AirTime({ text, today = false }) {
  const now = useJakartaMinutes(today);
  const at = parse(text);
  const extra = today && now != null && at != null ? describe(at - now).text : '';
  return (
    <p className="text-[11px] font-semibold text-lantern mt-0.5">
      {text}{extra && <span className="text-mist font-medium"> · {extra}</span>}
    </p>
  );
}

// Lencana status tayang untuk halaman Jadwal ("2 jam lagi", "baru tayang", "sudah tayang")
export function AirStatus({ time, today = false }) {
  const now = useJakartaMinutes(today);
  const at = parse(time);
  if (!today || now == null || at == null) return null;
  const { text, tone } = describe(at - now);
  const cls = tone === 'soon' ? 'bg-lantern/15 text-lantern' : tone === 'live' ? 'bg-sakura text-ink' : 'bg-ink text-mist';
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${cls}`}>{text}</span>;
}
