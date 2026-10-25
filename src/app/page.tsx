import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col justify-between p-6 sm:p-12 font-sans relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="flex items-center justify-between z-10">
        <div className="flex items-center space-x-2">
          <div className="w-3.5 h-3.5 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]" />
          <span className="font-mono text-sm tracking-widest font-black uppercase text-stone-200">
            Mingle Cam
          </span>
        </div>

        <Link
          href="/dashboard"
          className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-stone-200 font-mono text-xs font-bold rounded-xl border border-stone-800 transition-colors"
        >
          Organizer Dashboard →
        </Link>
      </header>

      {/* Hero */}
      <main className="max-w-2xl mx-auto text-center my-auto py-12 z-10">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-xs font-semibold mb-6">
          <span>🎞️</span>
          <span>Web-Based Disposable Camera</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black text-stone-100 tracking-tight leading-tight">
          Capture Real Moments. <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500">
            Reveal Them Together.
          </span>
        </h1>

        <p className="mt-6 text-stone-400 text-sm sm:text-base font-mono max-w-lg mx-auto">
          Guests scan the event QR code, snap photos with an authentic 35mm analog filter and orange date stamp, and all shots stay locked in the Cloudflare R2 vault until the party climax.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/dashboard"
            className="w-full sm:w-auto px-8 py-4 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-2xl shadow-xl transition-transform active:scale-95 font-mono uppercase tracking-wider text-sm flex items-center justify-center space-x-2"
          >
            <span>Create Session in Dashboard</span>
            <span>⚡</span>
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left font-mono text-xs">
          <div className="p-4 bg-stone-900/60 border border-stone-800/80 rounded-xl">
            <div className="text-amber-400 text-base mb-1">01. No App Needed</div>
            <p className="text-stone-400">
              Runs instantly in mobile Safari & Chrome with single-click session cookies.
            </p>
          </div>
          <div className="p-4 bg-stone-900/60 border border-stone-800/80 rounded-xl">
            <div className="text-amber-400 text-base mb-1">02. Analog Grade</div>
            <p className="text-stone-400">
              Destructive HTML5 canvas filter with vintage film grain and LCD date stamp.
            </p>
          </div>
          <div className="p-4 bg-stone-900/60 border border-stone-800/80 rounded-xl">
            <div className="text-amber-400 text-base mb-1">03. The Vault</div>
            <p className="text-stone-400">
              Direct R2 presigned uploads. Photos stay locked until your scheduled reveal.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center font-mono text-xs text-stone-600 z-10">
        Next.js 16 • Cloudflare R2 Storage • Supabase PostgreSQL • Prisma ORM
      </footer>
    </div>
  );
}
