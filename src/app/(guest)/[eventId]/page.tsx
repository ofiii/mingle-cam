"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";

interface GuestLandingProps {
  params: Promise<{ eventId: string }>;
}

export default function GuestLandingPage({ params }: GuestLandingProps) {
  const { eventId } = use(params);
  const router = useRouter();

  const [eventName, setEventName] = useState<string>("");
  const [guestName, setGuestName] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    async function checkExistingSession() {
      try {
        const res = await fetch(`/api/events/${eventId}`);
        if (!res.ok) {
          setError("Event not found or invalid link.");
          setLoading(false);
          return;
        }
        const data = await res.json();
        setEventName(data.event?.name || "Mingle Session");

        // If guest session already exists, forward to camera
        if (data.currentGuest) {
          router.replace(`/${eventId}/camera`);
          return;
        }
      } catch {
        setError("Failed to load event details.");
      } finally {
        setLoading(false);
      }
    }

    checkExistingSession();
  }, [eventId, router]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) return;

    try {
      setSubmitting(true);
      setError("");

      const res = await fetch("/api/auth/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          name: guestName.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to register guest");
      }

      // Session cookie is set by API Route. Proceed to camera!
      router.push(`/${eventId}/camera`);
    } catch (err: unknown) {
      setError((err as Error).message || "An unexpected error occurred");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-950 text-stone-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="font-mono text-sm tracking-widest text-amber-500 uppercase">
            Loading Camera...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Vintage film roll graphic accent */}
      <div className="absolute top-0 left-0 right-0 h-4 bg-repeat-x flex justify-between px-2 opacity-30 select-none pointer-events-none">
        {Array.from({ length: 16 }).map((_, i) => (
          <div key={i} className="w-4 h-3 bg-stone-800 rounded-sm" />
        ))}
      </div>

      <div className="w-full max-w-md bg-stone-900 border border-stone-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative z-10">
        <div className="text-center mb-6">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-xs font-semibold mb-3">
            <span>📸</span>
            <span>Mingle Disposable 35mm</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-100 tracking-tight">
            {eventName || "Mingle Session"}
          </h1>
          <p className="text-xs sm:text-sm text-stone-400 mt-2 font-mono">
            Every photo you snap is filtered like vintage analog film and hidden in the album vault until the grand reveal!
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-lg bg-red-950/50 border border-red-800/60 text-red-300 text-xs font-mono">
            {error}
          </div>
        )}

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label
              htmlFor="guestName"
              className="block text-xs font-mono font-medium text-stone-300 uppercase tracking-wider mb-2"
            >
              Enter Your Name / Nickname
            </label>
            <input
              id="guestName"
              type="text"
              required
              maxLength={40}
              placeholder="e.g. Alex"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              disabled={submitting}
              className="w-full px-4 py-3 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 placeholder-stone-600 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium text-sm transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !guestName.trim()}
            className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-stone-950 font-bold rounded-xl shadow-lg transition-transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed font-mono uppercase tracking-wider text-sm flex items-center justify-center space-x-2"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-stone-950 border-t-transparent rounded-full animate-spin" />
                <span>Loading Film...</span>
              </>
            ) : (
              <span>Grab Your Camera 📷</span>
            )}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-stone-800/80 flex items-center justify-between text-[11px] font-mono text-stone-500">
          <span>🔒 One-click Mobile Cookie</span>
          <span>⚡ Direct R2 Storage</span>
        </div>
      </div>
    </div>
  );
}
