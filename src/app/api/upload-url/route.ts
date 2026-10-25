import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Client, R2_BUCKET_NAME, R2_PUBLIC_URL } from "@/lib/r2";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { eventId } = await req.json();

    if (!eventId) {
      return NextResponse.json({ error: "Missing eventId" }, { status: 400 });
    }

    // Verify session token from cookie
    const sessionToken = req.cookies.get(`mingle_session_${eventId}`)?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: "Unauthorized session" }, { status: 401 });
    }

    const guest = await prisma.guest.findUnique({
      where: { sessionToken },
    });

    if (!guest || guest.eventId !== eventId) {
      return NextResponse.json({ error: "Invalid guest session" }, { status: 403 });
    }

    // Generate unique object key
    const fileId = crypto.randomUUID();
    const timestamp = Date.now();
    const s3ObjectKey = `events/${eventId}/photos/${guest.id}_${timestamp}_${fileId}.jpg`;

    const r2 = getR2Client();
    const putCommand = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: s3ObjectKey,
      ContentType: "image/jpeg",
    });

    // 5 minute presigned PUT URL
    const uploadUrl = await getSignedUrl(r2, putCommand, {
      expiresIn: 300,
    });

    const imageUrl = `${R2_PUBLIC_URL}/${s3ObjectKey}`;

    return NextResponse.json({
      uploadUrl,
      s3ObjectKey,
      imageUrl,
      guestId: guest.id,
    });
  } catch (error) {
    console.error("[UPLOAD_URL_ERROR]", error);
    return NextResponse.json(
      { error: (error as Error).message || "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}
