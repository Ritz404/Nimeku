import Loader from '@/components/Loader';
import FsLoading from '@/components/FsLoading';

// Tampil otomatis oleh Next.js selama halaman menunggu data
export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto px-4 pt-14 pb-28">
      <FsLoading />
      <Loader label="Memuat Nimeku…" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-10" aria-hidden="true">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="aspect-[3/4] rounded-2xl skeleton" />)}
      </div>
    </div>
  );
}
