// Loader bulat berisi logo N: dipakai di layar loading, splash awal, dan pemutar video (hanya CSS, ringan)
export default function Loader({ size = 112, label, className = '' }) {
  return (
    <div className={`flex flex-col items-center gap-5 ${className}`} role="status" aria-live="polite">
      <div className="relative" style={{ width: size, height: size }}>
        {/* cincin dua warna berputar */}
        <svg viewBox="0 0 100 100" className="absolute -inset-[10%] size-[120%] orbit" aria-hidden="true">
          <circle cx="50" cy="50" r="46" fill="none" stroke="#ff6b8b" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="70 220" />
          <circle cx="50" cy="50" r="46" fill="none" stroke="#ffc857" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="8 282" strokeDashoffset="-150" />
        </svg>
        {/* kelopak sakura mengorbit pelan ke arah sebaliknya */}
        <svg viewBox="0 0 100 100" className="absolute -inset-[22%] size-[144%] orbit-rev" aria-hidden="true">
          <ellipse cx="50" cy="5" rx="3.6" ry="6.5" fill="#ff6b8b" />
        </svg>
        <div className="size-full rounded-full bg-sakura text-ink ring-4 ring-night breathe grid place-items-center font-display leading-none" style={{ fontSize: Math.round(size * 0.46) }}>N</div>
      </div>
      {label && <p className="font-display text-sm text-paper">{label}</p>}
    </div>
  );
}
