/**
 * Advanced Client-side Background Removal (누끼따기)
 * Supports:
 * 1. Stamp / Seal / Signature Mode (도장/직인/서명 투명화)
 * 2. Solid & Sampled Background Removal (스포이드/허용치 배경 제거)
 * 3. Contrast & Edge Refinement
 */

export interface StampRemovalOptions {
  inkType: 'red_stamp' | 'dark_signature' | 'custom_color';
  redSensitivity: number; // 0 to 100
  paperThreshold: number; // 0 to 255 (brightness of paper to remove)
  preserveInkStrength: number; // 0.5 to 2.0
  smoothEdges: boolean;
}

export interface GeneralRemovalOptions {
  targetRgb: [number, number, number]; // sampled color
  tolerance: number; // 0 to 100
  feather: number; // 0 to 20
  invert: boolean;
}

export const bgRemoval = {
  /**
   * Process an image element and return a transparent PNG Data URL
   */
  processStampSeal(
    img: HTMLImageElement,
    options: StampRemovalOptions
  ): string {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return '';

    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    const { inkType, redSensitivity, paperThreshold, preserveInkStrength } = options;
    const sensFactor = redSensitivity / 50; // default 1.0

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

      if (inkType === 'red_stamp') {
        // Red stamp algorithm:
        // Red ink has high R and significantly lower G and B: (R - (G + B)/2) is positive.
        const redDominance = r - (g + b) / 2;
        const normalizedDominance = redDominance * sensFactor;

        if (normalizedDominance > 18) {
          // Definitely red ink!
          // Calculate opacity based on dominance and darkness of the ink
          const alpha = Math.min(255, Math.max(0, (normalizedDominance / 80) * 255 + 50));
          data[i + 3] = alpha;

          // Boost red color slightly for crisp stamping
          data[i] = Math.min(255, Math.round(r * preserveInkStrength));
          data[i + 1] = Math.round(g * 0.85);
          data[i + 2] = Math.round(b * 0.85);
        } else if (brightness > paperThreshold - 30) {
          // Off-white / white paper / shadow background -> make fully transparent
          data[i + 3] = 0;
        } else {
          // Transition / anti-aliasing
          const fade = Math.max(0, 1 - (brightness - (paperThreshold - 60)) / 60);
          data[i + 3] = Math.round(fade * 120);
        }
      } else if (inkType === 'dark_signature') {
        // Dark signature / Blue or Black ink on white paper
        const isBlueInk = b > r + 15 && b > g + 10;
        if (isBlueInk) {
          // Blue pen signature
          data[i + 3] = Math.min(255, Math.max(0, (b - (r + g) / 2) * 3 + 120));
        } else {
          // Black/dark ink signature: pixels darker than paperThreshold are kept
          if (brightness < paperThreshold) {
            const darkness = (paperThreshold - brightness) / paperThreshold;
            data[i + 3] = Math.min(255, Math.round(darkness * 255 * preserveInkStrength));
            // Enhance contrast
            data[i] = Math.max(0, r - 30);
            data[i + 1] = Math.max(0, g - 30);
            data[i + 2] = Math.max(0, b - 30);
          } else {
            data[i + 3] = 0;
          }
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
  },

  /**
   * General background removal with eyedropper color sampling, tolerance and feathering
   */
  processGeneralBackground(
    img: HTMLImageElement,
    options: GeneralRemovalOptions
  ): string {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return '';

    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    const [tr, tg, tb] = options.targetRgb;
    const maxDistance = 441.67; // Math.sqrt(255^2 * 3)
    const thresholdDist = (options.tolerance / 100) * maxDistance;
    const featherDist = (options.feather / 100) * maxDistance;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Euclidean color distance
      const dist = Math.sqrt((r - tr) ** 2 + (g - tg) ** 2 + (b - tb) ** 2);

      if (dist <= thresholdDist) {
        data[i + 3] = options.invert ? 255 : 0;
      } else if (dist <= thresholdDist + featherDist && featherDist > 0) {
        const ratio = (dist - thresholdDist) / featherDist;
        data[i + 3] = Math.round(options.invert ? (1 - ratio) * 255 : ratio * 255);
      } else {
        data[i + 3] = options.invert ? 0 : 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
  },

  /**
   * Sample pixel color at (x, y)
   */
  getPixelColorAt(img: HTMLImageElement, x: number, y: number): [number, number, number] {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return [255, 255, 255];

    ctx.drawImage(img, 0, 0);
    const pixel = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
    return [pixel[0], pixel[1], pixel[2]];
  },
};
