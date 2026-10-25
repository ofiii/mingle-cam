import { PrismaClient } from "@prisma/client";

function getCleanUrl(url?: string): string | undefined {
  if (!url) return undefined;
  let cleaned = url.trim();
  // Strip outer double or single quotes if copied with quotes from .env
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned;
}

const cleanedUrl = getCleanUrl(process.env.DATABASE_URL);

if (!cleanedUrl) {
  console.error("[PRISMA_INIT_WARN] process.env.DATABASE_URL is undefined or empty!");
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: cleanedUrl,
    log: ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
