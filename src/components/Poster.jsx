'use client';

import { useState } from 'react';

// Poster dengan cadangan: bila sumber tidak punya gambar atau gambarnya gagal dimuat, tampil kotak berisi huruf pertama judul
export default function Poster({ src, title }) {
  const [bad, setBad] = useState(false);
  if (!src || bad) {
    return (
      <div className="size-full grid place-items-center bg-gradient-to-br from-[#2a2253] to-[#1b1538] px-3 text-center" aria-hidden="true">
        <span className="font-display text-4xl text-mist/50 leading-none">{String(title || '?').trim().charAt(0).toUpperCase()}</span>
      </div>
    );
  }
  return <img src={src} alt={title} loading="lazy" decoding="async" onError={() => setBad(true)} className="size-full object-cover" />;
}
