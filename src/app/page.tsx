import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#131114] text-stone-100 flex flex-col justify-between p-6 sm:p-12 font-sans relative overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between z-10 max-w-5xl w-full mx-auto">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-[#9b4288]" />
          <span className="text-sm tracking-wider font-bold uppercase text-stone-200">
            Mingle Cam
          </span>
        </div>

        <Link
          href="/dashboard"
          className="px-4 py-2 bg-[#1c161d] hover:bg-[#281e2a] text-stone-200 text-xs font-semibold rounded-xl border border-[#382736] transition-colors"
        >
          Organizer Dashboard →
        </Link>
      </header>

      {/* Hero */}
      <main className="max-w-2xl mx-auto text-center my-auto py-12 z-10">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-[#351a30] border border-[#52294a] text-[#e0b7d6] text-xs font-semibold mb-6">
          <span>🎞️</span>
          <span>Shared Disposable Camera for Events</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-bold text-white tracking-tight leading-tight">
          Capture Real Moments. <br />
          <span className="text-[#d8a4cb]">
            Reveal Them Together.
          </span>
        </h1>

        <p className="mt-5 text-stone-400 text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
          Tamu cukup scan QR acara untuk mendapatkan roll kamera 20 foto dengan filter analog 4:3. Semua hasil foto dirahasiakan di brankas digital hingga momen pesta reveal!
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/dashboard"
            className="w-full sm:w-auto px-8 py-3.5 bg-[#461a3d] hover:bg-[#59214e] text-white font-bold rounded-2xl shadow-lg transition-transform active:scale-95 text-sm flex items-center justify-center space-x-2 border border-[#6b285d]"
          >
            <span>Buka Organizer Dashboard</span>
            <span>✨</span>
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left text-xs">
          <div className="p-4 bg-[#1c161d] border border-[#352533] rounded-2xl">
            <div className="text-[#d8a4cb] font-bold text-sm mb-1">01. Tanpa Aplikasi</div>
            <p className="text-stone-400 leading-relaxed">
              Langsung terbuka di browser Safari & Chrome tanpa perlu download apapun.
            </p>
          </div>
          <div className="p-4 bg-[#1c161d] border border-[#352533] rounded-2xl">
            <div className="text-[#d8a4cb] font-bold text-sm mb-1">02. 4:3 Analog Frame</div>
            <p className="text-stone-400 leading-relaxed">
              Preset warna Moody Plum, Classic 35mm, dan B&W Noir yang langsung dipanggang ke foto.
            </p>
          </div>
          <div className="p-4 bg-[#1c161d] border border-[#352533] rounded-2xl">
            <div className="text-[#d8a4cb] font-bold text-sm mb-1">03. The Vault</div>
            <p className="text-stone-400 leading-relaxed">
              Foto terkunci aman di Cloudflare R2 hingga waktu reveal yang ditentukan tiba.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-stone-500 z-10 max-w-5xl w-full mx-auto">
        Next.js 16 • Cloudflare R2 • Supabase PostgreSQL • Prisma ORM
      </footer>
    </div>
  );
}
