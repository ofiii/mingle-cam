"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface EventItem {
  id: string;
  name: string;
  revealDate: string;
  maxGuests?: number | null;
  maxPhotosPerGuest?: number;
  themeColor?: string;
  createdAt: string;
  _count: {
    photos: number;
    guests: number;
  };
}

const PRESET_PALETTES = [
  { name: "Plum", hex: "#461a3d" },
  { name: "Forest Sage", hex: "#2d5a37" },
  { name: "Classic Navy", hex: "#1b365d" },
  { name: "Terracotta", hex: "#c16147" },
  { name: "Champagne", hex: "#c5a059" },
  { name: "Obsidian", hex: "#1e1b1f" },
];

export default function AdminDashboardPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Form Fields
  const [name, setName] = useState("");
  const [revealDate, setRevealDate] = useState("");
  const [maxGuests, setMaxGuests] = useState("100");
  const [isUnlimitedGuests, setIsUnlimitedGuests] = useState(false);
  const [maxPhotosPerGuest, setMaxPhotosPerGuest] = useState("20");
  const [themeColor, setThemeColor] = useState("#461a3d");

  // Notifications & Deletions
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState<EventItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedEventId, setCopiedEventId] = useState<string | null>(null);

  const handleCopyLink = (eventId: string) => {
    if (typeof window === "undefined") return;
    const fullUrl = `${window.location.origin}/${eventId}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedEventId(eventId);
    setTimeout(() => setCopiedEventId(null), 2500);
  };

  const fetchEvents = async () => {
    try {
      const res = await fetch("/api/events");
      if (!res.ok) return;
      const data = await res.json();
      setEvents(data.events || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetch("/api/events")
      .then((res) => res.json())
      .then((data) => {
        if (active) {
          setEvents(data.events || []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !revealDate) return;

    try {
      setCreating(true);
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          revealDate,
          maxGuests: isUnlimitedGuests ? null : Number(maxGuests) || null,
          maxPhotosPerGuest: Number(maxPhotosPerGuest) || 20,
          themeColor: themeColor.trim() || "#461a3d",
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create event");
      }

      setName("");
      setRevealDate("");
      setMaxGuests("100");
      setIsUnlimitedGuests(false);
      setMaxPhotosPerGuest("20");
      setThemeColor("#461a3d");

      setActionMessage("Event created with custom branding successfully!");
      fetchEvents();
      setTimeout(() => setActionMessage(null), 3500);
    } catch (err: unknown) {
      alert((err as Error).message || "Error creating event");
    } finally {
      setCreating(false);
    }
  };

  const handleInstantReveal = async (eventId: string) => {
    if (!confirm("Are you sure you want to trigger the instant reveal for all guests?")) {
      return;
    }

    try {
      const res = await fetch(`/api/events/${eventId}/reveal`, {
        method: "POST",
      });

      if (!res.ok) throw new Error("Failed to trigger reveal");
      setActionMessage("Event photos revealed to everyone! 🎉");
      fetchEvents();
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err: unknown) {
      alert((err as Error).message || "Error revealing event");
    }
  };

  const executeDeleteEvent = async () => {
    if (!confirmDeleteEvent) return;

    try {
      setIsDeleting(true);
      const res = await fetch(`/api/events/${confirmDeleteEvent.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete event");
      }

      const data = await res.json();
      setEvents((prev) => prev.filter((ev) => ev.id !== confirmDeleteEvent.id));
      setConfirmDeleteEvent(null);
      setActionMessage(data.message || "Event and associated photos deleted successfully.");
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err: unknown) {
      alert((err as Error).message || "Error deleting event");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 p-6 sm:p-10 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-stone-800 gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#9b4288]" />
              <span className="text-xs font-semibold uppercase text-[#d8a4cb] tracking-wider">
                Event Organizer Console
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-100 tracking-tight mt-1">
              Mingle Cam Dashboard
            </h1>
          </div>

          <div className="text-xs text-stone-400 flex items-center space-x-4">
            <div>
              <span>R2 Cloudflare: </span>
              <span className="text-emerald-400 font-bold">Connected</span>
            </div>
            <Link
              href="/"
              className="text-stone-300 hover:text-white underline underline-offset-4"
            >
              Public Home ↗
            </Link>
          </div>
        </div>

        {actionMessage && (
          <div className="p-4 rounded-xl bg-[#461a3d]/40 border border-[#7a2e6b] text-stone-200 text-xs flex items-center space-x-2">
            <span>✨</span>
            <span>{actionMessage}</span>
          </div>
        )}

        {/* Create Event Section with Customization */}
        <section className="bg-stone-900 border border-stone-800 rounded-3xl p-6 sm:p-8 shadow-xl">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <span>➕</span>
              <span>Create New Event Session</span>
            </h2>
            <p className="text-xs text-stone-400 mt-1">
              Customize guest capacity, roll exposure limits, and camera theme color to match your client’s wedding or party palette.
            </p>
          </div>

          <form onSubmit={handleCreateEvent} className="space-y-5">
            {/* Row 1: Event Name & Reveal Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-2">
                  Event Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sarah & David Wedding"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 placeholder-stone-600 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b4288]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-2">
                  Scheduled Reveal Time
                </label>
                <input
                  type="datetime-local"
                  required
                  value={revealDate}
                  onChange={(e) => setRevealDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b4288]"
                />
              </div>
            </div>

            {/* Row 2: Guest Slot Capacity & Photos Limit per Guest */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-stone-800/60">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-stone-300 uppercase tracking-wider">
                    Guest Capacity Slots
                  </label>
                  <label className="flex items-center space-x-1.5 text-xs text-stone-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isUnlimitedGuests}
                      onChange={(e) => setIsUnlimitedGuests(e.target.checked)}
                      className="rounded bg-stone-950 border-stone-700 text-[#9b4288] focus:ring-0"
                    />
                    <span>Unlimited</span>
                  </label>
                </div>
                <input
                  type="number"
                  min={1}
                  max={5000}
                  disabled={isUnlimitedGuests}
                  placeholder={isUnlimitedGuests ? "Unlimited Guests" : "e.g. 50, 100, 200"}
                  value={isUnlimitedGuests ? "" : maxGuests}
                  onChange={(e) => setMaxGuests(e.target.value)}
                  className="w-full px-4 py-2.5 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 placeholder-stone-600 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b4288] disabled:opacity-40"
                />
                <span className="text-[11px] text-stone-500 mt-1 block">
                  {isUnlimitedGuests ? "No limit on how many guests can join." : "Maximum number of distinct guest devices permitted to join."}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-2">
                  Photo Limit per Guest (Roll Size)
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  required
                  placeholder="e.g. 10, 20, 25, 36"
                  value={maxPhotosPerGuest}
                  onChange={(e) => setMaxPhotosPerGuest(e.target.value)}
                  className="w-full px-4 py-2.5 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b4288]"
                />
                <span className="text-[11px] text-stone-500 mt-1 block">
                  Number of analog exposures allocated to each guest (default: 20).
                </span>
              </div>
            </div>

            {/* Row 3: Custom Camera Body Theme Color */}
            <div className="pt-2 border-t border-stone-800/60">
              <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-2">
                Custom Camera Body Color (Hexcode)
              </label>

              <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={themeColor}
                    onChange={(e) => setThemeColor(e.target.value)}
                    className="w-10 h-10 rounded-xl cursor-pointer bg-transparent border-0 p-0"
                    title="Choose color"
                  />
                  <input
                    type="text"
                    maxLength={7}
                    value={themeColor}
                    onChange={(e) => setThemeColor(e.target.value)}
                    className="w-28 px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 font-mono text-sm uppercase focus:outline-none focus:ring-2 focus:ring-[#9b4288]"
                  />
                </div>

                {/* Quick Preset Swatches */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-stone-500 mr-1">Presets:</span>
                  {PRESET_PALETTES.map((p) => (
                    <button
                      key={p.hex}
                      type="button"
                      onClick={() => setThemeColor(p.hex)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border flex items-center space-x-1.5 transition-all ${
                        themeColor.toLowerCase() === p.hex.toLowerCase()
                          ? "bg-stone-800 border-white text-white"
                          : "bg-stone-950 border-stone-800 text-stone-400 hover:text-white"
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block"
                        style={{ backgroundColor: p.hex }}
                      />
                      <span>{p.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              <span className="text-[11px] text-stone-500 mt-1.5 block">
                The guest’s handheld camera chassis will be dynamically styled with this hex color.
              </span>
            </div>

            {/* Submit Button */}
            <div className="pt-3">
              <button
                type="submit"
                disabled={creating}
                className="w-full sm:w-auto px-8 py-3 bg-[#461a3d] hover:bg-[#59214e] text-white font-bold rounded-xl transition-all uppercase tracking-wider text-xs shadow-lg border border-[#6b285d] disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                <span>{creating ? "Launching Event..." : "Launch Event Session 🚀"}</span>
              </button>
            </div>
          </form>
        </section>

        {/* Existing Events List */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-stone-100 flex items-center space-x-2">
              <span>📋</span>
              <span>Active Mingle Events</span>
            </h2>
            <span className="text-xs text-stone-400 font-mono">
              {events.length} {events.length === 1 ? "Event" : "Events"}
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-stone-500 font-mono text-xs">
              Loading events...
            </div>
          ) : events.length === 0 ? (
            <div className="p-12 text-center bg-stone-900 border border-dashed border-stone-800 rounded-2xl text-stone-500 text-sm">
              No events found. Create your first session above!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {events.map((event) => {
                const isPassed = new Date() >= new Date(event.revealDate);
                const guestUrl = `/${event.id}`;
                const eventTheme = event.themeColor || "#461a3d";
                const maxPhotos = event.maxPhotosPerGuest || 20;
                const guestCap = event.maxGuests ? `${event.maxGuests} max` : "Unlimited";

                return (
                  <div
                    key={event.id}
                    className="bg-stone-900 border border-stone-800 rounded-3xl p-5 shadow-lg flex flex-col justify-between space-y-4 relative overflow-hidden"
                  >
                    {/* Top Accent Strip with Event Theme Color */}
                    <div
                      className="absolute top-0 inset-x-0 h-1.5"
                      style={{ backgroundColor: eventTheme }}
                    />

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase border ${
                              isPassed
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                : "bg-[#461a3d]/40 text-[#d8a4cb] border-[#6b285d]/60"
                            }`}
                          >
                            {isPassed ? "Revealed" : "Locked in Vault"}
                          </span>
                          {/* Color Swatch Badge */}
                          <div
                            className="w-3.5 h-3.5 rounded-full border border-white/30"
                            style={{ backgroundColor: eventTheme }}
                            title={`Camera theme: ${eventTheme}`}
                          />
                        </div>

                        <span className="text-[11px] font-mono text-stone-500">
                          {new Date(event.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <h3 className="text-lg font-bold text-stone-100">
                        {event.name}
                      </h3>
                      <p className="text-xs font-mono text-stone-400 mt-1">
                        Reveal: {new Date(event.revealDate).toLocaleString()}
                      </p>
                    </div>

                    {/* Stats & Custom Settings Grid */}
                    <div className="grid grid-cols-3 gap-2 bg-stone-950 p-3 rounded-2xl border border-stone-800/80 text-xs">
                      <div>
                        <span className="text-stone-500 text-[10px] block uppercase font-mono">GUESTS</span>
                        <span className="text-stone-200 font-bold">
                          {event._count.guests} <span className="text-[10px] text-stone-500 font-normal">/ {guestCap}</span>
                        </span>
                      </div>
                      <div>
                        <span className="text-stone-500 text-[10px] block uppercase font-mono">PHOTOS</span>
                        <span className="text-[#d8a4cb] font-bold">{event._count.photos} captured</span>
                      </div>
                      <div>
                        <span className="text-stone-500 text-[10px] block uppercase font-mono">ROLL SIZE</span>
                        <span className="text-stone-300 font-bold">{maxPhotos} / guest</span>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center justify-between pt-2 border-t border-stone-800/80 text-xs">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleCopyLink(event.id)}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 border transition-all ${
                            copiedEventId === event.id
                              ? "bg-emerald-600 text-white border-emerald-500 shadow-md scale-105"
                              : "bg-stone-800 hover:bg-stone-700 text-stone-200 border-stone-700"
                          }`}
                          title="Copy guest invite link for guests (WhatsApp, Instagram, etc)"
                        >
                          <span>{copiedEventId === event.id ? "✓" : "📋"}</span>
                          <span>{copiedEventId === event.id ? "Copied!" : "Copy Guest Link"}</span>
                        </button>

                        <Link
                          href={guestUrl}
                          target="_blank"
                          className="text-stone-400 hover:text-stone-200 text-xs hidden sm:flex items-center space-x-0.5"
                          title="Open guest onboarding page"
                        >
                          <span>Open ↗</span>
                        </Link>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Link
                          href={`/${event.id}/gallery`}
                          target="_blank"
                          className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl text-xs font-medium"
                        >
                          Gallery
                        </Link>

                        {!isPassed && (
                          <button
                            onClick={() => handleInstantReveal(event.id)}
                            className="px-3 py-1.5 bg-[#461a3d] hover:bg-[#59214e] text-white font-bold rounded-xl text-xs border border-[#6b285d] transition-colors"
                          >
                            Reveal 🔓
                          </button>
                        )}

                        {/* Delete Event Button */}
                        <button
                          onClick={() => setConfirmDeleteEvent(event)}
                          className="px-2.5 py-1.5 bg-red-950/40 hover:bg-red-950 text-red-300 border border-red-900/60 rounded-xl text-xs font-semibold transition-colors"
                          title="Delete Event and all photos"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Delete Event Confirmation Modal */}
      {confirmDeleteEvent && (
        <div
          onClick={() => setConfirmDeleteEvent(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-stone-900 border border-red-900/80 rounded-3xl p-6 shadow-2xl flex flex-col space-y-4"
          >
            <div className="w-12 h-12 rounded-2xl bg-red-950/80 border border-red-700/60 flex items-center justify-center text-2xl">
              ⚠️
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">Delete Event Session?</h3>
              <p className="text-xs text-stone-400 mt-1 leading-relaxed">
                You are about to delete <strong className="text-white">“{confirmDeleteEvent.name}”</strong>. This will permanently delete all {confirmDeleteEvent._count.photos} photos from Cloudflare R2 storage and remove all guest records. This action cannot be undone.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end space-x-3">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setConfirmDeleteEvent(null)}
                className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={executeDeleteEvent}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl shadow transition-all disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Permanently Delete 🗑️"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
