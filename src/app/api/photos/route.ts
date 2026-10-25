import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getR2Client, R2_BUCKET_NAME } from "@/lib/r2";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";

// Fetch photos captured by the current guest
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId");

    if (!eventId) {
      return NextResponse.json({ error: "Missing eventId" }, { status: 400 });
    }

    const sessionToken = req.cookies.get(`mingle_session_${eventId}`)?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: "Unauthorized session" }, { status: 401 });
    }

    const guest = await prisma.guest.findUnique({
      where: { sessionToken },
      include: {
        event: {
          select: { maxPhotosPerGuest: true },
        },
      },
    });

    if (!guest || guest.eventId !== eventId) {
      return NextResponse.json({ error: "Invalid session" }, { status: 403 });
    }

    const maxPhotos = guest.event?.maxPhotosPerGuest || 20;

    const photos = await prisma.photo.findMany({
      where: {
        guestId: guest.id,
        eventId,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        imageUrl: true,
        s3ObjectKey: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      photos: photos.map((p) => ({
        ...p,
        imageUrl: `/api/photos/view?key=${encodeURIComponent(p.s3ObjectKey)}`,
      })),
      photoCount: photos.length,
      maxPhotos,
      remainingPhotos: Math.max(0, maxPhotos - photos.length),
    });
  } catch (error) {
    console.error("[GET_GUEST_PHOTOS_ERROR]", error);
    return NextResponse.json({ error: "Could not fetch photos" }, { status: 500 });
  }
}

// Save a captured photo
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
      include: {
        event: {
          select: { maxPhotosPerGuest: true },
        },
      },
    });

    if (!guest || guest.eventId !== eventId) {
      return NextResponse.json({ error: "Invalid session" }, { status: 403 });
    }

    const maxPhotos = guest.event?.maxPhotosPerGuest || 20;

    const currentCount = await prisma.photo.count({
      where: { guestId: guest.id, eventId },
    });

    if (currentCount >= maxPhotos) {
      return NextResponse.json(
        { error: `Limit of ${maxPhotos} photos per guest reached!` },
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

    return NextResponse.json({ success: true, photo, photoCount: currentCount + 1 });
  } catch (error) {
    console.error("[SAVE_PHOTO_ERROR]", error);
    return NextResponse.json({ error: "Could not save photo" }, { status: 500 });
  }
}

// Delete a photo owned by the current guest
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const photoId = searchParams.get("photoId");
    const eventId = searchParams.get("eventId");

    if (!photoId || !eventId) {
      return NextResponse.json({ error: "Missing photoId or eventId" }, { status: 400 });
    }

    const sessionToken = req.cookies.get(`mingle_session_${eventId}`)?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: "Unauthorized session" }, { status: 401 });
    }

    const guest = await prisma.guest.findUnique({
      where: { sessionToken },
      include: {
        event: {
          select: { maxPhotosPerGuest: true },
        },
      },
    });

    if (!guest || guest.eventId !== eventId) {
      return NextResponse.json({ error: "Invalid session" }, { status: 403 });
    }

    const maxPhotos = guest.event?.maxPhotosPerGuest || 20;

    // Verify ownership of the photo
    const photo = await prisma.photo.findUnique({
      where: { id: photoId },
    });

    if (!photo || photo.guestId !== guest.id || photo.eventId !== eventId) {
      return NextResponse.json({ error: "Photo not found or permission denied" }, { status: 404 });
    }

    // Delete record from database
    await prisma.photo.delete({
      where: { id: photoId },
    });

    // Delete object from Cloudflare R2
    try {
      const r2 = getR2Client();
      await r2.send(
        new DeleteObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: photo.s3ObjectKey,
        })
      );
    } catch (r2Err) {
      console.warn("Could not delete object from R2:", r2Err);
    }

    // Recalculate remaining photos
    const newCount = await prisma.photo.count({
      where: { guestId: guest.id, eventId },
    });

    return NextResponse.json({
      success: true,
      photoCount: newCount,
      maxPhotos,
      remainingPhotos: Math.max(0, maxPhotos - newCount),
    });
  } catch (error) {
    console.error("[DELETE_PHOTO_ERROR]", error);
    return NextResponse.json({ error: "Could not delete photo" }, { status: 500 });
  }
}
