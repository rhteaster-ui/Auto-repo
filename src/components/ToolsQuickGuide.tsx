export function ToolsQuickGuide() {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5 space-y-1.5">
      <p className="text-xs text-zinc-200 font-semibold">Langkah cepat:</p>
      <ol className="list-decimal pl-4 text-xs text-zinc-300 space-y-1">
        <li>Pilih repository dari daftar.</li>
        <li>Tekan <span className="text-white font-medium">Sinkronkan</span> agar data file terbaru dari GitHub masuk.</li>
        <li>Centang file jika ingin dihapus, atau pilih file baru untuk ditambahkan.</li>
        <li>Tekan <span className="text-white font-medium">Simpan ke GitHub</span>.</li>
      </ol>
    </div>
  );
}
