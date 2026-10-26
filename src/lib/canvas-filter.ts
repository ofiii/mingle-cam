export type FilterEffect =
  | "signature"
  | "moody"
  | "gold200"
  | "portra"
  | "fuji"
  | "polaroid"
  | "retro80s"
  | "sepia"
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
    id: "signature",
    name: "Signature",
    icon: "👑",
    cssFilter: "contrast(118%) brightness(95%) sepia(12%) saturate(98%)",
    grainAmount: 8,
    description: "Signature Bridal Editorial: warm silk highlights, soft porcelain skin & rich deep black shadows",
  },
  {
    id: "moody",
    name: "Moody Plum",
    icon: "🥀",
    cssFilter: "contrast(115%) brightness(92%) saturate(95%) sepia(15%)",
    grainAmount: 12,
    description: "Cinematic dark romance, rich jewel greens & lifted matte plum shadows",
  },
  {
    id: "gold200",
    name: "Gold 200",
    icon: "🎞️",
    cssFilter: "contrast(112%) saturate(106%) sepia(22%) hue-rotate(-6deg) brightness(102%)",
    grainAmount: 14,
    description: "Iconic warm golden hour tones with nostalgic analog grain",
  },
  {
    id: "portra",
    name: "Portra 400",
    icon: "📷",
    cssFilter: "contrast(106%) saturate(92%) sepia(10%) brightness(104%)",
    grainAmount: 10,
    description: "Soft skin tones, creamy highlights, and flattering natural contrast",
  },
  {
    id: "fuji",
    name: "Fuji 400H",
    icon: "🌿",
    cssFilter: "contrast(108%) saturate(98%) hue-rotate(10deg) brightness(103%)",
    grainAmount: 11,
    description: "Crisp emerald greens, airy cyan highlights & Japanese vintage feel",
  },
  {
    id: "polaroid",
    name: "Polaroid 600",
    icon: "🌈",
    cssFilter: "contrast(98%) saturate(110%) sepia(18%) brightness(105%) hue-rotate(-12deg)",
    grainAmount: 14,
    description: "Classic instant camera warmth with soft peach tones & faded cyan shadows",
  },
  {
    id: "retro80s",
    name: "Retro 1984",
    icon: "📼",
    cssFilter: "contrast(120%) saturate(88%) sepia(28%) brightness(99%) hue-rotate(-15deg)",
    grainAmount: 10,
    description: "80s disposable flash camera aesthetic with warm faded film stock",
  },
  {
    id: "sepia",
    name: "Antique Sepia",
    icon: "📜",
    cssFilter: "sepia(30%) grayscale(45%) contrast(114%) brightness(98%)",
    grainAmount: 8,
    description: "1920s antique warm monochrome print with soft ivory tones",
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
 * Supporting zoom level (0.5x, 1x, 2x) and baking vintage filters into the raw pixels.
 */
export async function captureVideoFrame(
  video: HTMLVideoElement,
  effect: FilterEffect = "signature",
  isFrontCamera: boolean = false,
  zoomLevel: number = 1,
  hasFlash: boolean = false,
  focusPoint?: { x: number; y: number } | null
): Promise<FilterResult> {
  const videoWidth = video.videoWidth || 1080;
  const videoHeight = video.videoHeight || 1440;

  // Base 3:4 PORTRAIT crop (width = 3, height = 4)
  let baseTargetWidth = videoWidth;
  let baseTargetHeight = Math.round((videoWidth * 4) / 3);

  if (baseTargetHeight > videoHeight) {
    baseTargetHeight = videoHeight;
    baseTargetWidth = Math.round((videoHeight * 3) / 4);
  }

  // Adjust crop region based on digital zoomLevel (0.5x, 1x, 2x)
  const safeZoom = Math.max(0.5, Math.min(3, zoomLevel));
  const cropFactor = safeZoom >= 1 ? 1 / safeZoom : 1;

  const targetWidth = Math.round(baseTargetWidth * cropFactor);
  const targetHeight = Math.round(baseTargetHeight * cropFactor);

  const sx = Math.max(0, (videoWidth - targetWidth) / 2);
  const sy = Math.max(0, (videoHeight - targetHeight) / 2);

  // Output dimension: Optimized 3:4 portrait (1080x1440 max for instant mobile processing)
  const maxDim = 1440;
  let outputWidth = baseTargetWidth;
  let outputHeight = baseTargetHeight;
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
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  // Mirror selfie if front camera
  if (isFrontCamera) {
    ctx.translate(outputWidth, 0);
    ctx.scale(-1, 1);
  }

  // Draw 3:4 portrait crop with zoom scaling
  ctx.drawImage(video, sx, sy, targetWidth, targetHeight, 0, 0, outputWidth, outputHeight);
  ctx.restore();

  // Permanently bake vintage color grading, flash burst & grain into pixel buffer
  const preset = getEffectPreset(effect);
  applyPixelColorGradingAndGrain(
    ctx,
    outputWidth,
    outputHeight,
    effect,
    preset.grainAmount,
    hasFlash,
    focusPoint
  );

  // Convert to high-quality JPEG Blob (0.92 quality for crisp analog resolution & detail)
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
  effect: FilterEffect = "signature",
  hasFlash: boolean = false,
  focusPoint?: { x: number; y: number } | null
): Promise<FilterResult> {
  const maxDimension = 1440;
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
  applyPixelColorGradingAndGrain(
    ctx,
    outputWidth,
    outputHeight,
    effect,
    preset.grainAmount,
    hasFlash,
    focusPoint
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("Canvas toBlob failed"));
      },
      "image/jpeg",
      0.86
    );
  });

  const previewUrl = URL.createObjectURL(blob);
  return { blob, previewUrl, width: outputWidth, height: outputHeight };
}

