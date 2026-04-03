import { ExternalLink } from 'lucide-react';
import { DEV_PROFILE, DEV_SOCIALS, WEB_ICON } from '../lib/site-info';

export function InfoWebSection() {
  return (
    <div className="space-y-3">
      <section className="app-card p-3.5 space-y-2">
        <div className="flex items-center gap-2">
          <img src={WEB_ICON} alt="RepoFlow icon" className="w-8 h-8 rounded-lg border border-white/15" referrerPolicy="no-referrer" />
          <h3 className="text-sm font-semibold text-white">Tentang Website</h3>
        </div>
        <p className="text-xs text-zinc-300 leading-relaxed">RepoFlow adalah web untuk membuat dan mengelola repository GitHub secara cepat: upload multi-file/ZIP, kontrol file (hapus + tambah), sinkron realtime sebelum simpan, dan histori aktivitas.</p>
        <ul className="text-xs text-zinc-400 list-disc pl-4 space-y-1">
          <li>Fungsi utama: push repo baru dari ZIP/file.</li>
          <li>Kontrol update: tambah file, hapus file, dan cek konflik supaya edit di GitHub tidak hilang.</li>
          <li>Monitoring: riwayat aktivitas serta waktu dibuat dan diperbarui.</li>
        </ul>
      </section>

      <section className="app-card p-3.5 space-y-2">
        <h3 className="text-sm font-semibold text-white">Info Developer</h3>
        <div className="flex items-center gap-2.5">
          <img src={DEV_PROFILE} alt="Developer profile" className="w-10 h-10 rounded-lg border border-white/10 object-cover" referrerPolicy="no-referrer" />
          <div>
            <p className="text-xs text-white font-semibold">Rahmat (rAi_engine)</p>
            <p className="text-[11px] text-zinc-500">Channel & social media developer</p>
          </div>
        </div>
        <div className="space-y-1.5">
          {DEV_SOCIALS.map((item) => (
            <a key={item.url} href={item.url} target="_blank" rel="noreferrer" className="link-item">
              <span>{item.label}</span>
              <ExternalLink size={12} />
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
