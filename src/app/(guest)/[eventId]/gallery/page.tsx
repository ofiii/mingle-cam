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
      <div className="min-h-screen bg-[#110510] text-fuchsia-100 flex items-center justify-center p-4 font-mono">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-fuchsia-500 border-t-transparent rounded-full animate-spin mx-auto mb-3 shadow-[0_0_12px_rgba(217,70,239,0.5)]" />
          <p className="text-xs text-fuchsia-300">Opening Plum Vault...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#110510] text-fuchsia-50 flex flex-col font-sans">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#190717]/85 backdrop-blur-md border-b border-[#3b1234] px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-bold text-fuchsia-100 tracking-tight">
            {eventName}
          </h1>
          <p className="text-[11px] font-mono text-fuchsia-400">
            {isRevealed ? `${photos.length} Revealed Moments` : `${totalPhotos} Photos Locked in Vault`}
          </p>
        </div>

        <Link
          href={`/${eventId}/camera`}
          className="px-3.5 py-1.5 bg-gradient-to-r from-[#7a2265] to-[#a82d8c] hover:brightness-110 text-fuchsia-100 font-mono text-xs font-bold rounded-lg shadow-lg border border-fuchsia-400/30 transition-all flex items-center space-x-1"
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
            <div className="w-20 h-20 rounded-full bg-[#20081e] border-2 border-[#6f235d] flex items-center justify-center mb-6 shadow-[0_0_35px_rgba(111,35,93,0.5)]">
              <span className="text-3xl">🔒</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-fuchsia-100 mb-2 font-mono">
              ALBUM IS LOCKED
            </h2>
            <p className="max-w-md text-fuchsia-300/80 text-xs sm:text-sm font-mono mb-8">
              Photos taken during the mingle session are developing secretly in the vault. They will be revealed to everyone at:
              <br />
              <strong className="text-fuchsia-300 font-semibold">
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
                  className="bg-[#1f071d] border border-[#48153f] rounded-xl p-3 flex flex-col items-center justify-center shadow-inner"
                >
                  <span className="text-2xl sm:text-3xl font-extrabold text-fuchsia-200 tabular-nums">
                    {String(item.value).padStart(2, "0")}
                  </span>
                  <span className="text-[10px] text-fuchsia-400 tracking-wider">
                    {item.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Vault Stats */}
            <div className="inline-flex items-center space-x-2 px-4 py-2 bg-[#20081e] rounded-full border border-[#4f1645] font-mono text-xs text-fuchsia-200">
              <span className="w-2 h-2 rounded-full bg-fuchsia-500 animate-ping" />
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
                <span className="text-xs uppercase font-mono tracking-wider text-fuchsia-400 font-bold">
                  ✨ The Vault Is Open!
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-fuchsia-100">
                  Shared Moments
                </h2>
              </div>
            </div>

            {photos.length === 0 ? (
              <div className="text-center py-20 text-fuchsia-400/60 font-mono text-sm">
                No photos were captured yet. Be the first to snap one!
              </div>
            ) : (
              <div className="columns-1 sm:columns-2 md:columns-3 gap-4 space-y-4">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    onClick={() => setSelectedPhoto(photo)}
                    className="break-inside-avoid bg-[#1e071c] border border-[#44133b] rounded-2xl overflow-hidden cursor-pointer hover:border-fuchsia-400/60 transition-all shadow-xl group relative"
                  >
                    <img
                      src={photo.imageUrl}
                      alt={`Photo by ${photo.guest.name}`}
                      loading="lazy"
                      className="w-full h-auto object-cover group-hover:scale-102 transition-transform duration-300"
                    />
                    <div className="p-3 flex items-center justify-between font-mono text-xs text-fuchsia-300 bg-[#1a0518]/95 border-t border-[#3b1034]">
                      <span className="font-bold text-fuchsia-100 truncate">
                        👤 {photo.guest.name}
                      </span>
                      <span className="text-[10px] text-fuchsia-400">
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
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
        >
          <div className="max-w-3xl max-h-[90vh] flex flex-col items-center">
            <img
              src={selectedPhoto.imageUrl}
              alt="Full resolution"
              className="max-h-[80vh] w-auto rounded-xl shadow-2xl object-contain border border-[#521747]"
            />
            <div className="mt-3 font-mono text-xs text-fuchsia-200 flex items-center space-x-4">
              <span>Captured by: <strong>{selectedPhoto.guest.name}</strong></span>
              <a
                href={selectedPhoto.imageUrl}
                target="_blank"
                rel="noreferrer"
                download
                onClick={(e) => e.stopPropagation()}
                className="text-fuchsia-400 hover:text-fuchsia-200 underline"
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
