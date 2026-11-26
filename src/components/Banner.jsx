import Link from 'next/link';
import { Play } from 'lucide-react';
import { normalizeItem } from '@/lib/api';

// Banner lebar dengan gambar sampul anime; teks di atas bayangan gelap agar tetap terbaca
export default function Banner({ anime, label, priority = false, className = '' }) {
  const a = normalizeItem(anime);
  const img = a.banner || a.poster;
  return (
    <Link href={`/anime/${encodeURIComponent(a.slug)}`} className={`relative block aspect-[16/10] sm:aspect-[16/7] rounded-3xl overflow-hidden skeleton ring-1 ring-edge ${className}`}>
      {img && <img src={img} alt="" loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} decoding="async" className="absolute inset-0 size-full object-cover" />}
      <div className="absolute inset-x-0 bottom-0 p-4 pt-20 bg-gradient-to-t from-ink via-ink/75 to-transparent">
        {label && <p className="text-[11px] font-bold text-lantern mb-1">{label}</p>}
        <h2 className="font-display text-xl leading-tight line-clamp-2">{a.title}</h2>
        <div className="mt-2.5 flex items-center gap-3 text-xs text-mist">
          {a.rating && <span className="font-bold text-lantern">★ {a.rating}</span>}
          {a.episode && <span>Episode {a.episode}</span>}
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-sakura text-ink px-3.5 py-1.5 font-bold">
            <Play className="size-3.5 fill-current" /> Tonton
          </span>
        </div>
      </div>
    </Link>
  );
}
