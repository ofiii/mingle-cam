export type FilterEffect =
  | "moody"
  | "gold200"
  | "portra"
  | "cinestill"
  | "fuji"
  | "noir";

export interface EffectPreset {
  id: FilterEffect;
  name: string;
  icon: string;
  cssFilter: string;
  grainAmount: number;
  description: string;
}

export const EFFECT_PRESETS: EffectPreset[] = [
  {
    id: "moody",
    name: "Moody Plum",
    icon: "🥀",
    cssFilter: "contrast(115%) brightness(92%) saturate(95%) sepia(15%)",
    grainAmount: 12,
    description: "Cinematic, rich jewel tones, soft highlights & lifted matte shadows",
  },
  {
    id: "gold200",
    name: "Gold 200",
    icon: "🎞️",
    cssFilter: "contrast(112%) saturate(105%) sepia(22%) hue-rotate(-6deg) brightness(102%)",
    grainAmount: 14,
    description: "Iconic warm golden hour tones with nostalgic analog grain",
  },
  {
    id: "portra",
    name: "Portra 400",
    icon: "📷",
    cssFilter: "contrast(106%) saturate(92%) sepia(10%) brightness(104%)",
    grainAmount: 10,
    description: "Soft skin tones, gentle contrast, and creamy highlights",
  },
  {
    id: "cinestill",
    name: "Cine 800T",
    icon: "🌙",
    cssFilter: "contrast(116%) saturate(110%) hue-rotate(185deg) brightness(98%)",
    grainAmount: 15,
    description: "Cool tungsten shadows, cinematic halation & vintage night mood",
  },
  {
    id: "fuji",
    name: "Fuji 400H",
    icon: "🌿",
    cssFilter: "contrast(108%) saturate(98%) hue-rotate(10deg) brightness(103%)",
    grainAmount: 11,
    description: "Crisp emerald greens, airy cyan highlights & Japanese analog feel",
  },
  {
    id: "noir",
    name: "Tri-X 400",
    icon: "🖤",
    cssFilter: "grayscale(100%) contrast(140%) brightness(94%)",
    grainAmount: 18,
    description: "Timeless high-contrast black & white documentary film",
  },
];

export function getEffectPreset(id: FilterEffect): EffectPreset {
  return EFFECT_PRESETS.find((p) => p.id === id) || EFFECT_PRESETS[0];
}

export interface FilterResult {
  blob: Blob;
  previewUrl: string;
  width: number;
  height: number;
}

/**
 * Capture a 3:4 PORTRAIT frame (4:3 portrait) directly from HTMLVideoElement
 * and bake the vintage analog filter permanently into the raw pixel buffer.
 */
export async function captureVideoFrame(
  video: HTMLVideoElement,
  effect: FilterEffect = "moody",
  isFrontCamera: boolean = false
): Promise<FilterResult> {
  const videoWidth = video.videoWidth || 1080;
  const videoHeight = video.videoHeight || 1440;

  // Compute 3:4 PORTRAIT crop (width = 3, height = 4)
  let targetWidth = videoWidth;
  let targetHeight = Math.round((videoWidth * 4) / 3);

  if (targetHeight > videoHeight) {
    targetHeight = videoHeight;
    targetWidth = Math.round((videoHeight * 3) / 4);
  }

  const sx = (videoWidth - targetWidth) / 2;
  const sy = (videoHeight - targetHeight) / 2;

  // Max dimension 2048 to prevent memory spikes on mobile
  const maxDim = 2048;
  let outputWidth = targetWidth;
  let outputHeight = targetHeight;
  if (outputWidth > maxDim || outputHeight > maxDim) {
    if (outputHeight > outputWidth) {
      outputWidth = Math.round((outputWidth * maxDim) / outputHeight);
      outputHeight = maxDim;
    } else {
      outputHeight = Math.round((outputHeight * maxDim) / outputWidth);
      outputWidth = maxDim;
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  if (!ctx) {
    throw new Error("Unable to obtain 2D canvas context");
  }

  ctx.save();
  // Mirror selfie if front camera
  if (isFrontCamera) {
    ctx.translate(outputWidth, 0);
    ctx.scale(-1, 1);
  }

  // Draw 3:4 portrait frame
  ctx.drawImage(video, sx, sy, targetWidth, targetHeight, 0, 0, outputWidth, outputHeight);
  ctx.restore();

  // Permanently bake vintage color grading & grain into pixel buffer
  const preset = getEffectPreset(effect);
  applyPixelColorGrading(ctx, outputWidth, outputHeight, effect);
  applyFilmGrain(ctx, outputWidth, outputHeight, preset.grainAmount);

  // Convert to high-quality JPEG Blob
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("Canvas export failed"));
      },
      "image/jpeg",
      0.92
    );
  });

  const previewUrl = URL.createObjectURL(blob);
  return { blob, previewUrl, width: outputWidth, height: outputHeight };
}

