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
          setError("Event not found or link is invalid.");
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
        throw new Error(data.error || "Failed to join event");
      }

      router.push(`/${eventId}/camera`);
    } catch (err: unknown) {
      setError((err as Error).message || "An unexpected error occurred. Please try again.");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#131114] text-stone-100 flex items-center justify-center p-4 font-sans">
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-[#9b4288] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-stone-400 font-medium tracking-wide">
            Loading Camera...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#131114] text-stone-100 flex flex-col items-center justify-center p-4 sm:p-6 font-sans select-none">
      <div className="w-full max-w-sm bg-[#1c161d] border border-[#382736] rounded-3xl p-6 sm:p-8 shadow-xl relative">
        <div className="text-center mb-6">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#351a30] text-[#e0b7d6] text-xs font-semibold mb-3 border border-[#52294a]">
            <span>📷</span>
            <span>Shared Disposable Camera</span>
          </div>

          <h1 className="text-2xl font-bold text-white tracking-tight">
            {eventName || "Mingle Session"}
          </h1>
          <p className="text-xs sm:text-sm text-stone-400 mt-2 leading-relaxed">
            Capture authentic event moments with vintage analog filters! Each guest receives a roll of <strong className="text-stone-200">20 exposures</strong> locked in secret until the party reveal.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-800/80 text-red-200 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label
              htmlFor="guestName"
              className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-2"
            >
              Your Name or Nickname
            </label>
            <input
              id="guestName"
              type="text"
              required
              maxLength={40}
              placeholder="e.g. Alex or Maya"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              disabled={submitting}
              className="w-full px-4 py-3 bg-[#140e14] border border-[#3e2b3c] rounded-xl text-stone-100 placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-[#9b4288] font-medium text-sm transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !guestName.trim()}
            className="w-full py-3.5 bg-[#461a3d] hover:bg-[#59214e] text-white font-bold rounded-xl shadow transition-transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center space-x-2 border border-[#6b285d]"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Preparing Film...</span>
              </>
            ) : (
              <span>Grab Your Camera 📷</span>
            )}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-[#2e202c] text-center">
          <span className="text-[11px] text-stone-500 block">
            Digital Film Roll • 3:4 Portrait Vintage • 20 Exposures / Guest
          </span>
        </div>
      </div>
    </div>
  );
}