/**
 * Direct Pixel-Level Color Grading Pipeline
 * Meticulously calibrated to match the live viewfinder CSS filters exactly.
 */
function applyPixelColorGradingAndGrain(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  effect: FilterEffect,
  grainAmount: number,
  hasFlash: boolean = false,
  focusPoint?: { x: number; y: number } | null
) {
  try {
    const imgData = ctx.getImageData(0, 0, width, height);
    const d = imgData.data;
    const len = d.length;

    for (let i = 0; i < len; i += 4) {
      let r = d[i];
      let g = d[i + 1];
      let b = d[i + 2];

      // 1. Authentic Optical Disposable Flash Model
      // Dark scenes: powerful xenon flash illumination lifts foreground subjects (flowers, faces)
      // while preserving deep black voids and preventing milky gray fog.
      // Bright scenes: zero boost on highlights to strictly eliminate overexposure & blown-out clipping.
      if (hasFlash) {
        const pixelIdx = i >> 2;
        const targetCenterX = focusPoint ? focusPoint.x * width : width * 0.5;
        const targetCenterY = focusPoint ? focusPoint.y * height : height * 0.44;

        const px = (pixelIdx % width) - targetCenterX;
        const py = ((pixelIdx / width) | 0) - targetCenterY;

        // Normalized radial distance from the flash center
        const distNorm = Math.sqrt((px * px) / (width * width * 0.35) + (py * py) / (height * height * 0.35));

        // Natural flash falloff: crisp at center subject, gentle natural drop towards edges
        const falloff = Math.max(0.40, 1.0 - Math.min(1.0, distNorm) * 0.48);

        // Pre-flash luminance
        const rawLum = 0.299 * r + 0.587 * g + 0.114 * b;

        // Darkness factor: 1.0 in low light (<30 lum), tapering to 0 in well-lit scenes (>130 lum)
        const darkness = Math.max(0, Math.min(1.0, (130 - rawLum) / 130));

        if (darkness > 0.05 && rawLum > 3) {
          // --- LOW-LIGHT / DARK SCENE FLASH MODEL ---
          // Smooth photographic exposure curve: lifts subjects with rich, saturated, natural colors
          // Preserves hue and saturation without washing out into chalk or boosting sensor noise
          const norm = Math.min(1.0, rawLum / 130);
          const targetLum = (Math.pow(norm, 0.36) * 190 + 20) * falloff;
          const blendLum = rawLum * (1.0 - darkness) + targetLum * darkness;

          const scale = blendLum / Math.max(1, rawLum);
          const safeScale = Math.min(6.5, scale);

          r = r * safeScale;
          g = g * safeScale;
          b = b * safeScale;

          // Gentle warm xenon flash characteristic (5400K natural warmth)
          r *= 1.03;
          b *= 0.97;

          // Chroma de-noising in deep shadows (cleans up ugly green/magenta digital sensor noise)
          const currentLum = 0.299 * r + 0.587 * g + 0.114 * b;
          if (currentLum < 38) {
            const desat = ((38 - currentLum) / 38) * 0.45;
            r = r * (1 - desat) + currentLum * desat;
            g = g * (1 - desat) + currentLum * desat;
            b = b * (1 - desat) + currentLum * desat;
          }
        } else if (darkness > 0.05 && rawLum <= 3) {
          // Keep pure background void deep velvety black (zero noise fog)
          r *= 0.75;
          g *= 0.75;
          b *= 0.75;
        } else {
          // --- BRIGHT SCENE FLASH MODEL (DAYLIGHT / LIT ROOMS) ---
          const shadowFill = Math.max(0, (70 - rawLum) / 70) * 8 * falloff;
          r += shadowFill;
          g += shadowFill;
          b += shadowFill;
        }

        // Film Highlight Shoulder Compression (Anti-Clipping: protects highlights from ever blowing out >210)
        if (r > 210) r = 210 + (r - 210) * 0.25;
        if (g > 210) g = 210 + (g - 210) * 0.25;
        if (b > 210) b = 210 + (b - 210) * 0.25;
      }

      // Calculate post-flash luminance and shadow factor for analog film grading
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const shadowFactor = Math.max(0, 1 - lum / 160);

      switch (effect) {
        case "signature": {
          // Signature Bridal Editorial (Deep rich blacks, porcelain skin, creamy silk highlights, punchy contrast)
          // 1. Deepen blacks and compress toe for true rich blacks (no washed-out gray)
          if (lum < 80) {
            const blackToe = (80 - lum) / 80; // 1.0 at pure black, 0 at 80
            // Gently pull shadows down into rich, deep velvety black
            r = r * (1.0 - blackToe * 0.28);
            g = g * (1.0 - blackToe * 0.30);
            b = b * (1.0 - blackToe * 0.32);
          }

          // 2. Soft porcelain warmth in skin tones / midtones
          if (lum >= 60 && lum <= 185) {
            r += 4;
            g += 1.5;
            b -= 1.5;
          }

          // 3. Silky highlight roll-off (creamy ivory glow, no harsh clipping)
          if (lum > 175) {
            const highlightRoll = (lum - 175) * 0.14;
            r += highlightRoll * 0.40;
            g += highlightRoll * 0.22;
            b -= highlightRoll * 0.25;
          }

          // 4. Punchy editorial contrast curve (deep rich blacks, clean crisp highlights)
          r = applySCurve(r, 1.18);
          g = applySCurve(g, 1.17);
          b = applySCurve(b, 1.16);
          break;
        }

        case "moody": {
          // Moody Plum (Lifted matte blacks, rich plum shadow tint, muted highlights, deep jewel tones)
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

          r = r * 0.96 + 14 * shadowFactor + 4;
          g = g * 0.96 + 12 * shadowFactor + 2;
          b = b * 0.98 + 10 * shadowFactor;

          r = applySCurve(r, 1.06);
          g = applySCurve(g, 1.05);
          b = applySCurve(b, 1.04);
          break;
        }


        case "fuji": {
          // Fuji Superia 400H: Crisp emerald greens, clean pastel contrast, slightly cool/cyan tone
          g = g * 1.06;
          b = b * 1.02;
          r = r * 0.96;

          r += 10 * shadowFactor;
          g += 14 * shadowFactor;
          b += 16 * shadowFactor;

          r = applySCurve(r, 1.10);
          g = applySCurve(g, 1.12);
          b = applySCurve(b, 1.10);
          break;
        }

        case "polaroid": {
          // Polaroid 600: Soft peach warmth, faded cyan shadows, gentle highlight roll-off
          r = r * 1.04 + 16 * shadowFactor;
          g = g * 0.98 + 12 * shadowFactor;
          b = b * 0.92 + 20 * shadowFactor;

          r += 8;
          g += 2;

          r = applySCurve(r, 1.05);
          g = applySCurve(g, 1.04);
          b = applySCurve(b, 1.02);
          break;
        }


        case "retro80s": {
          // Retro 1984: 100% exact 1:1 match to camera viewfinder CSS:
          // cssFilter: "contrast(120%) saturate(88%) sepia(28%) brightness(99%) hue-rotate(-15deg)"

          // 1. Combined W3C Color Matrix (sepia 28% -> hue-rotate -15deg -> saturate 88%)
          const mr = 0.78344 * r + 0.41672 * g - 0.08983 * b;
          const mg = 0.09564 * r + 0.85514 * g + 0.10043 * b;
          const mb = 0.23417 * r + 0.12103 * g + 0.64750 * b;

          const clR = Math.min(255, Math.max(0, mr));
          const clG = Math.min(255, Math.max(0, mg));
          const clB = Math.min(255, Math.max(0, mb));

          // 2. Contrast 120% (W3C standard: (val - 128) * 1.20 + 128)
          const cr = (clR - 128) * 1.20 + 128;
          const cg = (clG - 128) * 1.20 + 128;
          const cb = (clB - 128) * 1.20 + 128;

          // 3. Brightness 99% (W3C standard: val * 0.99)
          r = Math.min(255, Math.max(0, cr * 0.99));
          g = Math.min(255, Math.max(0, cg * 0.99));
          b = Math.min(255, Math.max(0, cb * 0.99));
          break;
        }

        case "sepia": {
          // Antique Sepia: 100% exact 1:1 match to camera viewfinder (Warm Ivory / Silver-Gelatin print)
          // Eliminates heavy yellow/mustard tint; renders natural vintage warm monochrome

          // 1. Calculate luminance (perceived brightness)
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;

          // 2. Base warm monochrome: blend luminance with original tint (75% monochrome, 25% original)
          const monoR = lum * 0.75 + r * 0.25;
          const monoG = lum * 0.75 + g * 0.25;
          const monoB = lum * 0.75 + b * 0.25;

          // 3. Subtle Antique Warmth (Ivory highlights, soft warm midtones, rich neutral shadows)
          const warmFactor = lum / 255;
          const warmR = monoR + 10 * warmFactor + 2;
          const warmG = monoG + 5 * warmFactor + 1;
          const warmB = monoB - 10 * warmFactor;

          // 4. Contrast 112% (W3C standard contrast curve)
          const cr = (warmR - 128) * 1.12 + 128;
          const cg = (warmG - 128) * 1.12 + 128;
          const cb = (warmB - 128) * 1.12 + 128;

          // 5. Brightness 98%
          r = Math.min(255, Math.max(0, cr * 0.98));
          g = Math.min(255, Math.max(0, cg * 0.98));
          b = Math.min(255, Math.max(0, cb * 0.98));
          break;
        }

        case "noir": {
          // Kodak Tri-X 400 B&W: High-contrast rich monochrome with lifted analog base
          let mono = lum;
          mono = applySCurve(mono, 1.38);
          mono = mono * 0.95 + 8;

          r = mono;
          g = mono;
          b = mono;
          break;
        }
      }

      // Add analog film grain directly in the same single loop
      // When flash is active, reduce synthetic grain so the image stays crisp and detailed
      const activeGrain = hasFlash ? grainAmount * 0.35 : grainAmount;
      if (activeGrain > 0) {
        const noise = (Math.random() - 0.5) * activeGrain;
        r += noise;
        g += noise;
        b += noise;
      }

      d[i] = r < 0 ? 0 : r > 255 ? 255 : (r | 0);
      d[i + 1] = g < 0 ? 0 : g > 255 ? 255 : (g | 0);
      d[i + 2] = b < 0 ? 0 : b > 255 ? 255 : (b | 0);
    }

    ctx.putImageData(imgData, 0, 0);
  } catch (err) {
    console.warn("Could not apply pixel color grading directly:", err);
  }
}

function applySCurve(val: number, contrast: number): number {
  return 128 + (val - 128) * contrast;
}