/**
 * Destructive Analog Filter Processor for raw Files (fallback mode)
 * Also crops / standardizes to 3:4 portrait.
 */
export async function applyAnalogFilter(
  file: File,
  effect: FilterEffect = "moody"
): Promise<FilterResult> {
  const maxDimension = 2048;
  const imageBitmap = await createImageBitmap(file);

  const origWidth = imageBitmap.width;
  const origHeight = imageBitmap.height;

  // Compute 3:4 crop
  let targetWidth = origWidth;
  let targetHeight = Math.round((origWidth * 4) / 3);

  if (targetHeight > origHeight) {
    targetHeight = origHeight;
    targetWidth = Math.round((origHeight * 3) / 4);
  }

  const sx = (origWidth - targetWidth) / 2;
  const sy = (origHeight - targetHeight) / 2;

  let outputWidth = targetWidth;
  let outputHeight = targetHeight;
  if (outputWidth > maxDimension || outputHeight > maxDimension) {
    if (outputHeight > outputWidth) {
      outputWidth = Math.round((outputWidth * maxDimension) / outputHeight);
      outputHeight = maxDimension;
    } else {
      outputHeight = Math.round((outputHeight * maxDimension) / outputWidth);
      outputWidth = maxDimension;
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  if (!ctx) {
    imageBitmap.close();
    throw new Error("Unable to obtain 2D canvas context");
  }

  ctx.drawImage(imageBitmap, sx, sy, targetWidth, targetHeight, 0, 0, outputWidth, outputHeight);
  imageBitmap.close();

  const preset = getEffectPreset(effect);
  applyPixelColorGrading(ctx, outputWidth, outputHeight, effect);
  applyFilmGrain(ctx, outputWidth, outputHeight, preset.grainAmount);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("Canvas toBlob failed"));
      },
      "image/jpeg",
      0.92
    );
  });

  const previewUrl = URL.createObjectURL(blob);
  return { blob, previewUrl, width: outputWidth, height: outputHeight };
}

/**
 * Direct Pixel-Level Color Grading for Vintage Film Presets
 */
