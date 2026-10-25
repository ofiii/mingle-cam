"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface EventItem {
  id: string;
  name: string;
  revealDate: string;
  createdAt: string;
  _count: {
    photos: number;
    guests: number;
  };
}

export default function AdminDashboardPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [revealDate, setRevealDate] = useState("");
  const [actionMessage, setActionMessage] = useState<string | null>(null);

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
    fetchEvents();
  }, []);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !revealDate) return;

    try {
      setCreating(true);
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), revealDate }),
      });

      if (!res.ok) throw new Error("Failed to create event");
      setName("");
      setRevealDate("");
      setActionMessage("Event created successfully!");
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

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 p-6 sm:p-10 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-stone-800 gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span className="text-xs font-mono uppercase text-amber-500 font-bold tracking-wider">
                Event Organizer Console
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-100 tracking-tight mt-1">
              Mingle Cam Dashboard
            </h1>
          </div>

          <div className="font-mono text-xs text-stone-400">
            <span>R2 Storage: </span>
            <span className="text-emerald-400 font-bold">Connected</span>
          </div>
        </div>

        {actionMessage && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-xs flex items-center space-x-2">
            <span>✨</span>
            <span>{actionMessage}</span>
          </div>
        )}

        {/* Create Event Section */}
        <section className="bg-stone-900 border border-stone-800 rounded-2xl p-6 shadow-xl">
          <h2 className="text-lg font-bold text-stone-100 mb-4 font-mono flex items-center space-x-2">
            <span>➕</span>
            <span>Create New Mingle Session</span>
          </h2>

          <form onSubmit={handleCreateEvent} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-mono text-stone-400 uppercase tracking-wider mb-2">
                Event Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Friday Mingle & Cocktails"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 placeholder-stone-600 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-stone-400 uppercase tracking-wider mb-2">
                Scheduled Reveal Time
              </label>
              <input
                type="datetime-local"
                required
                value={revealDate}
                onChange={(e) => setRevealDate(e.target.value)}
                className="w-full px-4 py-2.5 bg-stone-950 border border-stone-700 rounded-xl text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={creating}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-xl transition-all font-mono uppercase tracking-wider text-xs shadow disabled:opacity-50"
              >
                {creating ? "Creating..." : "Launch Event 🚀"}
              </button>
            </div>
          </form>
        </section>

        {/* Existing Events List */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-stone-100 font-mono flex items-center space-x-2">
            <span>📋</span>
            <span>Active Mingle Events</span>
          </h2>

          {loading ? (
            <div className="p-8 text-center text-stone-500 font-mono text-xs">
              Loading events...
            </div>
          ) : events.length === 0 ? (
            <div className="p-12 text-center bg-stone-900 border border-dashed border-stone-800 rounded-2xl text-stone-500 font-mono text-sm">
              No events found. Create your first session above!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {events.map((event) => {
                const isPassed = new Date() >= new Date(event.revealDate);
                const guestUrl = `/${event.id}`;

                return (
                  <div
                    key={event.id}
                    className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between space-y-4"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase border ${
                            isPassed
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          }`}
                        >
                          {isPassed ? "Revealed" : "Locked in Vault"}
                        </span>
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

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-2 bg-stone-950 p-3 rounded-xl border border-stone-800/80 font-mono text-xs">
                      <div>
                        <span className="text-stone-500 text-[10px] block">GUESTS</span>
                        <span className="text-stone-200 font-bold">{event._count.guests} joined</span>
                      </div>
                      <div>
                        <span className="text-stone-500 text-[10px] block">PHOTOS</span>
                        <span className="text-amber-400 font-bold">{event._count.photos} captured</span>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center justify-between pt-2 border-t border-stone-800/80 font-mono text-xs">
                      <Link
                        href={guestUrl}
                        target="_blank"
                        className="text-stone-300 hover:text-amber-400 underline underline-offset-4 flex items-center space-x-1"
                      >
                        <span>Guest Link ↗</span>
                      </Link>

                      <div className="flex items-center space-x-2">
                        <Link
                          href={`/${event.id}/gallery`}
                          target="_blank"
                          className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg text-xs"
                        >
                          Gallery
                        </Link>

                        {!isPassed && (
                          <button
                            onClick={() => handleInstantReveal(event.id)}
                            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-lg text-xs"
                          >
                            Reveal Now 🔓
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
