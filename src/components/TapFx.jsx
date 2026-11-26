'use client';

import { useEffect } from 'react';

// Cincin kecil di titik sentuh saat menekan tautan atau tombol
export default function TapFx() {
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const on = (e) => {
      const t = e.target;
      if (!t.closest || t.closest('canvas,video,input,select,textarea,iframe')) return;
      if (!t.closest('a,button,summary,label')) return;
      const d = document.createElement('span');
      d.className = 'tap-fx';
      d.style.left = `${e.clientX}px`;
      d.style.top = `${e.clientY}px`;
      document.body.appendChild(d);
      d.addEventListener('animationend', () => d.remove(), { once: true });
      setTimeout(() => d.remove(), 900);
    };
    document.addEventListener('pointerdown', on, { passive: true });
    return () => document.removeEventListener('pointerdown', on);
  }, []);
  return null;
}
