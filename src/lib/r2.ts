import { S3Client } from "@aws-sdk/client-s3";

let clientInstance: S3Client | null = null;

export function getR2Client(): S3Client {
  if (clientInstance) return clientInstance;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Missing Cloudflare R2 credentials (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY) in environment."
    );
  }

  clientInstance = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return clientInstance;
}

export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "mingle-cam-bucket";
export const R2_PUBLIC_URL = (
  process.env.NEXT_PUBLIC_R2_URL || "https://pub-5a3945f83de644a9be20fafbae03b064.r2.dev"
).replace(/\/$/, "");
