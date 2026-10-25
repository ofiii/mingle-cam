export interface FilterResult {
  blob: Blob;
  previewUrl: string;
  width: number;
  height: number;
}

/**
 * Destructive Analog Filter Processor
 * Renders raw file onto an HTML5 Canvas, applies vintage color grading,
 * generates film grain, stamps vintage date, and returns a JPEG Blob.
 */
export async function applyAnalogFilter(
  file: File,
  options?: {
    maxDimension?: number;
    quality?: number;
    customDate?: Date;
  }
): Promise<FilterResult> {
  const maxDimension = options?.maxDimension ?? 2048; // Prevent browser OOM on high-res mobile cameras
  const quality = options?.quality ?? 0.88;
  const targetDate = options?.customDate ?? new Date();

  // 1. Decode image into ImageBitmap
  const imageBitmap = await createImageBitmap(file);

  // 2. Downscale proportionally if needed
  let { width, height } = imageBitmap;
  if (width > maxDimension || height > maxDimension) {
    if (width > height) {
      height = Math.round((height * maxDimension) / width);
      width = maxDimension;
    } else {
      width = Math.round((width * maxDimension) / height);
      height = maxDimension;
    }
  }

  // 3. Create Canvas
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  if (!ctx) {
    imageBitmap.close();
    throw new Error("Unable to obtain 2D canvas rendering context");
  }

  // 4. Apply Analog Filter Pipeline
  ctx.save();
  ctx.filter = "contrast(120%) saturate(80%) sepia(30%) hue-rotate(-10deg)";
  ctx.drawImage(imageBitmap, 0, 0, width, height);
  ctx.restore();
  imageBitmap.close();

  // 5. Apply subtle analog film grain (per-pixel noise overlay)
  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const grainAmount = 14;

    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * grainAmount;
      data[i] = Math.min(255, Math.max(0, data[i] + noise));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
    }
    ctx.putImageData(imageData, 0, 0);
  } catch {
    // If getImageData has cross-origin or buffer restrictions, proceed with filtered canvas
  }

  // 6. Draw 90s Orange Digital Quartz Date Stamp (Format: 'YY MM DD)
  drawVintageDateStamp(ctx, width, height, targetDate);

  // 7. Convert Canvas to JPEG Blob
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("Canvas toBlob conversion failed"));
      },
      "image/jpeg",
      quality
    );
  });

  const previewUrl = URL.createObjectURL(blob);
  return { blob, previewUrl, width, height };
}

/**
 * Draws vintage LED/LCD 7-segment style date stamp with an analog orange glow
 */
function drawVintageDateStamp(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  date: Date
) {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const dateStr = `'${yy} ${mm} ${dd}`;

  const fontSize = Math.max(22, Math.round(width * 0.034));
  const paddingRight = Math.round(width * 0.045);
  const paddingBottom = Math.round(height * 0.045);

  ctx.save();
  ctx.font = `700 ${fontSize}px "Courier New", monospace`;
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";

  // Orange glow effect
  ctx.shadowColor = "rgba(255, 110, 0, 0.8)";
  ctx.shadowBlur = Math.round(fontSize * 0.35);
  ctx.fillStyle = "#ff7a00";
  ctx.fillText(dateStr, width - paddingRight, height - paddingBottom);

  // Core brightness
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffb042";
  ctx.fillText(dateStr, width - paddingRight, height - paddingBottom);
  ctx.restore();
}
