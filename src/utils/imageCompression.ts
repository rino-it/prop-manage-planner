export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxSizeMB?: number;
}

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  maxWidth: 1920,
  maxHeight: 1080,
  quality: 0.8,
  maxSizeMB: 2,
};

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function isImageFile(file: File): boolean {
  return ALLOWED_MIME_TYPES.has(file.type);
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const kilobytes = 1024;
  const megabytes = kilobytes * 1024;

  if (bytes >= megabytes) {
    return `${(bytes / megabytes).toFixed(1)} MB`;
  }

  if (bytes >= kilobytes) {
    return `${(bytes / kilobytes).toFixed(0)} KB`;
  }

  return `${bytes} B`;
}

async function fileToCanvas(file: File): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();

      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        resolve(canvas);
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      const result = event.target?.result;
      if (typeof result !== 'string') {
        reject(new Error('Failed to read file'));
        return;
      }

      img.src = result;
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsDataURL(file);
  });
}

function resizeCanvas(
  canvas: HTMLCanvasElement,
  maxWidth: number,
  maxHeight: number
): HTMLCanvasElement {
  const { width, height } = canvas;

  if (width <= maxWidth && height <= maxHeight) {
    return canvas;
  }

  const ratio = Math.min(maxWidth / width, maxHeight / height);
  const newWidth = Math.round(width * ratio);
  const newHeight = Math.round(height * ratio);

  const resized = document.createElement('canvas');
  resized.width = newWidth;
  resized.height = newHeight;

  const ctx = resized.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  ctx.drawImage(canvas, 0, 0, newWidth, newHeight);
  return resized;
}

async function canvasToFile(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number,
  originalName: string
): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to compress image'));
          return;
        }

        const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType.split('/')[1];
        const baseName = originalName.replace(/\.[^/.]+$/, '');
        const fileName = `${baseName}.${extension}`;

        const file = new File([blob], fileName, { type: mimeType });
        resolve(file);
      },
      mimeType,
      quality
    );
  });
}

function selectOutputMimeType(
  originalMimeType: string,
  fileSizeBytes: number
): string {
  if (originalMimeType === 'image/png') {
    const megabyte = 1024 * 1024;
    return fileSizeBytes > megabyte ? 'image/jpeg' : 'image/png';
  }

  return originalMimeType;
}

export async function compressImage(
  file: File,
  options?: CompressionOptions
): Promise<File> {
  if (!isImageFile(file)) {
    throw new Error(`Unsupported file type: ${file.type}`);
  }

  const opts = { ...DEFAULT_OPTIONS, ...options };
  const maxSizeBytes = opts.maxSizeMB * 1024 * 1024;

  if (file.size <= maxSizeBytes) {
    return file;
  }

  const canvas = await fileToCanvas(file);
  const resized = resizeCanvas(canvas, opts.maxWidth, opts.maxHeight);
  const outputMimeType = selectOutputMimeType(file.type, file.size);

  const compressed = await canvasToFile(
    resized,
    outputMimeType,
    opts.quality,
    file.name
  );

  if (compressed.size > maxSizeBytes) {
    const reducedQuality = Math.max(opts.quality * 0.7, 0.5);
    return canvasToFile(resized, outputMimeType, reducedQuality, file.name);
  }

  return compressed;
}

export async function compressImageBatch(
  files: File[],
  options?: CompressionOptions
): Promise<File[]> {
  const results: File[] = [];

  for (const file of files) {
    try {
      const compressed = await compressImage(file, options);
      results.push(compressed);
    } catch (error) {
      throw new Error(
        `Failed to compress ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  return results;
}
