import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/events - List all events with counts and customization settings
export async function GET() {
  try {
    const events = await prisma.event.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { photos: true, guests: true },
        },
      },
    });

    return NextResponse.json({ events });
  } catch (error) {
    console.error("[GET_EVENTS_ERROR]", error);
    return NextResponse.json(
      { error: (error as Error).message || "Failed to fetch events" },
      { status: 500 }
    );
  }
}

// POST /api/events - Create a new event with custom settings
export async function POST(req: NextRequest) {
  try {
    const { name, revealDate, maxGuests, maxPhotosPerGuest, themeColor } = await req.json();

    if (!name || !revealDate) {
      return NextResponse.json(
        { error: "Event name and revealDate are required" },
        { status: 400 }
      );
    }

    // Parse customizations with safe defaults
    const parsedMaxGuests = maxGuests !== undefined && maxGuests !== null && maxGuests !== ""
      ? Number(maxGuests)
      : null; // null represents Unlimited

    const parsedMaxPhotos = maxPhotosPerGuest ? Math.max(1, Math.min(100, Number(maxPhotosPerGuest))) : 20;
    const parsedThemeColor = (themeColor && /^#[0-9A-Fa-f]{6}$/.test(themeColor.trim()))
      ? themeColor.trim()
      : "#461a3d";

    const event = await prisma.event.create({
      data: {
        name: name.trim(),
        revealDate: new Date(revealDate),
        maxGuests: parsedMaxGuests,
        maxPhotosPerGuest: parsedMaxPhotos,
        themeColor: parsedThemeColor,
      },
    });

    return NextResponse.json({ success: true, event });
  } catch (error) {
    console.error("[CREATE_EVENT_ERROR]", error);
    return NextResponse.json(
      { error: (error as Error).message || "Failed to create event" },
      { status: 500 }
    );
  }
}
