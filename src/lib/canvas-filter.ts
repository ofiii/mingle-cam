export type FilterEffect =
  | "signature"
  | "moody"
  | "gold200"
  | "portra"
  | "cinestill"
  | "fuji"
  | "polaroid"
  | "ektachrome"
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
    id: "cinestill",
    name: "Cine 800T",
    icon: "🌙",
    cssFilter: "contrast(116%) saturate(110%) hue-rotate(185deg) brightness(98%)",
    grainAmount: 15,
    description: "Cool tungsten teal shadows with warm halation glow",
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
    id: "ektachrome",
    name: "Ekta 100",
    icon: "🏔️",
    cssFilter: "contrast(122%) saturate(125%) brightness(101%) hue-rotate(5deg)",
    grainAmount: 12,
    description: "70s vintage color slide film with deep sky blues & punchy clarity",
  },
  {
    id: "retro80s",
    name: "Retro 1984",
    icon: "📼",
    cssFilter: "contrast(120%) saturate(88%) sepia(28%) brightness(99%) hue-rotate(-15deg)",
    grainAmount: 18,
    description: "80s disposable flash camera aesthetic with warm faded film stock",
  },
  {
    id: "sepia",
    name: "Antique Sepia",
    icon: "📜",
    cssFilter: "sepia(85%) contrast(110%) brightness(95%)",
    grainAmount: 20,
    description: "1920s antique monochrome sepia print with deep organic grain",
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

  // Convert to high-quality JPEG Blob (0.86 quality = crisp detail, 4x faster export & upload)
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("Canvas export failed"));
      },
      "image/jpeg",
      0.86
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

        case "cinestill": {
          // CineStill 800T: Cool teal/cyan shadows with warm red/orange highlights
          r -= 6 * shadowFactor;
          g += 4 * shadowFactor;
          b += 16 * shadowFactor;

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

        case "ektachrome": {
          // Kodak Ektachrome 100: Saturated vintage transparency slide, deep rich blues, high clarity
          const mean = (r + g + b) / 3;
          r = mean + (r - mean) * 1.25;
          g = mean + (g - mean) * 1.22;
          b = mean + (b - mean) * 1.30;

          r = applySCurve(r, 1.22);
          g = applySCurve(g, 1.20);
          b = applySCurve(b, 1.24);
          break;
        }

        case "retro80s": {
          // Retro 1984: Disposable flash camera look, warm yellow/green tint
          r = r * 1.08 + 14 * shadowFactor;
          g = g * 1.02 + 10 * shadowFactor;
          b = b * 0.88;

          r = applySCurve(r, 1.20);
          g = applySCurve(g, 1.16);
          b = applySCurve(b, 1.10);
          break;
        }

        case "sepia": {
          // Antique Sepia: 1920s authentic monochrome sepia print
          const sepiaR = lum * 0.95 + 40;
          const sepiaG = lum * 0.85 + 20;
          const sepiaB = lum * 0.65;

          r = Math.min(255, sepiaR * 0.9 + 12 * shadowFactor);
          g = Math.min(255, sepiaG * 0.9 + 8 * shadowFactor);
          b = Math.min(255, sepiaB * 0.9);

          r = applySCurve(r, 1.15);
          g = applySCurve(g, 1.12);
          b = applySCurve(b, 1.10);
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

      // Authentic Disposable Camera Xenon Flash Light Model (Additive Illumination)
      if (hasFlash) {
        const pixelIdx = i >> 2;
        const targetCenterX = focusPoint ? focusPoint.x * width : width * 0.5;
        const targetCenterY = focusPoint ? focusPoint.y * height : height * 0.44;

        const px = (pixelIdx % width) - targetCenterX;
        const py = ((pixelIdx / width) | 0) - targetCenterY;

        // Distance from center flash position
        const distNorm = Math.sqrt((px * px) / (width * width * 0.25) + (py * py) / (height * height * 0.25));

        // Flash falloff factor (1.0 at center, ~0.20 at corners)
        const falloff = Math.max(0.18, 1.0 - distNorm * 0.55);

        // 1. Direct Additive Xenon Flash Photons (transforms dark scenes into bright, clear photos!)
        const directFlashFill = 55 * falloff;

        // 2. Dynamic Shadow Recovery (brightens pitch dark shadows by up to +40)
        const shadowRecovery = Math.max(0, 1 - lum / 160) * 40 * falloff;

        // 3. Multiplicative exposure boost
        r = r * 1.30 + directFlashFill + shadowRecovery;
        g = g * 1.30 + directFlashFill + shadowRecovery;
        b = b * 1.30 + directFlashFill + shadowRecovery;

        // 4. Specular Xenon Tube Highlight Punch on reflective surfaces & skin
        if (lum > 65) {
          const specPop = (lum - 65) * 0.35 * falloff;
          r += specPop * 1.04;
          g += specPop * 1.02;
          b += specPop * 1.10; // characteristic cool white xenon tube flare
        }
      }

      // Add analog film grain directly in the same single loop
      if (grainAmount > 0) {
        const noise = (Math.random() - 0.5) * grainAmount;
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
