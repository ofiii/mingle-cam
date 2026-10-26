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
  
  // View mode is strictly "large" | "small"
  const [viewMode, setViewMode] = useState<"large" | "small">("large");

  // Helper to read locally deleted photos from sessionStorage
  const getDeletedIds = (): Set<string> => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = sessionStorage.getItem(`mingle_deleted_photos_${eventId}`);
      if (raw) return new Set(JSON.parse(raw));
    } catch (_) {}
    return new Set();
  };

  // Read view mode and instant session cache on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("mingle_gallery_view");
      if (saved === "large" || saved === "small") {
        setViewMode(saved);
      }

      // Instant 0ms cache retrieval
      try {
        const rawCache = sessionStorage.getItem(`mingle_gallery_cache_${eventId}`);
        if (rawCache) {
          const cached = JSON.parse(rawCache);
          const deletedIds = getDeletedIds();
          if (cached.eventName) setEventName(cached.eventName);
          if (cached.themeColor) setThemeColor(cached.themeColor);
          if (cached.totalPhotos !== undefined) setTotalPhotos(cached.totalPhotos);
          if (cached.revealDate) setRevealDate(new Date(cached.revealDate));
          if (cached.isRevealed !== undefined) setIsRevealed(cached.isRevealed);
          if (cached.photos && Array.isArray(cached.photos)) {
            setPhotos(cached.photos.filter((p: PhotoItem) => !deletedIds.has(p.id)));
          }
          if (cached.currentGuest) setCurrentGuest(cached.currentGuest);
          setLoading(false);
        }
      } catch (_) {}
    }
  }, [eventId]);

  const handleViewModeChange = (mode: "large" | "small") => {
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
        const localToken =
          typeof window !== "undefined"
            ? localStorage.getItem(`mingle_token_${eventId}`)
            : null;
        const headers: Record<string, string> = {};
        if (localToken) headers["x-guest-session"] = localToken;

        const res = await fetch(`/api/events/${eventId}`, { headers });
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
        const deletedIds = getDeletedIds();
        if (data.isRevealed && data.photos) {
          const activePhotos = data.photos.filter((p: PhotoItem) => !deletedIds.has(p.id));
          setPhotos(activePhotos);
        }

        // Cache response in sessionStorage for instant loading on subsequent views
        try {
          const activePhotos = data.photos
            ? data.photos.filter((p: PhotoItem) => !deletedIds.has(p.id))
            : [];
          sessionStorage.setItem(
            `mingle_gallery_cache_${eventId}`,
            JSON.stringify({
              eventName: data.event?.name,
              themeColor: data.event?.themeColor,
              totalPhotos: data.event?.totalPhotos,
              revealDate: data.event?.revealDate,
              isRevealed: data.isRevealed,
              photos: activePhotos,
              currentGuest: data.currentGuest || null,
            })
          );
        } catch (_) {}
      } catch (e) {
        console.error(e);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchEventData();

    // Only set poll interval if vault is still locked
    let interval: NodeJS.Timeout | null = null;
    if (!isRevealed) {
      interval = setInterval(fetchEventData, 10000);
    }

    return () => {
      mounted = false;
      if (interval) clearInterval(interval);
    };
  }, [eventId, isRevealed]);

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
            const deletedIds = getDeletedIds();
            if (data.photos) {
              setPhotos(data.photos.filter((p: PhotoItem) => !deletedIds.has(p.id)));
            }
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

    // 1. Instantly remove from UI optimistically (0ms)
    const prevPhotos = [...photos];
    const prevTotal = totalPhotos;
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    setTotalPhotos((prev) => Math.max(0, prev - 1));
    setSelectedPhoto(null);

    // 2. Mark in sessionStorage deleted list and update gallery cache immediately
    if (typeof window !== "undefined") {
      try {
        let deletedSet: string[] = [];
        const raw = sessionStorage.getItem(`mingle_deleted_photos_${eventId}`);
        if (raw) deletedSet = JSON.parse(raw);
        if (!deletedSet.includes(photoId)) deletedSet.push(photoId);
        sessionStorage.setItem(`mingle_deleted_photos_${eventId}`, JSON.stringify(deletedSet));

        // Update gallery cache
        const rawCache = sessionStorage.getItem(`mingle_gallery_cache_${eventId}`);
        if (rawCache) {
          const parsed = JSON.parse(rawCache);
          if (parsed.photos && Array.isArray(parsed.photos)) {
            parsed.photos = parsed.photos.filter((p: PhotoItem) => p.id !== photoId);
          }
          if (parsed.totalPhotos !== undefined) {
            parsed.totalPhotos = Math.max(0, parsed.totalPhotos - 1);
          }
          sessionStorage.setItem(`mingle_gallery_cache_${eventId}`, JSON.stringify(parsed));
        }
      } catch (_) {}
    }

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
    } catch (err: unknown) {
      setPhotos(prevPhotos);
      setTotalPhotos(prevTotal);
      alert((err as Error).message || "Failed to delete photo");
    }
  };

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
          prefetch={true}
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
                {revealDate ? (
                  revealDate.toLocaleString(undefined, {
                    dateStyle: "full",
                    timeStyle: "short",
                  })
                ) : (
                  <span className="inline-block w-40 h-4 bg-stone-800 rounded animate-pulse" />
                )}
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
          /* UNLOCKED GALLERY */
          <div>
            {/* Gallery Subheader with View Switcher: ONLY Large & Small */}
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

              {/* View Switcher: Strictly 2 Options (Large & Small) */}
              <div className="inline-flex items-center space-x-1 bg-stone-900 border border-stone-800 p-1 rounded-2xl shadow-inner self-start sm:self-auto">
                <button
                  onClick={() => handleViewModeChange("large")}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                    viewMode === "large"
                      ? "bg-white text-stone-900 shadow-md font-bold scale-[1.02]"
                      : "text-stone-400 hover:text-stone-200"
                  }`}
                  title="Large feed view"
                >
                  <span>🔲</span>
                  <span>Large</span>
                </button>

                <button
                  onClick={() => handleViewModeChange("small")}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                    viewMode === "small"
                      ? "bg-white text-stone-900 shadow-md font-bold scale-[1.02]"
                      : "text-stone-400 hover:text-stone-200"
                  }`}
                  title="Small compact grid"
                >
                  <span>▦</span>
                  <span>Small</span>
                </button>
              </div>
            </div>

            {loading && photos.length === 0 ? (
              /* FAST SKELETON LOADER FOR INSTANT PERCEIVED PERFORMANCE */
              viewMode === "large" ? (
                <div className="max-w-md mx-auto space-y-6">
                  {[1, 2].map((n) => (
                    <div
                      key={n}
                      className="bg-stone-900 border border-stone-800 rounded-3xl overflow-hidden animate-pulse shadow-xl"
                    >
                      <div className="p-3.5 flex items-center space-x-2.5 border-b border-stone-800/80 bg-stone-950/60">
                        <div className="w-8 h-8 rounded-full bg-stone-800" />
                        <div className="space-y-1.5 flex-1">
                          <div className="h-3 bg-stone-800 rounded w-1/3" />
                          <div className="h-2 bg-stone-800/60 rounded w-1/4" />
                        </div>
                      </div>
                      <div className="w-full aspect-[3/4] bg-stone-950 flex items-center justify-center">
                        <div
                          className="w-8 h-8 border-2 rounded-full animate-spin"
                          style={{ borderColor: themeColor, borderTopColor: "transparent" }}
                        />
                      </div>
                      <div className="p-3 bg-stone-950 border-t border-stone-800/80 flex justify-between">
                        <div className="h-4 bg-stone-800 rounded w-24" />
                        <div className="h-4 bg-stone-800 rounded w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 sm:gap-3">
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <div
                      key={n}
                      className="aspect-[3/4] bg-stone-900 border border-stone-800 rounded-xl animate-pulse"
                    />
                  ))}
                </div>
              )
            ) : photos.length === 0 ? (
              <div className="text-center py-20 text-stone-500 text-sm">
                No photos have been captured yet for this event.
              </div>
            ) : viewMode === "large" ? (
              /* VIEW MODE: LARGE (Single-column feed format, previously 'list') */
              <div className="max-w-md mx-auto space-y-6">
                {photos.map((photo, idx) => (
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
                      className="w-full aspect-[3/4] bg-stone-950 overflow-hidden cursor-zoom-in relative group"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.imageUrl}
                        alt={`Photo by ${photo.guest.name}`}
                        loading={idx < 2 ? "eager" : "lazy"}
                        decoding="async"
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
            ) : (
              /* VIEW MODE: SMALL TILES */
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 sm:gap-3">
                {photos.map((photo, idx) => (
                  <div
                    key={photo.id}
                    onClick={() => setSelectedPhoto(photo)}
                    className="aspect-[3/4] bg-stone-900 border border-stone-800 rounded-xl overflow-hidden cursor-pointer hover:border-white/50 transition-all shadow-sm group relative"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.imageUrl}
                      alt={`Photo by ${photo.guest.name}`}
                      loading={idx < 6 ? "eager" : "lazy"}
                      decoding="async"
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
              className="max-h-[80vh] w-auto rounded-2xl shadow-2xl object-contain border border-stone-800"
            />
            <div className="mt-3 text-xs text-stone-200 flex items-center space-x-4">
              <span>Captured by: <strong className="text-white">{selectedPhoto.guest.name}</strong></span>
              <a
                href={selectedPhoto.imageUrl}
                target="_blank"
                rel="noreferrer"
                download
                onClick={(e) => e.stopPropagation()}
                className="text-white underline font-medium hover:text-stone-300"
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
