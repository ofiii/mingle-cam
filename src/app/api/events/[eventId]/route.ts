import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getR2Client, R2_BUCKET_NAME } from "@/lib/r2";
import { DeleteObjectsCommand } from "@aws-sdk/client-s3";

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
      const rawPhotos = await prisma.photo.findMany({
        where: { eventId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          imageUrl: true,
          s3ObjectKey: true,
          createdAt: true,
          guest: {
            select: { name: true },
          },
        },
      });

      photos = rawPhotos.map((p) => ({
        id: p.id,
        imageUrl: `/api/photos/view?key=${encodeURIComponent(p.s3ObjectKey)}`,
        createdAt: p.createdAt,
        guest: p.guest,
      }));
    }

    // Check if current guest session cookie exists
    const sessionCookie = req.cookies.get(`mingle_session_${eventId}`)?.value;
    let currentGuest: { id: string; name: string; photoCount: number } | null = null;
    if (sessionCookie) {
      const guestRecord = await prisma.guest.findUnique({
        where: { sessionToken: sessionCookie },
        select: {
          id: true,
          name: true,
          eventId: true,
          _count: {
            select: { photos: true },
          },
        },
      });
      if (guestRecord && guestRecord.eventId === eventId) {
        currentGuest = {
          id: guestRecord.id,
          name: guestRecord.name,
          photoCount: guestRecord._count.photos,
        };
      }
    }

    return NextResponse.json({
      event: {
        id: event.id,
        name: event.name,
        revealDate: event.revealDate,
        maxGuests: event.maxGuests,
        maxPhotosPerGuest: event.maxPhotosPerGuest,
        themeColor: event.themeColor,
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

// DELETE /api/events/[eventId] - Delete event and clean up all Cloudflare R2 photos
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await context.params;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        photos: {
          select: { s3ObjectKey: true },
        },
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Batch delete all photos from Cloudflare R2 bucket
    if (event.photos.length > 0) {
      try {
        const r2 = getR2Client();
        // S3 DeleteObjects supports batches up to 1000 objects
        const chunks = [];
        for (let i = 0; i < event.photos.length; i += 1000) {
          chunks.push(event.photos.slice(i, i + 1000));
        }

        for (const chunk of chunks) {
          await r2.send(
            new DeleteObjectsCommand({
              Bucket: R2_BUCKET_NAME,
              Delete: {
                Objects: chunk.map((p) => ({ Key: p.s3ObjectKey })),
                Quiet: true,
              },
            })
          );
        }
      } catch (r2Err) {
        console.warn("[R2_CLEANUP_WARN] Could not clean up all photos from R2:", r2Err);
      }
    }

    // Cascade delete Event, Guests, and Photos from PostgreSQL
    await prisma.event.delete({
      where: { id: eventId },
    });

    return NextResponse.json({
      success: true,
      message: `Event '${event.name}' and all associated photos deleted successfully.`,
    });
  } catch (error) {
    console.error("[DELETE_EVENT_ERROR]", error);
    return NextResponse.json(
      { error: (error as Error).message || "Failed to delete event" },
      { status: 500 }
    );
  }
}
