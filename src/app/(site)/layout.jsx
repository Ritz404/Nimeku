import Navbar from '@/components/Navbar';
import BottomNav from '@/components/BottomNav';
import Loader from '@/components/Loader';
import TapFx from '@/components/TapFx';
import CommunityPopup from '@/components/CommunityPopup';
import BackToTop from '@/components/BackToTop';
import Accent from '@/components/Accent';
import UpdateWatcher from '@/components/UpdateWatcher';

export default function SiteLayout({ children }) {
  return (
    <>
      {/* Splash saat halaman dibuka/di-refresh: murni CSS, hilang sendiri */}
      <div className="splash" aria-hidden="true"><Loader size={120} label="Nimeku" /></div>
      <Navbar />
      <main>{children}</main>
      <BottomNav />
      <TapFx />
      <Accent />
      <UpdateWatcher />
      <BackToTop />
      <CommunityPopup />
    </>
  );
}
