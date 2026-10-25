import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await context.params;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        _count: {
          select: { photos: true, guests: true },
        },
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const now = new Date();
    const isRevealed = now >= new Date(event.revealDate);

    // If revealed, fetch all photos with guest names
    let photos: Array<{
      id: string;
      imageUrl: string;
      createdAt: Date;
      guest: { name: string };
    }> = [];

    if (isRevealed) {
      photos = await prisma.photo.findMany({
        where: { eventId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          imageUrl: true,
          createdAt: true,
          guest: {
            select: { name: true },
          },
        },
      });
    }

    // Check if current guest session cookie exists
    const sessionCookie = req.cookies.get(`mingle_session_${eventId}`)?.value;
    let currentGuest: { id: string; name: string } | null = null;
    if (sessionCookie) {
      const guestRecord = await prisma.guest.findUnique({
        where: { sessionToken: sessionCookie },
        select: { id: true, name: true, eventId: true },
      });
      if (guestRecord && guestRecord.eventId === eventId) {
        currentGuest = { id: guestRecord.id, name: guestRecord.name };
      }
    }

    return NextResponse.json({
      event: {
        id: event.id,
        name: event.name,
        revealDate: event.revealDate,
        createdAt: event.createdAt,
        totalPhotos: event._count.photos,
        totalGuests: event._count.guests,
      },
      isRevealed,
      currentGuest,
      photos,
    });
  } catch (error) {
    console.error("[GET_EVENT_DETAIL_ERROR]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
