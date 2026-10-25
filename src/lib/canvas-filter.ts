export type FilterEffect = "moody" | "vintage" | "noir" | "plum" | "vibrant" | "soft";

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
    id: "vintage",
    name: "Classic 35mm",
    icon: "🎞️",
    cssFilter: "contrast(112%) saturate(90%) sepia(25%) hue-rotate(-8deg)",
    grainAmount: 14,
    description: "Authentic warm disposable 35mm film",
  },
  {
    id: "noir",
    name: "B&W Noir",
    icon: "🖤",
    cssFilter: "grayscale(100%) contrast(135%) brightness(95%)",
    grainAmount: 16,
    description: "High-contrast monochrome with deep rich shadows",
  },
  {
    id: "plum",
    name: "Warm Plum",
    icon: "🍇",
    cssFilter: "contrast(110%) saturate(115%) hue-rotate(275deg) brightness(98%)",
    grainAmount: 12,
    description: "Atmospheric plum & violet floral undertones",
  },
  {
    id: "vibrant",
    name: "Vivid Color",
    icon: "✨",
    cssFilter: "contrast(120%) saturate(130%) brightness(102%)",
    grainAmount: 10,
    description: "Punchy 90s party color saturation",
  },
  {
    id: "soft",
    name: "Soft Pastel",
    icon: "🌸",
    cssFilter: "contrast(96%) saturate(88%) brightness(106%)",
    grainAmount: 8,
    description: "Dreamy diffused light with delicate tones",
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
 * Capture a 4:3 frame directly from a live HTMLVideoElement and bake the analog filter
 * permanently into the pixel buffer so it never disappears on mobile browsers/Safari.
 */
export async function captureVideoFrame(
  video: HTMLVideoElement,
  effect: FilterEffect = "moody",
  isFrontCamera: boolean = false
): Promise<FilterResult> {
  const videoWidth = video.videoWidth || 1280;
  const videoHeight = video.videoHeight || 960;

  // Compute 4:3 crop dimension
  let targetWidth = videoWidth;
  let targetHeight = Math.round((videoWidth * 3) / 4);

  if (targetHeight > videoHeight) {
    targetHeight = videoHeight;
    targetWidth = Math.round((videoHeight * 4) / 3);
  }

  const sx = (videoWidth - targetWidth) / 2;
  const sy = (videoHeight - targetHeight) / 2;

  // Cap max dimension to 2048 to prevent memory spikes on mobile
  const maxDim = 2048;
  let outputWidth = targetWidth;
  let outputHeight = targetHeight;
  if (outputWidth > maxDim || outputHeight > maxDim) {
    if (outputWidth > outputHeight) {
      outputHeight = Math.round((outputHeight * maxDim) / outputWidth);
      outputWidth = maxDim;
    } else {
      outputWidth = Math.round((outputWidth * maxDim) / outputHeight);
      outputHeight = maxDim;
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
  // Flip horizontally if front camera (mirror selfie mode)
  if (isFrontCamera) {
    ctx.translate(outputWidth, 0);
    ctx.scale(-1, 1);
  }

  // Draw raw video frame (clean copy)
  ctx.drawImage(video, sx, sy, targetWidth, targetHeight, 0, 0, outputWidth, outputHeight);
  ctx.restore();

  // Permanently bake the color grading & analog film grain into the raw pixel buffer
  const preset = getEffectPreset(effect);
  applyPixelColorGrading(ctx, outputWidth, outputHeight, effect);
  applyFilmGrain(ctx, outputWidth, outputHeight, preset.grainAmount);

  // Convert to high-quality JPEG Blob (No date stamp!)
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
 */
export async function applyAnalogFilter(
  file: File,
  effect: FilterEffect = "moody"
): Promise<FilterResult> {
  const maxDimension = 2048;
  const imageBitmap = await createImageBitmap(file);

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

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  if (!ctx) {
    imageBitmap.close();
    throw new Error("Unable to obtain 2D canvas context");
  }

  ctx.drawImage(imageBitmap, 0, 0, width, height);
  imageBitmap.close();

  const preset = getEffectPreset(effect);
  applyPixelColorGrading(ctx, width, height, effect);
  applyFilmGrain(ctx, width, height, preset.grainAmount);

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
  return { blob, previewUrl, width, height };
}

/**
 * Direct Pixel-Level Color Grading Pipeline
 * Works identically across all mobile platforms (including iOS Safari).
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
      const highlightFactor = Math.max(0, (lum - 120) / 135);

      switch (effect) {
        case "moody": {
          // Moody Editorial Wedding (Lifted matte blacks, rich plum shadow tint, muted highlights, deep jewel tones)
          // Lift deep blacks to a soft matte ~16-22
          r = r * 0.92 + 18 * shadowFactor;
          g = g * 0.90 + 8 * shadowFactor;
          b = b * 0.90 + 22 * shadowFactor;

          // Add subtle rich plum/burgundy undertone in midtones/shadows
          r += 10 * shadowFactor;
          b += 14 * shadowFactor;
          g -= 4 * shadowFactor;

          // Gently compress bright highlights (soft diffused light, no harsh clipping)
          if (lum > 180) {
            const compress = (lum - 180) * 0.15;
            r -= compress;
            g -= compress * 0.8;
            b -= compress * 0.6;
          }

          // Gentle S-curve contrast on midtones
          r = applySCurve(r, 1.15);
          g = applySCurve(g, 1.12);
          b = applySCurve(b, 1.15);
          break;
        }

        case "vintage": {
          // Classic 35mm warm tone, gentle sepia, slight contrast boost, lifted warm blacks
          const sepiaR = lum + 35;
          const sepiaG = lum + 15;
          const sepiaB = lum - 15;

          r = r * 0.72 + sepiaR * 0.28;
          g = g * 0.76 + sepiaG * 0.24;
          b = b * 0.78 + sepiaB * 0.22;

          // Lift shadows slightly with warm amber
          r += 12 * shadowFactor;
          g += 6 * shadowFactor;
          b += 2 * shadowFactor;

          r = applySCurve(r, 1.12);
          g = applySCurve(g, 1.10);
          b = applySCurve(b, 1.10);
          break;
        }

        case "noir": {
          // B&W Noir: Pure monochrome with high micro-contrast and deep shadows
          let mono = lum;
          mono = applySCurve(mono, 1.35);
          // Slight matte black lift for analog print feel
          mono = mono * 0.96 + 6;

          r = mono;
          g = mono;
          b = mono;
          break;
        }

        case "plum": {
          // Warm Plum: Rich violet & plum cast
          r = r * 1.05 + 14 * shadowFactor;
          g = g * 0.92;
          b = b * 1.12 + 18 * shadowFactor;

          r = applySCurve(r, 1.14);
          g = applySCurve(g, 1.08);
          b = applySCurve(b, 1.14);
          break;
        }

        case "vibrant": {
          // Vivid Color: 90s disposable saturated look
          const mean = (r + g + b) / 3;
          r = mean + (r - mean) * 1.32;
          g = mean + (g - mean) * 1.30;
          b = mean + (b - mean) * 1.28;

          r = applySCurve(r, 1.18);
          g = applySCurve(g, 1.18);
          b = applySCurve(b, 1.18);
          break;
        }

        case "soft": {
          // Soft Pastel: Dreamy, lowered contrast, airy highlights
          r = r * 0.94 + 20;
          g = g * 0.94 + 20;
          b = b * 0.95 + 24;

          // Soft highlight bloom
          r += 10 * highlightFactor;
          g += 8 * highlightFactor;
          b += 12 * highlightFactor;
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

/**
 * Fast S-curve contrast formula around mid-tone 128
 */
function applySCurve(val: number, contrast: number): number {
  return 128 + (val - 128) * contrast;
}

/**
 * Apply per-pixel analog film grain noise
 */
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
    // Graceful fallback if cross-origin buffer security forbids reading
  }
}
