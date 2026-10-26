"use client";

import React, { useState, useRef, useEffect, use, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  EFFECT_PRESETS,
  FilterEffect,
  captureVideoFrame,
  applyAnalogFilter,
  getEffectPreset,
} from "@/lib/canvas-filter";
import { uploadFilteredPhotoToR2 } from "@/lib/upload-service";

interface CameraPageProps {
  params: Promise<{ eventId: string }>;
}

interface GuestPhotoItem {
  id: string;
  imageUrl: string;
  previewUrl?: string;
  createdAt: string;
}

export default function CameraPage({ params }: CameraPageProps) {
  const { eventId } = use(params);
  const router = useRouter();

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [selectedEffect, setSelectedEffect] = useState<FilterEffect>("signature");
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [flashActive, setFlashActive] = useState(false);

  // Dynamic Camera Theme Color & Photo Capacity
  const [themeColor, setThemeColor] = useState<string>("#461a3d");
  const [maxPhotosLimit, setMaxPhotosLimit] = useState<number>(20);

  // Flash toggle: "off" | "on"
  const [flashMode, setFlashMode] = useState<"off" | "on">("off");

  // Camera Zoom Level: 0.5 | 1 | 2 (Default is strictly 1x)
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Photos taken by this guest (max 20)
  const [photosTaken, setPhotosTaken] = useState(0);
  const [lastPreview, setLastPreview] = useState<string | null>(null);
  const [bannerText, setBannerText] = useState<string | null>(null);
  const [eventName, setEventName] = useState("Mingle Session");
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(false);

  // Manage Guest Photos Modal
  const [showMyPhotosModal, setShowMyPhotosModal] = useState(false);
  const [myPhotos, setMyPhotos] = useState<GuestPhotoItem[]>([]);
  const [loadingMyPhotos, setLoadingMyPhotos] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const deletedPhotoIdsRef = useRef<Set<string>>(new Set());

  // Load previously deleted photo IDs & cached lastPreview from sessionStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = sessionStorage.getItem(`mingle_deleted_photos_${eventId}`);
        if (raw) {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) {
            arr.forEach((id: string) => deletedPhotoIdsRef.current.add(id));
          }
        }
        const cachedLastPreview = sessionStorage.getItem(`mingle_last_preview_${eventId}`);
        if (cachedLastPreview) {
          setLastPreview(cachedLastPreview);
        }
      } catch (_) {}
    }
  }, [eventId]);

  // Tap-to-Focus State
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const [focusPixel, setFocusPixel] = useState<{ x: number; y: number } | null>(null);
  const [focusActive, setFocusActive] = useState<boolean>(false);
  const focusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to reliably resume video playback if mobile browser paused it
  const resumeCamera = useCallback(async () => {
    if (videoRef.current) {
      try {
        if (videoRef.current.paused) {
          await videoRef.current.play();
        }
      } catch (e) {
        console.warn("Could not resume camera play:", e);
      }
    }
  }, []);

  // Synchronize guest photos list, photo count, and lastPreview with cache busting
  const refreshPhotos = useCallback(async () => {
    try {
      const localToken =
        typeof window !== "undefined"
          ? localStorage.getItem(`mingle_token_${eventId}`)
          : null;

      const headers: Record<string, string> = {};
      if (localToken) {
        headers["x-guest-session"] = localToken;
      }

      const res = await fetch(`/api/photos?eventId=${eventId}&_t=${Date.now()}`, {
        headers,
        cache: "no-store",
      });

      if (!res.ok) return;
      const data = await res.json();
      if (data.photos && Array.isArray(data.photos)) {
        setMyPhotos((prev) => {
          // Keep in-flight optimistic uploads (temp-*)
          const pending = prev.filter((p) => p.id.startsWith("temp-"));

          // Map server photos and strictly exclude any photo that was deleted locally!
          const serverPhotos: GuestPhotoItem[] = data.photos
            .filter((sp: GuestPhotoItem) => !deletedPhotoIdsRef.current.has(sp.id))
            .map((sp: GuestPhotoItem) => {
              const existing = prev.find((ep) => ep.id === sp.id);
              return existing?.previewUrl ? { ...sp, previewUrl: existing.previewUrl } : sp;
            });

          // Pending uploads always stay on top
          const combined = pending.length > 0 ? [...pending, ...serverPhotos] : serverPhotos;

          // Synchronize lastPreview strictly from the newest valid photo (never resurrected)
          if (combined.length > 0) {
            const newest = combined[0];
            const newestUrl = newest.previewUrl || newest.imageUrl;
            setLastPreview(newestUrl);
            if (typeof window !== "undefined") {
              try {
                sessionStorage.setItem(`mingle_last_preview_${eventId}`, newestUrl);
              } catch (_) {}
            }
          } else {
            setLastPreview(null);
            if (typeof window !== "undefined") {
              try {
                sessionStorage.removeItem(`mingle_last_preview_${eventId}`);
              } catch (_) {}
            }
          }

          return combined;
        });
      }
      if (data.photoCount !== undefined) {
        setPhotosTaken((prev) => Math.max(prev, data.photoCount));
      }
      if (data.maxPhotos) {
        setMaxPhotosLimit(data.maxPhotos);
      }
    } catch (err) {
      console.error("Failed to refresh photos:", err);
    }
  }, [eventId]);

  // Load event details and verify guest session on mount
  useEffect(() => {
    let mounted = true;

    const localToken =
      typeof window !== "undefined"
        ? localStorage.getItem(`mingle_token_${eventId}`)
        : null;

    const headers: Record<string, string> = {};
    if (localToken) {
      headers["x-guest-session"] = localToken;
    }

    fetch(`/api/events/${eventId}`, { headers, cache: "no-store" })
      .then((res) => {
        if (!res.ok) {
          router.replace(`/${eventId}`);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (!mounted || !data) return;
        // If guest has not registered or session is invalid, redirect to claim guest slot
        if (!data.currentGuest) {
          router.replace(`/${eventId}`);
          return;
        }
        if (data.event?.name) setEventName(data.event.name);
        if (data.event?.themeColor) setThemeColor(data.event.themeColor);
        if (data.event?.maxPhotosPerGuest) setMaxPhotosLimit(data.event.maxPhotosPerGuest);
        if (data.currentGuest?.photoCount !== undefined) {
          setPhotosTaken(data.currentGuest.photoCount);
        }

        // Cache event metadata so clicking gallery opens in 0ms
        try {
          sessionStorage.setItem(
            `mingle_gallery_cache_${eventId}`,
            JSON.stringify({
              eventName: data.event?.name,
              themeColor: data.event?.themeColor,
              totalPhotos: data.event?.totalPhotos,
              revealDate: data.event?.revealDate,
              isRevealed: data.isRevealed,
              photos: data.photos || [],
              currentGuest: data.currentGuest || null,
            })
          );
        } catch (_) {}
      })
      .catch(() => {});

    // Initial sync of photos for Last Photo preview & My Shots
    refreshPhotos();

    return () => {
      mounted = false;
    };
  }, [eventId, router, refreshPhotos]);

  // Keep camera alive across visibility and focus changes
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        resumeCamera();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", resumeCamera);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", resumeCamera);
    };
  }, [resumeCamera]);

  // Handle live video stream with 3:4 PORTRAIT aspect ratio
  useEffect(() => {
    let active = true;
    let localStream: MediaStream | null = null;

    async function setupCamera() {
      try {
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1080 },
            height: { ideal: 1440 },
            aspectRatio: { ideal: 3 / 4 },
          },
          audio: false,
        };

        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!active) {
          mediaStream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStream = mediaStream;
        setStream(mediaStream);
        setCameraReady(true);
        setCameraError(false);

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (err) {
        if (active) {
          console.warn("Camera streaming not supported or denied", err);
          setCameraError(true);
        }
      }
    }

    setupCamera();

    return () => {
      active = false;
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [facingMode]);

  // Apply Hardware Zoom if supported by camera device
  useEffect(() => {
    if (!stream) return;
    try {
      const track = stream.getVideoTracks()[0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const caps = track?.getCapabilities?.() as any;
      if (caps && caps.zoom) {
        const min = caps.zoom.min || 1;
        const max = caps.zoom.max || 3;
        const targetZoom = Math.max(min, Math.min(max, zoomLevel));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        track.applyConstraints({ advanced: [{ zoom: targetZoom } as any] }).catch(() => {});
      }
    } catch {
      // Graceful fallback to software crop/scale
    }
  }, [zoomLevel, stream]);

  const toggleFacingMode = () => {
    if (isProcessing) return;
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
    setZoomLevel(1); // Reset zoom to default 1x on camera flip
  };

  const toggleFlash = () => {
    setFlashMode((prev) => (prev === "off" ? "on" : "off"));
  };

  const isLimitReached = photosTaken >= maxPhotosLimit;
  const remainingShots = Math.max(0, maxPhotosLimit - photosTaken);

  // Trigger Flash burst ONLY during shutter capture ("pas jepret")
  const triggerFlashBurst = async () => {
    if (flashMode !== "on") return;

    // Full screen white flash pulse for selfie & ambient fill
    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 240);

    // Hardware torch instant burst on capture (turns off automatically after 240ms)
    if (stream && facingMode === "environment") {
      try {
        const track = stream.getVideoTracks()[0];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const caps = track?.getCapabilities?.() as any;
        if (caps?.torch) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await track.applyConstraints({ advanced: [{ torch: true } as any] }).catch(() => {});
          setTimeout(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            track.applyConstraints({ advanced: [{ torch: false } as any] }).catch(() => {});
          }, 240);
        }
      } catch {
        // Torch not supported on iOS Safari
      }
    }
  };

  // Tap-to-Focus on Viewfinder Tap
  const handleViewfinderTap = async (
    e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>
  ) => {
    const target = e.target as HTMLElement;
    if (target.closest("button") || isProcessing || isLimitReached) return;

    const rect = e.currentTarget.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ("touches" in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const relX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const relY = Math.max(0, Math.min(rect.height, clientY - rect.top));

    const normX = relX / rect.width;
    const normY = relY / rect.height;

    setFocusPoint({ x: normX, y: normY });
    setFocusPixel({ x: relX, y: relY });
    setFocusActive(true);

    if (typeof window !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(25);
    }

    // Instruct camera lens to adjust focus & exposure at tapped coordinate
    if (stream && facingMode === "environment") {
      try {
        const track = stream.getVideoTracks()[0];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const caps = track?.getCapabilities?.() as any;
        if (caps?.focusMode?.includes("single-shot") || caps?.pointsOfInterest) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await track.applyConstraints({
            advanced: [
              {
                focusMode: "single-shot",
                pointsOfInterest: [{ x: normX, y: normY }],
              } as any,
            ],
          }).catch(() => {});
        }
      } catch {
        // Fallback gracefully on Safari iOS
      }
    }

    if (focusTimeoutRef.current) clearTimeout(focusTimeoutRef.current);
    focusTimeoutRef.current = setTimeout(() => {
      setFocusActive(false);
    }, 1800);
  };

  // Capture Photo in 3:4 Portrait
  const handleShutter = async () => {
    if (isProcessing || isLimitReached) return;

    if (typeof window !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(40);
    }

    // Flash trigger
    await triggerFlashBurst();

    try {
      setIsProcessing(true);
      setStatusMessage("Developing analog film...");

      let blob: Blob;
      let previewUrl: string;

      if (videoRef.current && cameraReady && !cameraError) {
        // Instant capture from live 3:4 portrait frame with current zoom, xenon flash & focus point
        const result = await captureVideoFrame(
          videoRef.current,
          selectedEffect,
          facingMode === "user",
          zoomLevel,
          flashMode === "on",
          focusPoint
        );
        blob = result.blob;
        previewUrl = result.previewUrl;
      } else {
        // Fallback to native camera input dialog
        fileInputRef.current?.click();
        setIsProcessing(false);
        return;
      }

      // 1. Optimistic photo entry for instant real-time sync across Last Photo & My Shots
      const tempId = `temp-${Date.now()}`;
      const optimisticPhoto: GuestPhotoItem = {
        id: tempId,
        imageUrl: previewUrl,
        previewUrl,
        createdAt: new Date().toISOString(),
      };

      // Real-time simultaneous update across both components:
      setLastPreview(previewUrl);
      setMyPhotos((prev) => [optimisticPhoto, ...prev]);
      const newCount = photosTaken + 1;
      setPhotosTaken(newCount);

      // Instantly release shutter and resume camera (zero lag for guest)
      setIsProcessing(false);
      setStatusMessage("");
      resumeCamera();

      if (newCount >= maxPhotosLimit) {
        setBannerText(`Roll completed! You used all ${maxPhotosLimit} exposures.`);
      } else {
        setBannerText(`Photo locked in vault! (${maxPhotosLimit - newCount} left)`);
      }
      setTimeout(() => setBannerText(null), 3500);

      // Background upload to Cloudflare R2
      uploadFilteredPhotoToR2({ eventId, blob })
        .then((result) => {
          // Replace temp item with confirmed item while preserving the previewUrl in memory!
          setMyPhotos((prev) =>
            prev.map((item) =>
              item.id === tempId
                ? { ...item, id: result.photoId, imageUrl: result.imageUrl, previewUrl }
                : item
            )
          );
          setLastPreview((prev) => (prev ? prev : result.imageUrl));
          refreshPhotos();
        })
        .catch((err) => {
          console.error("Background upload failed:", err);
          // Rollback optimistic additions on error
          setMyPhotos((prev) => {
            const reverted = prev.filter((item) => item.id !== tempId);
            setLastPreview(
              reverted.length > 0
                ? reverted[0].previewUrl || reverted[0].imageUrl
                : null
            );
            return reverted;
          });
          setPhotosTaken((prev) => Math.max(0, prev - 1));
          const errMsg = err?.message || "Could not save photo. Please check your connection.";
          if (
            errMsg.toLowerCase().includes("unauthorized") ||
            errMsg.toLowerCase().includes("session") ||
            errMsg.toLowerCase().includes("name first")
          ) {
            setBannerText("Please enter your name first!");
            setTimeout(() => router.replace(`/${eventId}`), 1800);
          } else {
            setBannerText(errMsg);
            setTimeout(() => setBannerText(null), 4000);
          }
        });
    } catch (err: unknown) {
      console.error(err);
      alert((err as Error).message || "Could not process photo. Please try again.");
      setIsProcessing(false);
      setStatusMessage("");
      resumeCamera();
    }
  };

  // Fallback native camera capture
  const handleFallbackCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isLimitReached) return;

    try {
      setIsProcessing(true);
      await triggerFlashBurst();

      setStatusMessage("Developing analog film...");
      const { blob, previewUrl } = await applyAnalogFilter(
        file,
        selectedEffect,
        flashMode === "on",
        focusPoint
      );
      // 1. Optimistic photo entry for instant real-time sync across Last Photo & My Shots
      const tempId = `temp-${Date.now()}`;
      const optimisticPhoto: GuestPhotoItem = {
        id: tempId,
        imageUrl: previewUrl,
        previewUrl,
        createdAt: new Date().toISOString(),
      };

      // Real-time simultaneous update across both components:
      setLastPreview(previewUrl);
      setMyPhotos((prev) => [optimisticPhoto, ...prev]);
      const newCount = photosTaken + 1;
      setPhotosTaken(newCount);

      // Instantly release processing state
      setIsProcessing(false);
      setStatusMessage("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      resumeCamera();

      if (newCount >= maxPhotosLimit) {
        setBannerText(`Roll completed! You used all ${maxPhotosLimit} exposures.`);
      } else {
        setBannerText(`Photo locked in vault! (${maxPhotosLimit - newCount} left)`);
      }
      setTimeout(() => setBannerText(null), 3500);

      // Background upload to Cloudflare R2
      uploadFilteredPhotoToR2({ eventId, blob })
        .then((result) => {
          // Replace temp item with confirmed item while preserving the previewUrl in memory!
          setMyPhotos((prev) =>
            prev.map((item) =>
              item.id === tempId
                ? { ...item, id: result.photoId, imageUrl: result.imageUrl, previewUrl }
                : item
            )
          );
          setLastPreview((prev) => (prev ? prev : result.imageUrl));
          refreshPhotos();
        })
        .catch((err) => {
          console.error("Background upload failed:", err);
          // Rollback optimistic additions on error
          setMyPhotos((prev) => {
            const reverted = prev.filter((item) => item.id !== tempId);
            setLastPreview(
              reverted.length > 0
                ? reverted[0].previewUrl || reverted[0].imageUrl
                : null
            );
            return reverted;
          });
          setPhotosTaken((prev) => Math.max(0, prev - 1));
          const errMsg = err?.message || "Could not save photo. Please check your connection.";
          if (
            errMsg.toLowerCase().includes("unauthorized") ||
            errMsg.toLowerCase().includes("session") ||
            errMsg.toLowerCase().includes("name first")
          ) {
            setBannerText("Please enter your name first!");
            setTimeout(() => router.replace(`/${eventId}`), 1800);
          } else {
            setBannerText(errMsg);
            setTimeout(() => setBannerText(null), 4000);
          }
        });
    } catch (err: unknown) {
      console.error(err);
      alert((err as Error).message || "Error developing photo.");
      setIsProcessing(false);
      setStatusMessage("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      resumeCamera();
    }
  };

  // Open My Photos modal instantly with zero flicker
  const handleOpenMyPhotos = () => {
    setShowMyPhotosModal(true);
    setConfirmDeleteId(null);
    setLoadingMyPhotos(false);
    refreshPhotos();
  };

  // Close My Photos modal and ensure live camera feed resumes immediately
  const handleCloseMyPhotos = () => {
    setShowMyPhotosModal(false);
    setConfirmDeleteId(null);
    setDeletingPhotoId(null);
    setIsProcessing(false);
    // Explicitly wake up video playback
    setTimeout(() => {
      resumeCamera();
    }, 60);
  };

  // Delete a photo owned by this guest (instant optimistic response with background sync)
  const handleDeletePhoto = async (photoId: string) => {
    // 1. Immediately register to deleted IDs to prevent any in-flight refresh from reviving it
    deletedPhotoIdsRef.current.add(photoId);
    if (typeof window !== "undefined") {
      try {
        const currentArr = Array.from(deletedPhotoIdsRef.current);
        sessionStorage.setItem(`mingle_deleted_photos_${eventId}`, JSON.stringify(currentArr));

        // Immediately update gallery cache in sessionStorage if present
        const rawGalleryCache = sessionStorage.getItem(`mingle_gallery_cache_${eventId}`);
        if (rawGalleryCache) {
          const parsed = JSON.parse(rawGalleryCache);
          if (parsed.photos && Array.isArray(parsed.photos)) {
            parsed.photos = parsed.photos.filter((p: { id: string }) => p.id !== photoId);
          }
          if (parsed.totalPhotos !== undefined) {
            parsed.totalPhotos = Math.max(0, parsed.totalPhotos - 1);
          }
          sessionStorage.setItem(`mingle_gallery_cache_${eventId}`, JSON.stringify(parsed));
        }
      } catch (_) {}
    }

    // 2. Snapshot previous state for rollback on error
    const previousPhotos = [...myPhotos];
    const previousCount = photosTaken;
    const previousPreview = lastPreview;

    // 3. Instant optimistic deletion (0ms delay)
    const updatedList = myPhotos.filter((p) => p.id !== photoId);
    setMyPhotos(updatedList);
    const newPhotosCount = Math.max(0, photosTaken - 1);
    setPhotosTaken(newPhotosCount);
    const nextPreview =
      updatedList.length > 0
        ? updatedList[0].previewUrl || updatedList[0].imageUrl
        : null;
    setLastPreview(nextPreview);
    if (typeof window !== "undefined") {
      try {
        if (nextPreview) {
          sessionStorage.setItem(`mingle_last_preview_${eventId}`, nextPreview);
        } else {
          sessionStorage.removeItem(`mingle_last_preview_${eventId}`);
        }
      } catch (_) {}
    }
    setConfirmDeleteId(null);
    setDeletingPhotoId(null);

    const remaining = Math.max(0, maxPhotosLimit - newPhotosCount);
    setBannerText(`Photo deleted! You now have ${remaining} shots left.`);
    setTimeout(() => setBannerText(null), 3000);

    // 4. Background server synchronization
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

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete photo");
      }

      const data = await res.json();
      if (data.photoCount !== undefined) {
        setPhotosTaken(data.photoCount);
      }
    } catch (err: unknown) {
      console.error("Delete failed, reverting state:", err);
      // Revert deletion tracking on error
      deletedPhotoIdsRef.current.delete(photoId);
      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem(
            `mingle_deleted_photos_${eventId}`,
            JSON.stringify(Array.from(deletedPhotoIdsRef.current))
          );
        } catch (_) {}
      }
      setMyPhotos(previousPhotos);
      setPhotosTaken(previousCount);
      setLastPreview(previousPreview);
      alert((err as Error).message || "Error deleting photo. Please try again.");
    } finally {
      resumeCamera();
    }
  };

  const currentPreset = getEffectPreset(selectedEffect);

  return (
    <div className="min-h-screen bg-[#131114] text-stone-200 flex flex-col items-center justify-between p-3 sm:p-5 select-none font-sans">
      {/* Xenon flash pulse */}
      <div
        className={`fixed inset-0 bg-white pointer-events-none transition-opacity duration-150 z-50 ${
          flashActive ? "opacity-95" : "opacity-0"
        }`}
      />

      {/* Top Header: Event Name, Flash Toggle & Film Roll Counter */}
      <header className="w-full max-w-sm flex items-center justify-between py-2 border-b border-stone-800">
        <div>
          <span className="text-[10px] font-semibold text-stone-400 block uppercase tracking-wider">
            Mingle Disposable
          </span>
          <h1 className="text-sm font-bold text-stone-100 truncate max-w-[150px]">
            {eventName}
          </h1>
        </div>

        <div className="flex items-center space-x-2">
          {/* Flash Toggle Button */}
          <button
            onClick={toggleFlash}
            aria-label="Toggle Flash"
            className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center space-x-1 border transition-all ${
              flashMode === "on"
                ? "bg-amber-400/20 text-amber-300 border-amber-400/50 shadow-sm"
                : "bg-stone-900 text-stone-400 border-stone-800"
            }`}
            title="Toggle Flash (Burst on capture)"
          >
            <span>{flashMode === "on" ? "⚡" : "⚡⃠"}</span>
            <span className="text-[10px] uppercase font-mono">{flashMode}</span>
          </button>

          {/* Film Counter Window */}
          <div className="bg-stone-900 border border-stone-800 px-3 py-1 rounded-full flex items-center space-x-1.5 shadow-inner">
            <span className="text-[10px] text-stone-400 font-medium uppercase tracking-wider">LEFT</span>
            <span className="text-sm font-bold text-stone-100 font-mono tabular-nums">
              {remainingShots}
            </span>
            <span className="text-[10px] text-stone-500 font-mono">/ {maxPhotosLimit}</span>
          </div>
        </div>
      </header>

      {/* Tactile Camera Body with Client Custom Hex Theme */}
      <main
        className="w-full max-w-sm my-auto rounded-[28px] p-3.5 border shadow-2xl flex flex-col items-center relative transition-colors duration-300"
        style={{
          backgroundColor: themeColor,
          borderColor: "rgba(255, 255, 255, 0.2)",
        }}
      >
        {/* Subtle camera chassis details */}
        <div className="w-full flex items-center justify-between mb-2 px-1">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-white/40" />
            <span className="text-[10px] font-bold tracking-widest text-white/80 uppercase">
              3:4 Portrait Lens
            </span>
          </div>
          <span className="text-[10px] text-white/70 font-medium">
            {maxPhotosLimit} Exposures / Guest
          </span>
        </div>

        {/* 3:4 PORTRAIT Viewfinder Window with Tap-to-Focus */}
        <div
          onClick={handleViewfinderTap}
          onTouchStart={handleViewfinderTap}
          className="w-full aspect-[3/4] max-h-[55vh] bg-black rounded-2xl border-4 border-black/40 relative flex items-center justify-center overflow-hidden shadow-inner cursor-crosshair select-none"
        >
          {/* Live Video Feed with Filter Preview & Zoom scale */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              filter: currentPreset.cssFilter,
              transform: `${facingMode === "user" ? "scaleX(-1) " : ""}scale(${zoomLevel})`,
              transition: "transform 0.2s ease-out, filter 0.2s ease-in-out",
            }}
            className={`w-full h-full object-cover origin-center ${cameraError ? "hidden" : "block"}`}
          />

          {/* Fallback Screen */}
          {cameraError && (
            <div className="text-center p-5 text-stone-300">
              <p className="text-xs mb-3 text-stone-300">
                Live camera stream unavailable on this browser.
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLimitReached}
                className="px-4 py-2 bg-white text-stone-900 rounded-xl text-xs font-bold transition-all shadow hover:bg-stone-100"
              >
                Choose / Snap Photo
              </button>
            </div>
          )}

          {/* Viewfinder Corner Framing Guides */}
          <div className="absolute inset-3 pointer-events-none flex items-center justify-center">
            <div className="w-3.5 h-3.5 border-t-2 border-l-2 border-white/40 absolute top-0 left-0 rounded-tl-sm" />
            <div className="w-3.5 h-3.5 border-t-2 border-r-2 border-white/40 absolute top-0 right-0 rounded-tr-sm" />
            <div className="w-3.5 h-3.5 border-b-2 border-l-2 border-white/40 absolute bottom-0 left-0 rounded-bl-sm" />
            <div className="w-3.5 h-3.5 border-b-2 border-r-2 border-white/40 absolute bottom-0 right-0 rounded-br-sm" />
            <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
          </div>

          {/* Interactive Tap-to-Focus Reticle with Corners & Center Dot */}
          {focusActive && focusPixel && (
            <div
              key={`${focusPixel.x}-${focusPixel.y}`}
              className="absolute pointer-events-none z-30 transition-opacity duration-300"
              style={{
                left: `${focusPixel.x}px`,
                top: `${focusPixel.y}px`,
                transform: "translate(-50%, -50%)",
              }}
            >
              <div className="w-14 h-14 rounded-xl border-2 border-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.6)] flex items-center justify-center animate-focus-reticle relative">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow" />
                {/* 4 Corner tick marks */}
                <div className="absolute -top-1 left-2 right-2 h-0.5 bg-amber-300/80 rounded" />
                <div className="absolute -bottom-1 left-2 right-2 h-0.5 bg-amber-300/80 rounded" />
                <div className="absolute -left-1 top-2 bottom-2 w-0.5 bg-amber-300/80 rounded" />
                <div className="absolute -right-1 top-2 bottom-2 w-0.5 bg-amber-300/80 rounded" />
              </div>
            </div>
          )}

          {/* Preset Label Badge */}
          <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-sm text-[11px] font-medium text-stone-200 pointer-events-none">
            {currentPreset.name}
          </div>

          {/* Flash Indicator on Viewfinder */}
          {flashMode === "on" && (
            <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[10px] text-amber-300 font-mono flex items-center space-x-1 pointer-events-none border border-amber-400/30">
              <span>⚡</span>
              <span>FLASH</span>
            </div>
          )}

          {/* Zoom Selector Pills (0.5x, 1x, 2x - Default is 1x) */}
          <div className="absolute bottom-2.5 inset-x-0 flex items-center justify-center space-x-2 z-20 pointer-events-auto">
            {[0.5, 1, 2].map((z) => (
              <button
                key={z}
                onClick={() => setZoomLevel(z)}
                disabled={isProcessing}
                className={`w-8 h-8 rounded-full text-[11px] font-bold font-mono transition-all flex items-center justify-center shadow backdrop-blur-md ${
                  zoomLevel === z
                    ? "bg-white text-stone-900 scale-105"
                    : "bg-black/60 text-stone-300 border border-white/20 hover:text-white"
                }`}
              >
                {z}x
              </button>
            ))}
          </div>

          {/* Developing State */}
          {isProcessing && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center z-30">
              <div
                className="w-8 h-8 border-3 border-t-transparent rounded-full animate-spin mb-2"
                style={{ borderColor: themeColor, borderTopColor: "transparent" }}
              />
              <p className="text-xs font-semibold text-stone-100">{statusMessage}</p>
            </div>
          )}

          {/* Limit Reached (Max Photos Done) Overlay */}
          {isLimitReached && (
            <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-5 text-center z-30">
              <span className="text-3xl mb-2">🎞️</span>
              <p className="text-sm font-bold text-white mb-1">Film Roll Completed</p>
              <p className="text-xs text-stone-300 max-w-[220px] mb-3">
                You used all {maxPhotosLimit} exposures. Review or delete shots below to free up space!
              </p>
              <button
                onClick={handleOpenMyPhotos}
                className="px-4 py-2 bg-white text-stone-900 font-bold text-xs rounded-xl shadow hover:bg-stone-100"
              >
                Review & Manage My Shots →
              </button>
            </div>
          )}
        </div>

        {/* Hidden Fallback Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFallbackCapture}
          className="hidden"
          disabled={isProcessing || isLimitReached}
        />

        {/* Vintage Filter Presets Selector (Horizontal Scrolling Carousel) */}
        <div className="w-full mt-3 overflow-x-auto pb-1 flex space-x-1.5 scrollbar-thin">
          {EFFECT_PRESETS.map((preset) => {
            const isSelected = selectedEffect === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => setSelectedEffect(preset.id)}
                disabled={isProcessing}
                className={`flex-shrink-0 py-1.5 px-2.5 rounded-xl text-[10px] font-semibold transition-all text-center flex items-center space-x-1.5 ${
                  isSelected
                    ? "bg-white text-stone-900 shadow-md font-bold scale-[1.03]"
                    : "bg-black/35 text-white/90 hover:bg-black/50 border border-white/10"
                }`}
                title={preset.description}
              >
                <span className="text-[12px] leading-none">{preset.icon}</span>
                <span className="whitespace-nowrap">{preset.name}</span>
              </button>
            );
          })}
        </div>

        {/* Shutter Deck: Flip Camera moved next to LAST */}
        <div className="w-full mt-3.5 pt-2.5 border-t border-white/15 flex items-center justify-between px-2">
          {/* Used Counter */}
          <div className="text-center w-16">
            <span className="text-[10px] text-white/70 uppercase tracking-wider block font-medium">
              USED
            </span>
            <span className="text-xs font-bold text-white font-mono">{photosTaken}/{maxPhotosLimit}</span>
          </div>

          {/* Physical Shutter Button */}
          <button
            onClick={handleShutter}
            disabled={isProcessing || isLimitReached}
            aria-label="Capture Photo"
            className="group relative flex items-center justify-center active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed mx-auto"
          >
            <div className="w-18 h-18 rounded-full bg-black/40 border-2 border-white/30 p-1 flex items-center justify-center shadow-lg">
              <div className="w-14 h-14 rounded-full bg-white group-hover:bg-stone-100 active:bg-stone-200 transition-colors shadow-md flex items-center justify-center">
                <div className="w-8 h-8 rounded-full border border-stone-300" />
              </div>
            </div>
          </button>

          {/* Right Deck: Flip Camera Button + Last Photo Thumbnail */}
          <div className="flex items-center space-x-2">
            {/* Front / Rear Camera Flip Button */}
            <button
              onClick={toggleFacingMode}
              disabled={isProcessing}
              aria-label="Flip Camera"
              className="w-9 h-9 rounded-full bg-black/40 border border-white/20 text-stone-200 hover:text-white flex items-center justify-center text-sm active:scale-90 transition-all shadow"
              title="Switch Front / Rear Camera"
            >
              ↻
            </button>

            {/* Last Photo Thumbnail & Manage Button */}
            <button
              onClick={handleOpenMyPhotos}
              aria-label="View and manage my photos"
              className="group flex flex-col items-center"
              title="Click to view & delete your photos"
            >
              <div className="w-9 h-9 rounded-lg bg-black/40 border border-white/20 overflow-hidden flex items-center justify-center group-hover:border-white/50 transition-colors relative">
                {lastPreview ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={lastPreview} alt="Last capture" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[10px] text-stone-400 font-mono">--</span>
                )}
                {myPhotos.length > 0 && (
                  <span className="absolute bottom-0 inset-x-0 bg-black/75 text-[8px] text-stone-200 font-mono text-center">
                    {myPhotos.length}
                  </span>
                )}
              </div>
            </button>
          </div>
        </div>
      </main>

      {/* Floating Status Notification */}
      {bannerText && (
        <div className="fixed bottom-18 px-4 py-2 bg-stone-900 border border-stone-700 text-stone-100 text-xs rounded-full shadow-2xl z-20">
          {bannerText}
        </div>
      )}

      {/* Bottom Bar */}
      <footer className="w-full max-w-sm flex items-center justify-between pt-2 border-t border-stone-800 text-xs">
        <button
          onClick={handleOpenMyPhotos}
          className="text-stone-400 hover:text-stone-200 text-[11px] underline underline-offset-4"
        >
          My Shots ({photosTaken}) 🗑️
        </button>
        <Link
          href={`/${eventId}/gallery`}
          prefetch={true}
          className="text-stone-300 hover:text-white text-xs font-semibold underline underline-offset-4 transition-colors"
        >
          View Album Gallery →
        </Link>
      </footer>

      {/* Manage Guest Photos Modal (Allows User to Delete Photos with smooth inline confirmation) */}
      {showMyPhotosModal && (
        <div
          onClick={handleCloseMyPhotos}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-3 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#1c161d] border border-[#382736] rounded-3xl p-5 shadow-2xl flex flex-col max-h-[85vh]"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <div>
                <h2 className="text-base font-bold text-white">Your Captured Shots</h2>
                <p className="text-xs text-stone-400">
                  {photosTaken}/{maxPhotosLimit} shots used • Delete unwanted shots to free roll space
                </p>
              </div>
              <button
                onClick={handleCloseMyPhotos}
                className="w-8 h-8 rounded-full bg-stone-800 text-stone-400 hover:text-white flex items-center justify-center text-sm"
              >
                ✕
              </button>
            </div>

            {/* Photos List */}
            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {loadingMyPhotos ? (
                <div className="text-center py-12 text-stone-400 text-xs font-medium">
                  Loading your photos...
                </div>
              ) : myPhotos.length === 0 ? (
                <div className="text-center py-12 text-stone-500 text-xs">
                  No photos captured yet. Press the shutter button to take your first shot!
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {myPhotos.map((photo, index) => {
                    const isConfirming = confirmDeleteId === photo.id;
                    const isDeleting = deletingPhotoId === photo.id;

                    return (
                      <div
                        key={photo.id}
                        className="bg-stone-950 border border-stone-800/80 rounded-2xl p-2 flex flex-col space-y-2 relative group"
                      >
                        <div className="w-full aspect-[3/4] rounded-xl overflow-hidden bg-black relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={photo.previewUrl || photo.imageUrl}
                            alt={`Shot #${myPhotos.length - index}`}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        <div className="flex items-center justify-between px-1">
                          <span className="text-[10px] text-stone-400 font-mono">
                            {new Date(photo.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>

                          {!isConfirming ? (
                            <button
                              onClick={() => setConfirmDeleteId(photo.id)}
                              disabled={isDeleting}
                              className="px-2.5 py-1 bg-red-950/80 hover:bg-red-900 border border-red-700/60 text-red-200 rounded-lg text-[10px] font-semibold transition-all flex items-center space-x-1 disabled:opacity-50"
                            >
                              <span>{isDeleting ? "..." : "Delete 🗑️"}</span>
                            </button>
                          ) : (
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={() => handleDeletePhoto(photo.id)}
                                disabled={isDeleting}
                                className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white rounded text-[10px] font-bold shadow"
                              >
                                {isDeleting ? "..." : "Confirm"}
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                disabled={isDeleting}
                                className="px-1.5 py-0.5 bg-stone-800 text-stone-300 rounded text-[10px]"
                              >
                                ✕
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-stone-800 flex items-center justify-between text-xs">
              <span className="text-stone-400 text-[11px]">
                Remaining: <strong className="text-white font-mono">{remainingShots}</strong> shots
              </span>
              <button
                onClick={handleCloseMyPhotos}
                style={{ backgroundColor: themeColor }}
                className="px-4 py-2 hover:brightness-110 text-white text-xs font-bold rounded-xl border border-white/20"
              >
                Back to Camera
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
