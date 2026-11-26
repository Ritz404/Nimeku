'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, Check, Copy, ExternalLink, LifeBuoy, Megaphone, MessageCircle, MessageSquarePlus, Users, X } from 'lucide-react';
import { COMMUNITY } from '@/lib/community';
import { read, write } from '@/lib/store';

const HIDE_KEY = 'communityHideUntil';
const DAY = 24 * 60 * 60 * 1000;

const PERKS = [
  { icon: Bell, text: 'Info anime dan episode baru lebih dulu', tone: 'bg-sakura/15 text-sakura' },
  { icon: MessageSquarePlus, text: 'Request judul yang belum ada', tone: 'bg-lantern/15 text-lantern' },
  { icon: LifeBuoy, text: 'Bantuan cepat kalau video bermasalah', tone: 'bg-mist/15 text-mist' },
];

// Pop up komunitas: muncul sebentar setelah situs dibuka, bisa disembunyikan 24 jam,
// dan bisa dibuka lagi lewat tombol komunitas di navbar.
export default function CommunityPopup() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('channel');
  const [hide, setHide] = useState(false);
  const [copied, setCopied] = useState('');
  const closeBtn = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => { if (Date.now() > read(HIDE_KEY, 0)) setOpen(true); }, 1400);
    const manual = () => setOpen(true);
    window.addEventListener('nimeku:community', manual);
    return () => { clearTimeout(t); window.removeEventListener('nimeku:community', manual); };
  }, []);

  const close = () => {
    if (hide) write(HIDE_KEY, Date.now() + DAY, true);
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    closeBtn.current?.focus();
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open, hide]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;
  const item = COMMUNITY[tab];

  const copy = async () => {
    try { await navigator.clipboard.writeText(item.url); setCopied(tab); setTimeout(() => setCopied(''), 1600); } catch {}
  };

  return (
    <div className="fixed inset-0 z-[150] grid place-items-center p-4 popup-fade bg-black/70" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="kom-title" className="popup-card w-full max-w-sm max-h-[92dvh] overflow-y-auto rounded-3xl bg-night ring-1 ring-edge shadow-2xl shadow-black/60">
        <div className="relative flex gap-4 p-5 pb-4">
          <img src="/icon.svg" alt="" width="56" height="56" className="size-14 rounded-2xl shrink-0 ring-1 ring-edge" />
          <div className="min-w-0 pr-8">
            <span className="inline-block rounded bg-sakura/15 text-sakura px-2 py-0.5 text-[10px] font-bold tracking-[.18em]">KANAL RESMI</span>
            <h2 id="kom-title" className="mt-1.5 font-display text-lg leading-tight">Komunitas Nimeku</h2>
            <p className="mt-1 text-xs leading-relaxed text-mist">Gabung biar tidak ketinggalan anime baru dan info situs.</p>
          </div>
          <button type="button" onClick={close} aria-label="Tutup" className="absolute right-4 top-4 size-8 rounded-full bg-ink grid place-items-center text-mist active:scale-90 transition-transform">
            <X className="size-4" />
          </button>
        </div>

        <div className="px-5 space-y-2">
          {PERKS.map(({ icon: Icon, text, tone }) => (
            <div key={text} className="flex items-center gap-3 rounded-xl bg-ink/60 ring-1 ring-edge px-3 py-2.5">
              <span className={`size-8 rounded-lg grid place-items-center shrink-0 ${tone}`}><Icon className="size-4" /></span>
              <span className="text-xs font-medium">{text}</span>
            </div>
          ))}
        </div>

        <div className="px-5 pt-4 space-y-3">
          <div role="tablist" className="relative grid grid-cols-2 rounded-xl bg-ink p-1 ring-1 ring-edge">
            <span aria-hidden="true" className={`absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-lg bg-sakura transition-transform duration-300 ${tab === 'group' ? 'translate-x-full' : ''}`} />
            {[['channel', Megaphone, 'Channel'], ['group', Users, 'Grup']].map(([k, Icon, label]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                className={`relative z-10 flex items-center justify-center gap-1.5 py-2 text-xs font-bold transition-colors ${tab === k ? 'text-ink' : 'text-mist'}`}>
                <Icon className="size-3.5" /> {label}
              </button>
            ))}
          </div>

          <div className="flex rounded-2xl bg-ink/60 ring-1 ring-edge overflow-hidden">
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 flex items-center gap-3 p-3 active:bg-ink">
              <span className="size-10 rounded-xl bg-[#25d366] text-white grid place-items-center shrink-0"><MessageCircle className="size-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">{item.title}</span>
                <span className="block text-[11px] text-mist truncate">{item.desc}</span>
              </span>
              <ExternalLink className="size-4 text-mist shrink-0" />
            </a>
            <button type="button" onClick={copy} aria-label="Salin tautan" className="w-12 border-l border-edge grid place-items-center text-mist active:bg-ink">
              {copied === tab ? <Check className="size-4 text-lantern" /> : <Copy className="size-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 p-5 pt-4">
          <button type="button" role="switch" aria-checked={hide} onClick={() => setHide((v) => !v)} className="flex items-center gap-2.5 text-xs text-mist">
            <span className={`relative h-6 w-10 rounded-full transition-colors ${hide ? 'bg-sakura' : 'bg-ink ring-1 ring-edge'}`}>
              <span className={`absolute top-1 left-1 size-4 rounded-full bg-paper transition-transform ${hide ? 'translate-x-4' : ''}`} />
            </span>
            Sembunyikan 24 jam
          </button>
          <button ref={closeBtn} type="button" onClick={close} className="inline-flex items-center gap-2 rounded-xl bg-sakura text-ink px-4 py-2.5 text-sm font-bold active:scale-95 transition-transform">
            Tutup <kbd className="hidden sm:inline rounded bg-ink/15 px-1.5 py-0.5 text-[10px] font-bold">Esc</kbd>
          </button>
        </div>
      </div>
    </div>
  );
}