function applyPixelColorGrading(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  effect: FilterEffect
) {
  try {
    const imgData = ctx.getImageData(0, 0, width, height);
    const d = imgData.data;
    const len = d.length;

    for (let i = 0; i < len; i += 4) {
      let r = d[i];
      let g = d[i + 1];
      let b = d[i + 2];

      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const shadowFactor = Math.max(0, 1 - lum / 160);

      switch (effect) {
        case "moody": {
          // Moody Editorial Wedding (Lifted matte blacks, rich plum shadow tint, muted highlights, deep jewel tones)
          r = r * 0.92 + 18 * shadowFactor;
          g = g * 0.90 + 8 * shadowFactor;
          b = b * 0.90 + 22 * shadowFactor;

          r += 10 * shadowFactor;
          b += 14 * shadowFactor;
          g -= 4 * shadowFactor;

          if (lum > 180) {
            const compress = (lum - 180) * 0.15;
            r -= compress;
            g -= compress * 0.8;
            b -= compress * 0.6;
          }

          r = applySCurve(r, 1.15);
          g = applySCurve(g, 1.12);
          b = applySCurve(b, 1.15);
          break;
        }

        case "gold200": {
          // Kodak Gold 200: Warm golden hour, rich amber mids, warm shadows, slight saturation
          const mean = (r + g + b) / 3;
          r = mean + (r - mean) * 1.08;
          g = mean + (g - mean) * 1.04;
          b = mean + (b - mean) * 0.96;

          // Warm golden tint
          r += 14 * shadowFactor + 4;
          g += 8 * shadowFactor + 2;
          b -= 4;

          r = applySCurve(r, 1.14);
          g = applySCurve(g, 1.10);
          b = applySCurve(b, 1.08);
          break;
        }

        case "portra": {
          // Kodak Portra 400: Flattering soft skin tones, creamy highlights, gentle contrast
          const mean = (r + g + b) / 3;
          r = mean + (r - mean) * 0.96;
          g = mean + (g - mean) * 0.94;
          b = mean + (b - mean) * 0.90;

          // Creamy warm highlight & lifted pastel shadows
          r = r * 0.96 + 14 * shadowFactor + 4;
          g = g * 0.96 + 12 * shadowFactor + 2;
          b = b * 0.98 + 10 * shadowFactor;

          r = applySCurve(r, 1.06);
          g = applySCurve(g, 1.05);
          b = applySCurve(b, 1.04);
          break;
        }

        case "cinestill": {
          // CineStill 800T: Cool teal/cyan shadows with warm red/orange highlights (halated vintage look)
          // Teal shadows
          r -= 6 * shadowFactor;
          g += 4 * shadowFactor;
          b += 16 * shadowFactor;

          // Warm halation in brighter areas
          if (lum > 140) {
            const glow = (lum - 140) * 0.12;
            r += glow * 1.4;
            g += glow * 0.6;
          }

          r = applySCurve(r, 1.16);
          g = applySCurve(g, 1.12);
          b = applySCurve(b, 1.18);
          break;
        }

        case "fuji": {
          // Fuji Superia 400H: Crisp emerald greens, clean pastel contrast, slightly cool/cyan tone
          // Crisp green boost
          g = g * 1.06;
          b = b * 1.02;
          r = r * 0.96;

          // Lifted shadows with faint cyan
          r += 10 * shadowFactor;
          g += 14 * shadowFactor;
          b += 16 * shadowFactor;

          r = applySCurve(r, 1.10);
          g = applySCurve(g, 1.12);
          b = applySCurve(b, 1.10);
          break;
        }

        case "noir": {
          // Kodak Tri-X 400 B&W: High-contrast rich monochrome with lifted analog base
          let mono = lum;
          mono = applySCurve(mono, 1.38);
          mono = mono * 0.95 + 8; // subtle matte black lift

          r = mono;
          g = mono;
          b = mono;
          break;
        }
      }

      d[i] = Math.min(255, Math.max(0, Math.round(r)));
      d[i + 1] = Math.min(255, Math.max(0, Math.round(g)));
      d[i + 2] = Math.min(255, Math.max(0, Math.round(b)));
    }

    ctx.putImageData(imgData, 0, 0);
  } catch (err) {
    console.warn("Could not apply pixel color grading directly:", err);
  }
}

function applySCurve(val: number, contrast: number): number {
  return 128 + (val - 128) * contrast;
}

function applyFilmGrain(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  amount: number
) {
  if (amount <= 0) return;
  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const len = data.length;

    for (let i = 0; i < len; i += 4) {
      const noise = (Math.random() - 0.5) * amount;
      data[i] = Math.min(255, Math.max(0, data[i] + noise));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
    }
    ctx.putImageData(imageData, 0, 0);
  } catch {
    // Graceful fallback
  }
}
