export type ProcessingMode = 'denoise' | 'deblur' | 'both';

export interface ProcessingOptions {
  mode: ProcessingMode;
  denoiseStrength: number; // 0–100
  deblurStrength: number;  // 0–100
  sharpness: number;       // 0–100
  aiEnabled?: boolean;
  aiModelUrl?: string;
}

function gaussianBlurKernel(radius: number, sigma: number): number[][] {
  const size = 2 * radius + 1;
  const kernel: number[][] = [];
  let sum = 0;

  for (let y = -radius; y <= radius; y++) {
    const row: number[] = [];
    for (let x = -radius; x <= radius; x++) {
      const val = Math.exp(-(x * x + y * y) / (2 * sigma * sigma));
      row.push(val);
      sum += val;
    }
    kernel.push(row);
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      kernel[y][x] /= sum;
    }
  }

  return kernel;
}

function convolve(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  kernel: number[][]
): Uint8ClampedArray {
  const radius = Math.floor(kernel.length / 2);
  const output = new Uint8ClampedArray(data.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0;
      let weightSum = 0;

      for (let ky = -radius; ky <= radius; ky++) {
        for (let kx = -radius; kx <= radius; kx++) {
          const ny = Math.min(Math.max(y + ky, 0), height - 1);
          const nx = Math.min(Math.max(x + kx, 0), width - 1);
          const idx = (ny * width + nx) * 4;
          const w = kernel[ky + radius][kx + radius];
          r += data[idx] * w;
          g += data[idx + 1] * w;
          b += data[idx + 2] * w;
          weightSum += w;
        }
      }

      const outIdx = (y * width + x) * 4;
      output[outIdx] = r / weightSum;
      output[outIdx + 1] = g / weightSum;
      output[outIdx + 2] = b / weightSum;
      output[outIdx + 3] = data[outIdx + 3];
    }
  }

  return output;
}

function medianFilter(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number
): Uint8ClampedArray {
  const output = new Uint8ClampedArray(data.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const rs: number[] = [], gs: number[] = [], bs: number[] = [];

      for (let ky = -radius; ky <= radius; ky++) {
        for (let kx = -radius; kx <= radius; kx++) {
          const ny = Math.min(Math.max(y + ky, 0), height - 1);
          const nx = Math.min(Math.max(x + kx, 0), width - 1);
          const idx = (ny * width + nx) * 4;
          rs.push(data[idx]);
          gs.push(data[idx + 1]);
          bs.push(data[idx + 2]);
        }
      }

      rs.sort((a, b) => a - b);
      gs.sort((a, b) => a - b);
      bs.sort((a, b) => a - b);

      const mid = Math.floor(rs.length / 2);
      const outIdx = (y * width + x) * 4;
      output[outIdx] = rs[mid];
      output[outIdx + 1] = gs[mid];
      output[outIdx + 2] = bs[mid];
      output[outIdx + 3] = data[outIdx + 3];
    }
  }

  return output;
}

function unsharpMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  amount: number,
  sigma: number
): Uint8ClampedArray {
  const radius = Math.ceil(sigma * 2);
  const kernel = gaussianBlurKernel(radius, sigma);
  const blurred = convolve(data, width, height, kernel);

  const output = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const diff = data[i + c] - blurred[i + c];
      output[i + c] = Math.min(255, Math.max(0, data[i + c] + amount * diff));
    }
    output[i + 3] = data[i + 3];
  }

  return output;
}

function bilateralFilter(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
  sigmaSpatial: number,
  sigmaRange: number
): Uint8ClampedArray {
  const output = new Uint8ClampedArray(data.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ci = (y * width + x) * 4;
      let rSum = 0, gSum = 0, bSum = 0, wSum = 0;

      for (let ky = -radius; ky <= radius; ky++) {
        for (let kx = -radius; kx <= radius; kx++) {
          const ny = Math.min(Math.max(y + ky, 0), height - 1);
          const nx = Math.min(Math.max(x + kx, 0), width - 1);
          const ni = (ny * width + nx) * 4;

          const spatialDist = kx * kx + ky * ky;
          const dr = data[ci] - data[ni];
          const dg = data[ci + 1] - data[ni + 1];
          const db = data[ci + 2] - data[ni + 2];
          const rangeDist = dr * dr + dg * dg + db * db;

          const w = Math.exp(
            -spatialDist / (2 * sigmaSpatial * sigmaSpatial) -
            rangeDist / (2 * sigmaRange * sigmaRange)
          );

          rSum += data[ni] * w;
          gSum += data[ni + 1] * w;
          bSum += data[ni + 2] * w;
          wSum += w;
        }
      }

      output[ci] = rSum / wSum;
      output[ci + 1] = gSum / wSum;
      output[ci + 2] = bSum / wSum;
      output[ci + 3] = data[ci + 3];
    }
  }

  return output;
}

