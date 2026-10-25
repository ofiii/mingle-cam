import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { eventId, name } = body;

    if (!eventId || !name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Event ID and valid Guest Name are required" },
        { status: 400 }
      );
    }

    // Verify event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Create session token and guest record
    const sessionToken = crypto.randomUUID();
    const guest = await prisma.guest.create({
      data: {
        eventId,
        name: name.trim(),
        sessionToken,
      },
    });

    const response = NextResponse.json({
      success: true,
      guest: {
        id: guest.id,
        name: guest.name,
        eventId: guest.eventId,
      },
    });

    // Set HTTP-only cookie scoped to this event
    response.cookies.set(`mingle_session_${eventId}`, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error) {
    console.error("[AUTH_GUEST_ERROR]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
