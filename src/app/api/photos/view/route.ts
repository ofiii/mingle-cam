import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client, R2_BUCKET_NAME } from "@/lib/r2";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");

    if (!key) {
      return NextResponse.json({ error: "Missing image key" }, { status: 400 });
    }

    const r2 = getR2Client();
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    const response = await r2.send(command);

    if (!response.Body) {
      return NextResponse.json({ error: "Image body not found" }, { status: 404 });
    }

    // Convert AWS SDK stream to Web ReadableStream
    const stream = response.Body.transformToWebStream();

    return new Response(stream, {
      headers: {
        "Content-Type": response.ContentType || "image/jpeg",
        "Cache-Control": "public, max-age=31536000, s-maxage=31536000, stale-while-revalidate=86400, immutable",
        "CDN-Cache-Control": "public, max-age=31536000",
        "Vercel-CDN-Cache-Control": "public, max-age=31536000",
        "ETag": response.ETag || "",
      },
    });
  } catch (error) {
    console.error("[VIEW_PHOTO_ERROR]", error);
    return NextResponse.json({ error: "Image not found or inaccessible" }, { status: 404 });
  }
}
