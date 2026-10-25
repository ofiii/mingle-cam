export interface UploadResult {
  imageUrl: string;
  photoId: string;
}

/**
 * Client service to orchestrate Presigned URL retrieval, direct PUT to R2,
 * and database confirmation.
 */
export async function uploadFilteredPhotoToR2({
  eventId,
  blob,
}: {
  eventId: string;
  blob: Blob;
}): Promise<UploadResult> {
  // 1. Request presigned upload URL from Next.js API
  const urlRes = await fetch("/api/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId }),
  });

  if (!urlRes.ok) {
    const errorData = await urlRes.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to obtain upload authorization");
  }

  const { uploadUrl, s3ObjectKey, imageUrl } = await urlRes.json();

  // 2. Direct binary HTTP PUT to Cloudflare R2
  const r2UploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "image/jpeg",
    },
    body: blob,
  });

  if (!r2UploadRes.ok) {
    throw new Error(`Direct R2 upload failed with HTTP status ${r2UploadRes.status}`);
  }

  // 3. Register finalized photo record in database
  const confirmRes = await fetch("/api/photos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId, s3ObjectKey, imageUrl }),
  });

  if (!confirmRes.ok) {
    const errorData = await confirmRes.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to register photo in the event album");
  }

  const { photo } = await confirmRes.json();
  return { imageUrl, photoId: photo.id };
}