export async function processImage(
  imageData: ImageData,
  options: ProcessingOptions
): Promise<ImageData> {
  let pixels = new Uint8ClampedArray(imageData.data);
  const { width, height } = imageData;

  // Optional AI-based deblurring path using UpscalerJS. If AI is enabled
  // attempt to run a pretrained MAXIM deblurring model (or a custom model
  // via `options.aiModelUrl`). On any failure, fall back to the CPU pipeline.
  if ((options.mode === 'deblur' || options.mode === 'both') && options.aiEnabled) {
    try {
      const tf: any = await import('@tensorflow/tfjs');

      const UpscalerModule: any = await import('upscaler');
      const Upscaler = UpscalerModule.default ?? UpscalerModule;

      let modelObj: any;
      if (options.aiModelUrl) {
        modelObj = { path: options.aiModelUrl, modelType: 'graph' };
      } else {
        const maximMod: any = await import('@upscalerjs/maxim-deblurring');
        modelObj = maximMod.default ?? maximMod;
      }

      const upscaler = new Upscaler({ model: modelObj });

      const inputTensor = tf.browser.fromPixels(imageData);
      const outTensor = await upscaler.upscale(inputTensor, { output: 'tensor' });

      const outShape = outTensor.shape;
      const outHeight = outShape[0];
      const outWidth = outShape[1];

      const pixelsArr: Uint8ClampedArray = await tf.browser.toPixels(outTensor as any);

      if (inputTensor.dispose) inputTensor.dispose();
      if (outTensor.dispose) outTensor.dispose();

      return new ImageData(new Uint8ClampedArray(pixelsArr), outWidth, outHeight);
    } catch (err) {
      // If AI path fails, continue to classical pipeline and log warning.
      // eslint-disable-next-line no-console
      console.warn('AI deblur failed, falling back to CPU pipeline:', err);
    }
  }

  if (options.mode === 'denoise' || options.mode === 'both') {
    const strength = options.denoiseStrength / 100;

    if (strength > 0.5) {
      // Strong denoising: bilateral filter for high strength
      const radius = Math.round(1 + strength * 3);
      const sigmaS = 1 + strength * 4;
      const sigmaR = 15 + strength * 40;
      pixels = bilateralFilter(pixels, width, height, radius, sigmaS, sigmaR);
    } else if (strength > 0) {
      // Mild denoising: median filter
      const radius = strength > 0.3 ? 2 : 1;
      pixels = medianFilter(pixels, width, height, radius);
    }
  }

  if (options.mode === 'deblur' || options.mode === 'both') {
    const strength = options.deblurStrength / 100;

    if (strength > 0) {
      const amount = 0.5 + strength * 3.5;
      const sigma = 0.5 + strength * 1.5;
      pixels = unsharpMask(pixels, width, height, amount, sigma);
    }

    // Additional sharpening pass
    if (options.sharpness > 0) {
      const sharpAmount = (options.sharpness / 100) * 2;
      pixels = unsharpMask(pixels, width, height, sharpAmount, 0.8);
    }
  }

  if (options.mode === 'denoise') {
    if (options.sharpness > 0) {
      const sharpAmount = (options.sharpness / 100) * 1.5;
      pixels = unsharpMask(pixels, width, height, sharpAmount, 0.6);
    }
  }

  return new ImageData(pixels, width, height);
}

export function imageDataToCanvas(imageData: ImageData): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export function canvasToDataURL(canvas: HTMLCanvasElement, quality = 0.95): string {
  return canvas.toDataURL('image/jpeg', quality);
}
