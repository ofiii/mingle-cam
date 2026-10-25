"use client";

import React, { useState, useRef, useEffect, use } from "react";
import Link from "next/link";
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

const MAX_PHOTOS_LIMIT = 20;

export default function CameraPage({ params }: CameraPageProps) {
  const { eventId } = use(params);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [selectedEffect, setSelectedEffect] = useState<FilterEffect>("moody");
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [flashActive, setFlashActive] = useState(false);

  // Photos taken by this guest (max 20)
  const [photosTaken, setPhotosTaken] = useState(0);
  const [lastPreview, setLastPreview] = useState<string | null>(null);
  const [bannerText, setBannerText] = useState<string | null>(null);
  const [eventName, setEventName] = useState("Mingle Session");
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(false);

  // Load event details and guest photo count on mount
  useEffect(() => {
    let mounted = true;

    fetch(`/api/events/${eventId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!mounted) return;
        if (data.event?.name) setEventName(data.event.name);
        if (data.currentGuest?.photoCount !== undefined) {
          setPhotosTaken(data.currentGuest.photoCount);
        }
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [eventId]);

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

  const toggleFacingMode = () => {
    if (isProcessing) return;
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  const isLimitReached = photosTaken >= MAX_PHOTOS_LIMIT;
  const remainingShots = Math.max(0, MAX_PHOTOS_LIMIT - photosTaken);

  // Capture Photo in 3:4 Portrait
  const handleShutter = async () => {
    if (isProcessing || isLimitReached) return;

    if (typeof window !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(40);
    }

    // Flash simulation
    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 160);

    try {
      setIsProcessing(true);
      setStatusMessage("Developing analog film...");

      let blob: Blob;
      let previewUrl: string;

      if (videoRef.current && cameraReady && !cameraError) {
        // Instant capture from live 3:4 portrait frame
        const result = await captureVideoFrame(
          videoRef.current,
          selectedEffect,
          facingMode === "user"
        );
        blob = result.blob;
        previewUrl = result.previewUrl;
      } else {
        // Fallback to native camera input dialog
        fileInputRef.current?.click();
        setIsProcessing(false);
        return;
      }

      setLastPreview(previewUrl);

      // Direct R2 upload via presigned URL
      setStatusMessage("Saving to the event vault...");
      await uploadFilteredPhotoToR2({ eventId, blob });

      const newCount = photosTaken + 1;
      setPhotosTaken(newCount);

      if (newCount >= MAX_PHOTOS_LIMIT) {
        setBannerText("Roll finished! You have used all 20 exposures.");
      } else {
        setBannerText(`Photo locked in vault! (${MAX_PHOTOS_LIMIT - newCount} left)`);
      }
      setTimeout(() => setBannerText(null), 3500);
    } catch (err: unknown) {
      console.error(err);
      alert((err as Error).message || "Could not process photo. Please try again.");
    } finally {
      setIsProcessing(false);
      setStatusMessage("");
    }
  };

  // Fallback native camera capture
  const handleFallbackCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isLimitReached) return;

    try {
      setIsProcessing(true);
      setFlashActive(true);
      setTimeout(() => setFlashActive(false), 160);

      setStatusMessage("Developing analog film...");
      const { blob, previewUrl } = await applyAnalogFilter(file, selectedEffect);
      setLastPreview(previewUrl);

      setStatusMessage("Saving to the event vault...");
      await uploadFilteredPhotoToR2({ eventId, blob });

      const newCount = photosTaken + 1;
      setPhotosTaken(newCount);

      if (newCount >= MAX_PHOTOS_LIMIT) {
        setBannerText("Roll finished! You have used all 20 exposures.");
      } else {
        setBannerText(`Photo locked in vault! (${MAX_PHOTOS_LIMIT - newCount} left)`);
      }
      setTimeout(() => setBannerText(null), 3500);
    } catch (err: unknown) {
      console.error(err);
      alert((err as Error).message || "Error developing photo.");
    } finally {
      setIsProcessing(false);
      setStatusMessage("");
      if (fileInputRef.current) fileInputRef.current.value = "";
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

      {/* Top Bar: Event Name & Film Roll Counter */}
      <header className="w-full max-w-sm flex items-center justify-between py-2 border-b border-[#282128]">
        <div>
          <span className="text-[10px] font-semibold text-stone-400 block uppercase tracking-wider">
            Mingle Disposable
          </span>
          <h1 className="text-sm font-bold text-stone-100 truncate max-w-[170px]">
            {eventName}
          </h1>
        </div>

        <div className="flex items-center space-x-2">
          {/* Film Counter Window */}
          <div className="bg-[#1f1a21] border border-[#3d3240] px-3 py-1 rounded-full flex items-center space-x-1.5 shadow-inner">
            <span className="text-[10px] text-stone-400 font-medium uppercase tracking-wider">LEFT</span>
            <span className="text-sm font-bold text-stone-100 font-mono tabular-nums">
              {remainingShots}
            </span>
            <span className="text-[10px] text-stone-500 font-mono">/ 20</span>
          </div>

          {/* Flip Camera Button */}
          <button
            onClick={toggleFacingMode}
            disabled={isProcessing}
            aria-label="Flip Camera"
            className="w-9 h-9 rounded-full bg-[#1f1a21] border border-[#3d3240] text-stone-300 hover:text-white flex items-center justify-center text-sm active:scale-95 transition-all shadow-sm"
            title="Switch Front / Rear Camera"
          >
            ↻
          </button>
        </div>
      </header>

      {/* Tactile Plum Camera Body (#461a3d) */}
      <main className="w-full max-w-sm my-auto bg-[#461a3d] rounded-[28px] p-3.5 border border-[#5d2351] shadow-2xl flex flex-col items-center relative">
        {/* Subtle camera chassis details */}
        <div className="w-full flex items-center justify-between mb-2 px-1">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-[#7a2e6b]" />
            <span className="text-[10px] font-bold tracking-widest text-[#d8a4cb] uppercase">
              3:4 Portrait Lens
            </span>
          </div>
          <span className="text-[10px] text-[#e0b7d6]/80 font-medium">
            20 Exposures / Guest
          </span>
        </div>

        {/* 3:4 PORTRAIT Viewfinder Window */}
        <div className="w-full aspect-[3/4] max-h-[58vh] bg-black rounded-2xl border-4 border-[#2b0f25] relative flex items-center justify-center overflow-hidden shadow-inner">
          {/* Live Video Feed with Filter Preview */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ filter: currentPreset.cssFilter }}
            className={`w-full h-full object-cover transition-[filter] duration-200 ${
              facingMode === "user" ? "-scale-x-100" : ""
            } ${cameraError ? "hidden" : "block"}`}
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
                className="px-4 py-2 bg-white text-[#461a3d] rounded-xl text-xs font-bold transition-all shadow hover:bg-stone-100"
              >
                Choose / Snap Photo
              </button>
            </div>
          )}

          {/* Clean Viewfinder Corner Guides (Portrait) */}
          <div className="absolute inset-3 pointer-events-none flex items-center justify-center">
            <div className="w-3.5 h-3.5 border-t-2 border-l-2 border-white/40 absolute top-0 left-0 rounded-tl-sm" />
            <div className="w-3.5 h-3.5 border-t-2 border-r-2 border-white/40 absolute top-0 right-0 rounded-tr-sm" />
            <div className="w-3.5 h-3.5 border-b-2 border-l-2 border-white/40 absolute bottom-0 left-0 rounded-bl-sm" />
            <div className="w-3.5 h-3.5 border-b-2 border-r-2 border-white/40 absolute bottom-0 right-0 rounded-br-sm" />
            <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
          </div>

          {/* Preset Label Badge */}
          <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-sm text-[11px] font-medium text-stone-200 pointer-events-none">
            {currentPreset.name}
          </div>

          {/* Developing State */}
          {isProcessing && (
            <div className="absolute inset-0 bg-[#2b0f25]/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center z-30">
              <div className="w-8 h-8 border-3 border-[#d8a4cb] border-t-transparent rounded-full animate-spin mb-2" />
              <p className="text-xs font-semibold text-stone-100">{statusMessage}</p>
            </div>
          )}

          {/* Limit Reached (20 Photos Done) Overlay */}
          {isLimitReached && (
            <div className="absolute inset-0 bg-[#2b0f25]/95 backdrop-blur-sm flex flex-col items-center justify-center p-5 text-center z-30">
              <span className="text-3xl mb-2">🎞️</span>
              <p className="text-sm font-bold text-white mb-1">Film Roll Completed</p>
              <p className="text-xs text-stone-300 max-w-[220px] mb-3">
                You have used all 20 exposures. Your photos will reveal at the event party!
              </p>
              <Link
                href={`/${eventId}/gallery`}
                className="px-4 py-2 bg-white text-[#461a3d] font-bold text-xs rounded-xl shadow hover:bg-stone-100"
              >
                View Shared Album →
              </Link>
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

        {/* 6 Vintage Filter Presets Selector */}
        <div className="w-full mt-3 grid grid-cols-6 gap-1">
          {EFFECT_PRESETS.map((preset) => {
            const isSelected = selectedEffect === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => setSelectedEffect(preset.id)}
                disabled={isProcessing}
                className={`py-1.5 px-0.5 rounded-xl text-[9px] font-semibold transition-all text-center flex flex-col items-center justify-center ${
                  isSelected
                    ? "bg-white text-[#461a3d] shadow-sm font-bold scale-[1.03]"
                    : "bg-[#33112b] text-[#d8a4cb] hover:bg-[#3d1534]"
                }`}
                title={preset.description}
              >
                <span className="text-[12px] leading-none mb-0.5">{preset.icon}</span>
                <span className="block truncate w-full px-0.5">{preset.name.split(" ")[0]}</span>
              </button>
            );
          })}
        </div>

        {/* Shutter Deck */}
        <div className="w-full mt-4 pt-2.5 border-t border-[#5d2351] flex items-center justify-around">
          {/* Used Counter */}
          <div className="text-center w-14">
            <span className="text-[10px] text-[#d8a4cb] uppercase tracking-wider block font-medium">
              USED
            </span>
            <span className="text-xs font-bold text-white font-mono">{photosTaken}/20</span>
          </div>

          {/* Physical Shutter Button */}
          <button
            onClick={handleShutter}
            disabled={isProcessing || isLimitReached}
            aria-label="Capture Photo"
            className="group relative flex items-center justify-center active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <div className="w-18 h-18 rounded-full bg-[#2a0e24] border-2 border-[#6d275f] p-1 flex items-center justify-center shadow-lg">
              <div className="w-14 h-14 rounded-full bg-white group-hover:bg-stone-100 active:bg-stone-200 transition-colors shadow-md flex items-center justify-center">
                <div className="w-8 h-8 rounded-full border border-stone-300" />
              </div>
            </div>
          </button>

          {/* Last Photo Thumbnail */}
          <div className="text-center w-14 flex flex-col items-center">
            <span className="text-[10px] text-[#d8a4cb] uppercase tracking-wider block mb-1 font-medium">
              LAST
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#2a0e24] border border-[#5d2351] overflow-hidden flex items-center justify-center">
              {lastPreview ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={lastPreview} alt="Last capture" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[10px] text-stone-500 font-mono">--</span>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Floating Status Notification */}
      {bannerText && (
        <div className="fixed bottom-18 px-4 py-2 bg-[#2a0e24] border border-[#5d2351] text-stone-100 text-xs rounded-full shadow-lg z-20">
          {bannerText}
        </div>
      )}

      {/* Bottom Bar */}
      <footer className="w-full max-w-sm flex items-center justify-between pt-2 border-t border-[#282128] text-xs">
        <span className="text-stone-400 text-[11px]">3:4 Portrait Frame</span>
        <Link
          href={`/${eventId}/gallery`}
          className="text-[#d8a4cb] hover:text-white text-xs font-semibold underline underline-offset-4 transition-colors"
        >
          View Album Gallery →
        </Link>
      </footer>
    </div>
  );
}
