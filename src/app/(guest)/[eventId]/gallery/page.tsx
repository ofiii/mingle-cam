"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";

interface GalleryPageProps {
  params: Promise<{ eventId: string }>;
}

interface PhotoItem {
  id: string;
  imageUrl: string;
  createdAt: string;
  guest: { name: string };
}

export default function GalleryPage({ params }: GalleryPageProps) {
  const { eventId } = use(params);

  const [loading, setLoading] = useState(true);
  const [eventName, setEventName] = useState("Mingle Session");
  const [revealDate, setRevealDate] = useState<Date | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [totalPhotos, setTotalPhotos] = useState(0);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoItem | null>(null);

  // Countdown state
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  const fetchEventData = async () => {
    try {
      const res = await fetch(`/api/events/${eventId}`);
      if (!res.ok) return;
      const data = await res.json();
      setEventName(data.event?.name || "Mingle Session");
      setTotalPhotos(data.event?.totalPhotos || 0);

      const targetDate = new Date(data.event.revealDate);
      setRevealDate(targetDate);
      setIsRevealed(data.isRevealed);
      if (data.isRevealed && data.photos) {
        setPhotos(data.photos);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEventData();
    // Poll status periodically (every 10s)
    const interval = setInterval(fetchEventData, 10000);
    return () => clearInterval(interval);
  }, [eventId]);

  // Live countdown ticker
  useEffect(() => {
    if (!revealDate || isRevealed) return;

    const timer = setInterval(() => {
      const diff = revealDate.getTime() - new Date().getTime();
      if (diff <= 0) {
        setIsRevealed(true);
        fetchEventData();
        clearInterval(timer);
        return;
      }

      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / 1000 / 60) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [revealDate, isRevealed]);

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-950 text-stone-100 flex items-center justify-center p-4">
        <div className="text-center font-mono">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-stone-400">Opening Album Vault...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col font-sans">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-stone-950/80 backdrop-blur-md border-b border-stone-800 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-bold text-stone-100 tracking-tight">
            {eventName}
          </h1>
          <p className="text-[11px] font-mono text-stone-400">
            {isRevealed ? `${photos.length} Revealed Moments` : `${totalPhotos} Photos Locked in Vault`}
          </p>
        </div>

        <Link
          href={`/${eventId}/camera`}
          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-mono text-xs font-bold rounded-lg shadow transition-all flex items-center space-x-1"
        >
          <span>📷</span>
          <span>Take Photos</span>
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6">
        {!isRevealed ? (
          /* LOCKED VAULT VIEW WITH COUNTDOWN */
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-20 h-20 rounded-full bg-stone-900 border-2 border-amber-500/40 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(245,158,11,0.2)]">
              <span className="text-3xl">🔒</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-stone-100 mb-2 font-mono">
              ALBUM IS LOCKED
            </h2>
            <p className="max-w-md text-stone-400 text-xs sm:text-sm font-mono mb-8">
              Photos taken during the mingle session are developing secretly in the vault. They will be revealed to everyone at:
              <br />
              <strong className="text-amber-400 font-semibold">
                {revealDate?.toLocaleString()}
              </strong>
            </p>

            {/* Countdown Grid */}
            <div className="grid grid-cols-4 gap-3 sm:gap-4 max-w-sm w-full mb-8 font-mono">
              {[
                { label: "DAYS", value: timeLeft.days },
                { label: "HOURS", value: timeLeft.hours },
                { label: "MINS", value: timeLeft.minutes },
                { label: "SECS", value: timeLeft.seconds },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="bg-stone-900 border border-stone-800 rounded-xl p-3 flex flex-col items-center justify-center shadow-inner"
                >
                  <span className="text-2xl sm:text-3xl font-extrabold text-amber-400 tabular-nums">
                    {String(item.value).padStart(2, "0")}
                  </span>
                  <span className="text-[10px] text-stone-500 tracking-wider">
                    {item.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Vault Stats */}
            <div className="inline-flex items-center space-x-2 px-4 py-2 bg-stone-900/80 rounded-full border border-stone-800 font-mono text-xs text-stone-300">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              <span>
                <strong>{totalPhotos}</strong> analog photos stored safely so far
              </span>
            </div>
          </div>
        ) : (
          /* UNLOCKED MASONRY GALLERY */
          <div>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <span className="text-xs uppercase font-mono tracking-wider text-amber-400 font-bold">
                  ✨ The Vault Is Open!
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-stone-100">
                  Shared Moments
                </h2>
              </div>
            </div>

            {photos.length === 0 ? (
              <div className="text-center py-20 text-stone-500 font-mono text-sm">
                No photos were captured yet. Be the first to snap one!
              </div>
            ) : (
              <div className="columns-1 sm:columns-2 md:columns-3 gap-4 space-y-4">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    onClick={() => setSelectedPhoto(photo)}
                    className="break-inside-avoid bg-stone-900 border border-stone-800 rounded-xl overflow-hidden cursor-pointer hover:border-amber-500/50 transition-all shadow-lg group relative"
                  >
                    <img
                      src={photo.imageUrl}
                      alt={`Photo by ${photo.guest.name}`}
                      loading="lazy"
                      className="w-full h-auto object-cover group-hover:scale-102 transition-transform duration-300"
                    />
                    <div className="p-3 flex items-center justify-between font-mono text-xs text-stone-400 bg-stone-900/90">
                      <span className="font-bold text-stone-200 truncate">
                        👤 {photo.guest.name}
                      </span>
                      <span className="text-[10px] text-stone-500">
                        {new Date(photo.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Lightbox Modal */}
      {selectedPhoto && (
        <div
          onClick={() => setSelectedPhoto(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
        >
          <div className="max-w-3xl max-h-[90vh] flex flex-col items-center">
            <img
              src={selectedPhoto.imageUrl}
              alt="Full resolution"
              className="max-h-[80vh] w-auto rounded-lg shadow-2xl object-contain border border-stone-800"
            />
            <div className="mt-3 font-mono text-xs text-stone-300 flex items-center space-x-4">
              <span>Captured by: <strong>{selectedPhoto.guest.name}</strong></span>
              <a
                href={selectedPhoto.imageUrl}
                target="_blank"
                rel="noreferrer"
                download
                onClick={(e) => e.stopPropagation()}
                className="text-amber-400 hover:underline"
              >
                Download Original ↗
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
