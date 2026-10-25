# 📸 Mingle Cam — Vintage 35mm Shared Digital Album

A web-based disposable camera & shared digital album for event mingle sessions. Guests scan a QR code, snap photos with an authentic analog filter & vintage orange date stamp, and all shots stay locked in Cloudflare R2 storage until the event's grand reveal!

---

## ⚡ Tech Stack

- **Framework**: Next.js 16 (App Router, TypeScript, React 19)
- **Styling**: Tailwind CSS
- **Database & ORM**: Prisma ORM with Supabase PostgreSQL (Session / Transaction pooling on port 6543)
- **Storage**: Cloudflare R2 via `@aws-sdk/client-s3` (Direct client-side PUT using Presigned URLs)

---

## 🚀 Getting Started

### 1. Environment Setup

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Fill in your Supabase connection strings and Cloudflare R2 credentials:

```env
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"

R2_ACCOUNT_ID="your_cloudflare_account_id"
R2_ACCESS_KEY_ID="your_r2_access_key_id"
R2_SECRET_ACCESS_KEY="your_r2_secret_access_key"
R2_BUCKET_NAME="mingle-cam-photos"
NEXT_PUBLIC_R2_URL="https://pub-5a3945f83de644a9be20fafbae03b064.r2.dev"
```

### 2. Database Migration

Run Prisma migrations to create the tables in your Supabase database:

```bash
npx prisma db push
# or
npx prisma migrate dev --name init
```

### 3. Cloudflare R2 CORS Configuration

In the Cloudflare Dashboard under **R2 > Your Bucket > Settings > CORS Policy**, add:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://your-domain.com"
    ],
    "AllowedMethods": [
      "GET",
      "PUT",
      "HEAD"
    ],
    "AllowedHeaders": [
      "Content-Type",
      "x-amz-*"
    ],
    "ExposeHeaders": [
      "ETag"
    ],
    "MaxAgeSeconds": 3600
  }
}
```

### 4. Run the Dev Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📱 App Routes

- `/dashboard`: Event Organizer Console (Create events, view counts, trigger instant reveal)
- `/[eventId]`: Guest Landing Page (Enter nickname, sets HttpOnly cookie)
- `/[eventId]/camera`: Skeuomorphic 35mm Disposable Camera UI with flash simulation & direct upload
- `/[eventId]/gallery`: Masonry Gallery (Vault locked with live countdown before reveal; unlocked after)
