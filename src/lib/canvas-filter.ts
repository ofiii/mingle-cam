export type FilterEffect = "vintage" | "noir" | "plum" | "vibrant" | "soft";

export interface EffectPreset {
  id: FilterEffect;
  name: string;
  icon: string;
  cssFilter: string;
  grainAmount: number;
}

export const EFFECT_PRESETS: EffectPreset[] = [
  {
    id: "vintage",
    name: "Classic 35mm",
    icon: "🎞️",
    cssFilter: "contrast(115%) saturate(85%) sepia(25%) hue-rotate(-8deg)",
    grainAmount: 14,
  },
  {
    id: "noir",
    name: "B&W Noir",
    icon: "🖤",
    cssFilter: "grayscale(100%) contrast(140%) brightness(95%)",
    grainAmount: 18,
  },
  {
    id: "plum",
    name: "Warm Plum",
    icon: "🍇",
    cssFilter: "contrast(112%) saturate(120%) hue-rotate(275deg) brightness(102%)",
    grainAmount: 12,
  },
  {
    id: "vibrant",
    name: "Vivid Color",
    icon: "✨",
    cssFilter: "contrast(125%) saturate(135%) brightness(104%)",
    grainAmount: 10,
  },
  {
    id: "soft",
    name: "Soft Pastel",
    icon: "🌸",
    cssFilter: "contrast(98%) saturate(85%) brightness(108%)",
    grainAmount: 8,
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
 * Capture a 4:3 frame directly from a live HTMLVideoElement and apply the chosen analog filter
 */
export async function captureVideoFrame(
  video: HTMLVideoElement,
  effect: FilterEffect = "vintage",
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

  // Cap max dimension to 2048 to prevent memory spikes
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

  const preset = getEffectPreset(effect);

  ctx.save();
  // Flip horizontally if front camera (mirror selfie mode)
  if (isFrontCamera) {
    ctx.translate(outputWidth, 0);
    ctx.scale(-1, 1);
  }

  // Apply CSS color matrix filter
  ctx.filter = preset.cssFilter;
  ctx.drawImage(video, sx, sy, targetWidth, targetHeight, 0, 0, outputWidth, outputHeight);
  ctx.restore();

  // Apply analog film grain
  applyFilmGrain(ctx, outputWidth, outputHeight, preset.grainAmount);

  // Convert to high-quality JPEG Blob (No date stamp!)
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("Canvas export failed"));
      },
      "image/jpeg",
      0.9
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
  effect: FilterEffect = "vintage"
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

  const preset = getEffectPreset(effect);

  ctx.save();
  ctx.filter = preset.cssFilter;
  ctx.drawImage(imageBitmap, 0, 0, width, height);
  ctx.restore();
  imageBitmap.close();

  // Apply subtle grain
  applyFilmGrain(ctx, width, height, preset.grainAmount);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("Canvas toBlob failed"));
      },
      "image/jpeg",
      0.9
    );
  });

  const previewUrl = URL.createObjectURL(blob);
  return { blob, previewUrl, width, height };
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
    for (let i = 0; i < data.length; i += 4) {
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
