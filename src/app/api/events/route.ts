import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/events - List all events
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

// POST /api/events - Create a new event
export async function POST(req: NextRequest) {
  try {
    const { name, revealDate } = await req.json();

    if (!name || !revealDate) {
      return NextResponse.json(
        { error: "Event name and revealDate are required" },
        { status: 400 }
      );
    }

    const event = await prisma.event.create({
      data: {
        name: name.trim(),
        revealDate: new Date(revealDate),
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
