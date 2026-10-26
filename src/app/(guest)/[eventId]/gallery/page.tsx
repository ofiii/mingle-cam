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
  const [themeColor, setThemeColor] = useState("#461a3d");
  const [revealDate, setRevealDate] = useState<Date | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [totalPhotos, setTotalPhotos] = useState(0);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoItem | null>(null);
  const [currentGuest, setCurrentGuest] = useState<{ id: string; name: string } | null>(null);
  const [viewMode, setViewMode] = useState<"large" | "small" | "list">("large");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("mingle_gallery_view");
      if (saved === "large" || saved === "small" || saved === "list") {
        setViewMode(saved);
      }
    }
  }, []);

  const handleViewModeChange = (mode: "large" | "small" | "list") => {
    setViewMode(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("mingle_gallery_view", mode);
    }
  };

  // Countdown state
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    let mounted = true;

    async function fetchEventData() {
      try {
        const res = await fetch(`/api/events/${eventId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!mounted) return;

        setEventName(data.event?.name || "Mingle Session");
        if (data.event?.themeColor) setThemeColor(data.event.themeColor);
        setTotalPhotos(data.event?.totalPhotos || 0);
        if (data.currentGuest) {
          setCurrentGuest({ id: data.currentGuest.id, name: data.currentGuest.name });
        }

        const targetDate = new Date(data.event.revealDate);
        setRevealDate(targetDate);
        setIsRevealed(data.isRevealed);
        if (data.isRevealed && data.photos) {
          setPhotos(data.photos);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchEventData();
    const interval = setInterval(fetchEventData, 10000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [eventId]);

  // Live countdown ticker
  useEffect(() => {
    if (!revealDate || isRevealed) return;

    const timer = setInterval(() => {
      const diff = revealDate.getTime() - new Date().getTime();
      if (diff <= 0) {
        setIsRevealed(true);
        fetch(`/api/events/${eventId}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.photos) setPhotos(data.photos);
          })
          .catch(() => {});
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
  }, [revealDate, isRevealed, eventId]);

  const handleDeleteFromGallery = async (photoId: string) => {
    if (!confirm("Are you sure you want to delete this photo from the event album?")) return;
    try {
      const localToken =
        typeof window !== "undefined"
          ? localStorage.getItem(`mingle_token_${eventId}`)
          : null;
      const headers: Record<string, string> = {};
      if (localToken) headers["x-guest-session"] = localToken;

      const res = await fetch(`/api/photos?photoId=${photoId}&eventId=${eventId}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) throw new Error("Could not delete photo");
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      setSelectedPhoto(null);
    } catch (err: unknown) {
      alert((err as Error).message || "Failed to delete photo");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-950 text-stone-100 flex items-center justify-center p-4 font-sans">
        <div className="text-center">
          <div
            className="w-8 h-8 border-3 border-t-transparent rounded-full animate-spin mx-auto mb-3"
            style={{ borderColor: themeColor, borderTopColor: "transparent" }}
          />
          <p className="text-xs text-stone-400 font-medium">Opening Album Vault...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col font-sans select-none">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-stone-900/90 backdrop-blur-md border-b border-stone-800 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-bold text-white tracking-tight">
            {eventName}
          </h1>
          <p className="text-xs text-stone-400">
            {isRevealed
              ? `${photos.length} Photos Revealed`
              : `${totalPhotos} Photos Locked in Vault`}
          </p>
        </div>

        <Link
          href={`/${eventId}/camera`}
          style={{ backgroundColor: themeColor }}
          className="px-3.5 py-1.5 hover:brightness-110 text-white text-xs font-semibold rounded-xl border border-white/20 transition-all flex items-center space-x-1.5 shadow"
        >
          <span>📷</span>
          <span>Open Camera</span>
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6">
        {!isRevealed ? (
          /* LOCKED VAULT VIEW WITH COUNTDOWN */
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-stone-900 border border-stone-800 flex items-center justify-center mb-5 shadow">
              <span className="text-2xl">🔒</span>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
              Album Is Locked
            </h2>
            <p className="max-w-md text-stone-400 text-xs sm:text-sm mb-8 leading-relaxed">
              Every photo snapped by guests is developing secretly inside the event vault. All photos will be revealed together on:
              <br />
              <strong className="text-stone-200 font-semibold block mt-1">
                {revealDate?.toLocaleString(undefined, {
                  dateStyle: "full",
                  timeStyle: "short",
                })}
              </strong>
            </p>

            {/* Countdown Grid */}
            <div className="grid grid-cols-4 gap-2.5 sm:gap-4 max-w-sm w-full mb-8 font-sans">
              {[
                { label: "DAYS", value: timeLeft.days },
                { label: "HOURS", value: timeLeft.hours },
                { label: "MINS", value: timeLeft.minutes },
                { label: "SECS", value: timeLeft.seconds },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="bg-stone-900 border border-stone-800 rounded-2xl p-3 flex flex-col items-center justify-center shadow-sm"
                >
                  <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono tabular-nums">
                    {String(item.value).padStart(2, "0")}
                  </span>
                  <span className="text-[10px] text-stone-400 font-semibold tracking-wider mt-0.5">
                    {item.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Vault Stats */}
            <div className="inline-flex items-center space-x-2 px-4 py-2 bg-stone-900 rounded-full border border-stone-800 text-xs text-stone-300">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: themeColor }}
              />
              <span>
                <strong className="text-white font-bold">{totalPhotos}</strong> analog photos stored safely so far
              </span>
            </div>
          </div>
        ) : (
          /* UNLOCKED MASONRY GALLERY */
          <div>
            {/* Gallery Subheader with View Switcher */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span
                  className="text-xs uppercase tracking-wider font-bold"
                  style={{ color: themeColor }}
                >
                  ✨ The Vault Is Open!
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  Shared Moments ({photos.length})
                </h2>
              </div>

              {/* View Switcher: Large / Small / List */}
              <div className="inline-flex items-center space-x-1 bg-stone-900 border border-stone-800 p-1 rounded-2xl shadow-inner self-start sm:self-auto">
                <button
                  onClick={() => handleViewModeChange("large")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                    viewMode === "large"
                      ? "bg-white text-stone-900 shadow-md font-bold scale-[1.02]"
                      : "text-stone-400 hover:text-stone-200"
                  }`}
                  title="Large photo view"
                >
                  <span>🔲</span>
                  <span>Large</span>
                </button>

                <button
                  onClick={() => handleViewModeChange("small")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                    viewMode === "small"
                      ? "bg-white text-stone-900 shadow-md font-bold scale-[1.02]"
                      : "text-stone-400 hover:text-stone-200"
                  }`}
                  title="Small compact grid"
                >
                  <span>▦</span>
                  <span>Small</span>
                </button>

                <button
                  onClick={() => handleViewModeChange("list")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                    viewMode === "list"
                      ? "bg-white text-stone-900 shadow-md font-bold scale-[1.02]"
                      : "text-stone-400 hover:text-stone-200"
                  }`}
                  title="Feed list view"
                >
                  <span>☰</span>
                  <span>List</span>
                </button>
              </div>
            </div>

            {photos.length === 0 ? (
              <div className="text-center py-20 text-stone-500 text-sm">
                No photos have been captured yet for this event.
              </div>
            ) : viewMode === "large" ? (
              /* VIEW MODE: LARGE GRID */
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    onClick={() => setSelectedPhoto(photo)}
                    className="bg-stone-900 border border-stone-800 rounded-3xl overflow-hidden cursor-pointer hover:border-white/40 transition-all shadow-lg group relative flex flex-col"
                  >
                    <div className="w-full aspect-[3/4] overflow-hidden bg-black relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.imageUrl}
                        alt={`Photo by ${photo.guest.name}`}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white/80 opacity-0 group-hover:opacity-100 transition-opacity">
                        🔍
                      </div>
                    </div>
                    <div className="p-3.5 flex items-center justify-between text-xs text-stone-300 bg-stone-950 border-t border-stone-800/80">
                      <div className="flex items-center space-x-2 truncate">
                        <div className="w-6 h-6 rounded-full bg-stone-800 border border-stone-700 flex items-center justify-center text-[11px] font-bold text-stone-200 flex-shrink-0">
                          {photo.guest.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-white truncate">
                          {photo.guest.name}
                        </span>
                      </div>
                      <span className="text-[11px] text-stone-400 font-mono flex-shrink-0">
                        {new Date(photo.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : viewMode === "small" ? (
              /* VIEW MODE: SMALL TILES */
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 sm:gap-3">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    onClick={() => setSelectedPhoto(photo)}
                    className="aspect-[3/4] bg-stone-900 border border-stone-800 rounded-xl overflow-hidden cursor-pointer hover:border-white/50 transition-all shadow-sm group relative"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.imageUrl}
                      alt={`Photo by ${photo.guest.name}`}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute bottom-0 inset-x-0 p-1 bg-gradient-to-t from-black/85 via-black/40 to-transparent">
                      <span className="text-[10px] text-white/95 font-medium block truncate text-center drop-shadow">
                        {photo.guest.name}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* VIEW MODE: VERTICAL FEED / LIST */
              <div className="max-w-md mx-auto space-y-6">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="bg-stone-900 border border-stone-800 rounded-3xl overflow-hidden shadow-xl"
                  >
                    {/* Post Header */}
                    <div className="p-3.5 flex items-center justify-between border-b border-stone-800/80 bg-stone-950/60">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-8 h-8 rounded-full bg-stone-800 border border-stone-700 flex items-center justify-center text-xs font-bold text-stone-200">
                          {photo.guest.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-bold text-white text-xs block">
                            {photo.guest.name}
                          </span>
                          <span className="text-[10px] text-stone-400 font-mono">
                            {new Date(photo.createdAt).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-stone-800 text-stone-300 border border-stone-700">
                        3:4 Film
                      </span>
                    </div>

                    {/* Big Photo Container */}
                    <div
                      onClick={() => setSelectedPhoto(photo)}
                      className="w-full aspect-[3/4] bg-black overflow-hidden cursor-zoom-in relative group"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.imageUrl}
                        alt={`Photo by ${photo.guest.name}`}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-[1.01] transition-transform duration-300"
                      />
                    </div>

                    {/* Post Footer Actions */}
                    <div className="p-3 flex items-center justify-between text-xs bg-stone-950 border-t border-stone-800/80">
                      <button
                        onClick={() => setSelectedPhoto(photo)}
                        className="text-stone-300 hover:text-white flex items-center space-x-1.5 font-medium transition-colors"
                      >
                        <span>🔍</span>
                        <span>View Fullscreen</span>
                      </button>

                      <a
                        href={photo.imageUrl}
                        target="_blank"
                        rel="noreferrer"
                        download
                        className="px-3 py-1 bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold rounded-lg text-xs border border-stone-700 transition-colors flex items-center space-x-1"
                      >
                        <span>⬇️</span>
                        <span>Download</span>
                      </a>
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
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out"
        >
          <div className="max-w-3xl max-h-[90vh] flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedPhoto.imageUrl}
              alt="Full resolution capture"
              className="max-h-[80vh] w-auto rounded-2xl shadow-2xl object-contain border border-[#482243]"
            />
            <div className="mt-3 text-xs text-stone-200 flex items-center space-x-4">
              <span>Captured by: <strong className="text-white">{selectedPhoto.guest.name}</strong></span>
              <a
                href={selectedPhoto.imageUrl}
                target="_blank"
                rel="noreferrer"
                download
                onClick={(e) => e.stopPropagation()}
                className="text-[#d8a4cb] hover:text-white underline font-medium"
              >
                Download Original ↗
              </a>
              {currentGuest && currentGuest.name === selectedPhoto.guest.name && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteFromGallery(selectedPhoto.id);
                  }}
                  className="text-red-400 hover:text-red-300 underline font-medium"
                >
                  Delete 🗑️
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
