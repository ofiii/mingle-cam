import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { eventId, s3ObjectKey, imageUrl } = await req.json();

    if (!eventId || !s3ObjectKey || !imageUrl) {
      return NextResponse.json({ error: "Missing required photo fields" }, { status: 400 });
    }

    const sessionToken = req.cookies.get(`mingle_session_${eventId}`)?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: "Unauthorized session" }, { status: 401 });
    }

    const guest = await prisma.guest.findUnique({
      where: { sessionToken },
    });

    if (!guest || guest.eventId !== eventId) {
      return NextResponse.json({ error: "Invalid session" }, { status: 403 });
    }

    const currentCount = await prisma.photo.count({
      where: { guestId: guest.id, eventId },
    });

    if (currentCount >= 20) {
      return NextResponse.json(
        { error: "Limit of 20 photos per guest reached!" },
        { status: 403 }
      );
    }

    const photo = await prisma.photo.create({
      data: {
        eventId,
        guestId: guest.id,
        s3ObjectKey,
        imageUrl,
        isRevealed: false,
      },
    });

    return NextResponse.json({ success: true, photo });
  } catch (error) {
    console.error("[SAVE_PHOTO_ERROR]", error);
    return NextResponse.json({ error: "Could not save photo" }, { status: 500 });
  }
}
