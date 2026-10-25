"use client";

import React, { useState, useRef, use, useEffect } from "react";
import Link from "next/link";
import { applyAnalogFilter } from "@/lib/canvas-filter";
import { uploadFilteredPhotoToR2 } from "@/lib/upload-service";

interface CameraPageProps {
  params: Promise<{ eventId: string }>;
}

export default function CameraPage({ params }: CameraPageProps) {
  const { eventId } = use(params);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [flashActive, setFlashActive] = useState(false);
  const [shotsCount, setShotsCount] = useState(1);
  const [lastPreview, setLastPreview] = useState<string | null>(null);
  const [bannerText, setBannerText] = useState<string | null>(null);
  const [eventName, setEventName] = useState("Mingle Cam");

  useEffect(() => {
    fetch(`/api/events/${eventId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.event?.name) setEventName(data.event.name);
      })
      .catch(() => {});
  }, [eventId]);

  const triggerShutter = () => {
    if (isProcessing) return;
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(40);
    }
    fileInputRef.current?.click();
  };

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      setBannerText(null);

      // 1. Simulate Xenon flash burst
      setFlashActive(true);
      setTimeout(() => setFlashActive(false), 220);

      // 2. Destructive analog filter + grain + date stamp
      setStatusMessage("Developing 35mm film...");
      const { blob, previewUrl } = await applyAnalogFilter(file);
      setLastPreview(previewUrl);

      // 3. Upload directly to Cloudflare R2 via Presigned URL
      setStatusMessage("Winding film & locking in vault...");
      await uploadFilteredPhotoToR2({ eventId, blob });

      // 4. Update UI counter & success banner
      setShotsCount((prev) => prev + 1);
      setBannerText("Locked in the event vault! 🔒");
      setTimeout(() => setBannerText(null), 4500);
    } catch (err: unknown) {
      console.error(err);
      alert((err as Error).message || "Error developing photo. Please try again.");
    } finally {
      setIsProcessing(false);
      setStatusMessage("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="relative min-h-screen bg-stone-950 text-stone-100 flex flex-col items-center justify-between p-4 select-none overflow-hidden font-mono">
      {/* Simulated Flash Flashburst */}
      <div
        className={`fixed inset-0 bg-white pointer-events-none transition-opacity duration-300 z-50 ${
          flashActive ? "opacity-95" : "opacity-0"
        }`}
      />

      {/* Top Bar: Event Brand & Shots Counter */}
      <header className="w-full max-w-sm flex items-center justify-between py-2 border-b border-stone-800 z-10">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs tracking-wider uppercase text-stone-300 font-bold truncate max-w-[170px]">
            {eventName}
          </span>
        </div>

        {/* Vintage Analog Roll Counter */}
        <div className="flex items-center bg-stone-900 px-3 py-1 rounded-md border border-stone-700 shadow-inner">
          <span className="text-[10px] text-amber-500 mr-2 tracking-tighter">EXP</span>
          <span className="text-lg font-black text-amber-400 tabular-nums">
            {String(shotsCount).padStart(2, "0")}
          </span>
        </div>
      </header>

      {/* Camera Body (Skeuomorphic Retro Disposable Shell) */}
      <main className="w-full max-w-sm my-auto bg-stone-900/95 rounded-2xl p-5 border-2 border-stone-800 shadow-2xl flex flex-col items-center relative z-10">
        {/* Optical Viewfinder Window */}
        <div className="w-full aspect-[4/3] bg-stone-950 rounded-xl border-4 border-stone-800 shadow-inner relative flex items-center justify-center overflow-hidden">
          {lastPreview ? (
            <img
              src={lastPreview}
              alt="Last taken"
              className="w-full h-full object-cover filter brightness-95 contrast-105"
            />
          ) : (
            <div className="text-center p-6 text-stone-600">
              <svg
                className="w-12 h-12 mx-auto mb-2 opacity-40 stroke-current"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <circle cx="12" cy="13" r="4" strokeWidth="1.5" />
              </svg>
              <p className="text-xs uppercase tracking-widest text-stone-500 font-bold">
                Aim & Tap Shutter
              </p>
            </div>
          )}

          {/* Viewfinder Crosshair Overlay */}
          <div className="absolute inset-4 border border-white/20 pointer-events-none flex items-center justify-center">
            <div className="w-4 h-4 border-t-2 border-l-2 border-white/40 absolute top-0 left-0" />
            <div className="w-4 h-4 border-t-2 border-r-2 border-white/40 absolute top-0 right-0" />
            <div className="w-4 h-4 border-b-2 border-l-2 border-white/40 absolute bottom-0 left-0" />
            <div className="w-4 h-4 border-b-2 border-r-2 border-white/40 absolute bottom-0 right-0" />
            <div className="w-2 h-2 rounded-full border border-white/30" />
          </div>

          {/* Processing / Developing Overlay */}
          {isProcessing && (
            <div className="absolute inset-0 bg-stone-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center">
              <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-xs text-amber-400 font-bold uppercase tracking-wider animate-pulse">
                {statusMessage}
              </p>
            </div>
          )}
        </div>

        {/* Hidden Camera Input Trigger */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleCapture}
          className="hidden"
          disabled={isProcessing}
        />

        {/* Shutter Button and Controls */}
        <div className="w-full mt-6 flex items-center justify-around">
          {/* Flash indicator */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-stone-400 uppercase tracking-wider mb-1">
              Flash
            </span>
            <div className="w-4 h-4 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
          </div>

          {/* Shutter Button */}
          <button
            onClick={triggerShutter}
            disabled={isProcessing}
            aria-label="Capture Photo"
            className="group relative flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
          >
            <div className="w-20 h-20 rounded-full bg-stone-950 border-4 border-stone-700 shadow-2xl flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-600 to-rose-700 shadow-[inset_0_2px_4px_rgba(255,255,255,0.4)] group-hover:brightness-110 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full border border-red-300/40" />
              </div>
            </div>
          </button>

          {/* Lens Spec */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-stone-400 uppercase tracking-wider mb-1">
              Aperture
            </span>
            <span className="text-xs text-stone-300 font-bold">F/8</span>
          </div>
        </div>
      </main>

      {/* Floating Success Pill */}
      {bannerText && (
        <div className="fixed bottom-20 px-4 py-2.5 bg-amber-500 text-stone-950 text-xs font-bold rounded-full shadow-2xl flex items-center space-x-2 animate-bounce z-20">
          <span>{bannerText}</span>
        </div>
      )}

      {/* Bottom Bar: Navigation to Gallery & Info */}
      <footer className="w-full max-w-sm flex items-center justify-between pt-3 border-t border-stone-800 text-xs z-10">
        <span className="text-stone-500 text-[11px]">Analog 35mm Filter</span>
        <Link
          href={`/${eventId}/gallery`}
          className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-amber-400 text-xs font-bold border border-stone-700 transition-colors flex items-center space-x-1"
        >
          <span>Reveal Gallery</span>
          <span>→</span>
        </Link>
      </footer>
    </div>
  );
}
