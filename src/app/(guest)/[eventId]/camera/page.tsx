"use client";

import React, { useState, useRef, useEffect, use, useCallback } from "react";
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

export default function CameraPage({ params }: CameraPageProps) {
  const { eventId } = use(params);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [selectedEffect, setSelectedEffect] = useState<FilterEffect>("vintage");
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [flashActive, setFlashActive] = useState(false);
  const [shotsCount, setShotsCount] = useState(1);
  const [lastPreview, setLastPreview] = useState<string | null>(null);
  const [bannerText, setBannerText] = useState<string | null>(null);
  const [eventName, setEventName] = useState("Mingle Cam");
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Fetch Event Name
  useEffect(() => {
    fetch(`/api/events/${eventId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.event?.name) setEventName(data.event.name);
      })
      .catch(() => {});
  }, [eventId]);

  // Start Live Camera Stream (4:3 ratio)
  const startCamera = useCallback(async (facing: "environment" | "user") => {
    try {
      setCameraError(null);
      // Stop old tracks if active
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1440 },
          height: { ideal: 1080 },
          aspectRatio: { ideal: 4 / 3 },
        },
        audio: false,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
    } catch (err) {
      console.warn("Could not start live camera feed, falling back to file input", err);
      setCameraError("Camera permission needed. You can still use the file shutter.");
    }
  }, [stream]);

  // Initialize camera on mount & cleanup on unmount
  useEffect(() => {
    startCamera(facingMode);

    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  // Toggle Front / Back camera
  const toggleFacingMode = () => {
    if (isProcessing) return;
    const nextMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextMode);
  };

  // Trigger Shutter Action
  const triggerShutter = async () => {
    if (isProcessing) return;

    if (typeof window !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(45);
    }

    // Flash simulation
    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 200);

    try {
      setIsProcessing(true);
      setBannerText(null);
      setStatusMessage("Developing analog film...");

      let blob: Blob;
      let previewUrl: string;

      if (videoRef.current && stream && !cameraError) {
        // Capture directly from 4:3 live video element
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
      setStatusMessage("Winding film & locking in vault...");
      await uploadFilteredPhotoToR2({ eventId, blob });

      // Update counters & state
      setShotsCount((prev) => prev + 1);
      setBannerText("🔒 Stored in the Plum Vault!");
      setTimeout(() => setBannerText(null), 4000);
    } catch (err: unknown) {
      console.error(err);
      alert((err as Error).message || "Error processing photo. Please try again.");
    } finally {
      setIsProcessing(false);
      setStatusMessage("");
    }
  };

  // Fallback file input handler (if camera stream denied)
  const handleFallbackCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      setFlashActive(true);
      setTimeout(() => setFlashActive(false), 200);

      setStatusMessage("Developing analog film...");
      const { blob, previewUrl } = await applyAnalogFilter(file, selectedEffect);
      setLastPreview(previewUrl);

      setStatusMessage("Winding film & locking in vault...");
      await uploadFilteredPhotoToR2({ eventId, blob });

      setShotsCount((prev) => prev + 1);
      setBannerText("🔒 Stored in the Plum Vault!");
      setTimeout(() => setBannerText(null), 4000);
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
    <div className="relative min-h-screen bg-[#110510] text-fuchsia-50 flex flex-col items-center justify-between p-3 select-none overflow-hidden font-mono">
      {/* Xenon Flash Burst Animation */}
      <div
        className={`fixed inset-0 bg-white pointer-events-none transition-opacity duration-300 z-50 ${
          flashActive ? "opacity-95" : "opacity-0"
        }`}
      />

      {/* Top Header: Event Title, Roll Counter, Flip Camera */}
      <header className="w-full max-w-sm flex items-center justify-between py-2 border-b border-[#3b1234] z-10">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full bg-fuchsia-500 shadow-[0_0_8px_rgba(217,70,239,0.9)] animate-pulse" />
          <span className="text-xs font-bold tracking-wider uppercase text-fuchsia-200 truncate max-w-[140px]">
            {eventName}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {/* Flip Camera Button */}
          <button
            onClick={toggleFacingMode}
            disabled={isProcessing}
            aria-label="Flip Camera"
            className="p-1.5 rounded-lg bg-[#240b22] border border-[#521c47] text-fuchsia-300 hover:text-fuchsia-100 active:scale-95 transition-all text-xs flex items-center space-x-1"
          >
            <span>🔄</span>
            <span className="text-[10px] uppercase font-bold">{facingMode === "user" ? "Front" : "Back"}</span>
          </button>

          {/* Retro Plum Counter Dial */}
          <div className="flex items-center bg-[#1e071c] px-2.5 py-1 rounded-md border border-[#5a1e4e] shadow-inner">
            <span className="text-[10px] text-fuchsia-400 mr-1.5 tracking-tighter">EXP</span>
            <span className="text-base font-black text-fuchsia-300 tabular-nums">
              {String(shotsCount).padStart(2, "0")}
            </span>
          </div>
        </div>
      </header>

      {/* Camera Body (Luxury Plum #461a3d Retro Shell) */}
      <main className="w-full max-w-sm my-auto bg-gradient-to-b from-[#2a0e27] via-[#20091d] to-[#180616] rounded-3xl p-4 border-2 border-[#571e4a] shadow-[0_12px_40px_rgba(70,26,61,0.6)] flex flex-col items-center relative z-10">
        {/* Optical 4:3 Viewfinder Window */}
        <div className="w-full aspect-[4/3] bg-black rounded-2xl border-4 border-[#3c1334] shadow-inner relative flex items-center justify-center overflow-hidden">
          {/* Live Video Feed */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ filter: currentPreset.cssFilter }}
            className={`w-full h-full object-cover transition-[filter] duration-300 ${
              facingMode === "user" ? "-scale-x-100" : ""
            } ${cameraError ? "hidden" : "block"}`}
          />

          {/* Camera Error / Permission Fallback View */}
          {cameraError && (
            <div className="text-center p-4 text-fuchsia-400">
              <span className="text-2xl block mb-2">📷</span>
              <p className="text-[11px] leading-tight text-fuchsia-200 mb-3">{cameraError}</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 bg-[#461a3d] hover:bg-[#5f2353] text-fuchsia-100 rounded-lg text-xs font-bold border border-[#7a2b6a]"
              >
                Tap to Select Photo
              </button>
            </div>
          )}

          {/* Optical Viewfinder Crosshairs Overlay */}
          <div className="absolute inset-4 border border-white/20 pointer-events-none flex items-center justify-center">
            <div className="w-4 h-4 border-t-2 border-l-2 border-fuchsia-400/60 absolute top-0 left-0" />
            <div className="w-4 h-4 border-t-2 border-r-2 border-fuchsia-400/60 absolute top-0 right-0" />
            <div className="w-4 h-4 border-b-2 border-l-2 border-fuchsia-400/60 absolute bottom-0 left-0" />
            <div className="w-4 h-4 border-b-2 border-r-2 border-fuchsia-400/60 absolute bottom-0 right-0" />
            <div className="w-2.5 h-2.5 rounded-full border border-fuchsia-300/50" />
          </div>

          {/* Filter Badge Watermark (top-left of viewfinder) */}
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md border border-fuchsia-500/30 text-[10px] text-fuchsia-200 flex items-center space-x-1 pointer-events-none">
            <span>{currentPreset.icon}</span>
            <span className="font-bold">{currentPreset.name}</span>
          </div>

          {/* Developing Overlay Spinner */}
          {isProcessing && (
            <div className="absolute inset-0 bg-[#160514]/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center z-30">
              <div className="w-9 h-9 border-3 border-fuchsia-500 border-t-transparent rounded-full animate-spin mb-3 shadow-[0_0_15px_rgba(217,70,239,0.5)]" />
              <p className="text-xs text-fuchsia-200 font-bold uppercase tracking-wider animate-pulse">
                {statusMessage}
              </p>
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
          disabled={isProcessing}
        />

        {/* Effect Selector Carousel (Plum Styled) */}
        <div className="w-full mt-4 flex items-center justify-between space-x-1 overflow-x-auto py-1 scrollbar-none">
          {EFFECT_PRESETS.map((preset) => {
            const isSelected = selectedEffect === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => setSelectedEffect(preset.id)}
                disabled={isProcessing}
                className={`flex-1 py-1.5 px-1 rounded-xl text-[10px] font-bold transition-all flex flex-col items-center justify-center border ${
                  isSelected
                    ? "bg-[#521c47] border-fuchsia-400 text-fuchsia-100 shadow-[0_0_10px_rgba(217,70,239,0.4)] scale-105"
                    : "bg-[#1f071d] border-[#3f1437] text-fuchsia-400/80 hover:text-fuchsia-200"
                }`}
              >
                <span className="text-xs mb-0.5">{preset.icon}</span>
                <span className="truncate max-w-[55px]">{preset.name}</span>
              </button>
            );
          })}
        </div>

        {/* Shutter Button Controls (Deep Plum Aesthetic) */}
        <div className="w-full mt-5 flex items-center justify-around">
          {/* Flash Indicator */}
          <div className="flex flex-col items-center">
            <span className="text-[9px] text-fuchsia-400/80 uppercase tracking-wider mb-1">
              Flash
            </span>
            <div className="w-3.5 h-3.5 rounded-full bg-fuchsia-500 shadow-[0_0_10px_rgba(217,70,239,0.9)]" />
          </div>

          {/* Shutter Button (Plum / Berry Tone) */}
          <button
            onClick={triggerShutter}
            disabled={isProcessing}
            aria-label="Capture Photo"
            className="group relative flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
          >
            <div className="w-20 h-20 rounded-full bg-[#180517] border-4 border-[#5d1f50] shadow-2xl flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#8a226f] via-[#a82a87] to-[#d946ef] shadow-[inset_0_2px_4px_rgba(255,255,255,0.4)] group-hover:brightness-110 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full border border-fuchsia-200/40" />
              </div>
            </div>
          </button>

          {/* Mini Thumbnail Preview of Last Taken */}
          <div className="flex flex-col items-center">
            <span className="text-[9px] text-fuchsia-400/80 uppercase tracking-wider mb-1">
              Last Shot
            </span>
            <div className="w-7 h-7 rounded-lg bg-[#1a0618] border border-[#5d1f50] overflow-hidden flex items-center justify-center">
              {lastPreview ? (
                <img src={lastPreview} alt="Thumb" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[9px] text-fuchsia-600 font-bold">--</span>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Floating Success Pill */}
      {bannerText && (
        <div className="fixed bottom-20 px-4 py-2 bg-gradient-to-r from-[#6b1e5a] to-[#a22b82] border border-fuchsia-400/60 text-fuchsia-50 text-xs font-bold rounded-full shadow-2xl flex items-center space-x-2 animate-bounce z-20">
          <span>{bannerText}</span>
        </div>
      )}

      {/* Bottom Bar: Navigation to Gallery */}
      <footer className="w-full max-w-sm flex items-center justify-between pt-2 border-t border-[#3b1234] text-xs z-10">
        <span className="text-fuchsia-400/70 text-[10px]">Analog 4:3 Live View</span>
        <Link
          href={`/${eventId}/gallery`}
          className="px-3 py-1.5 rounded-lg bg-[#280c26] hover:bg-[#3b1338] text-fuchsia-300 hover:text-fuchsia-100 text-xs font-bold border border-[#5d1f50] transition-colors flex items-center space-x-1"
        >
          <span>Reveal Gallery</span>
          <span>→</span>
        </Link>
      </footer>
    </div>
  );
}
