/**
 * Client-side image compression.
 *
 * 기본값: 가장 긴 변 512px, JPEG 0.7 품질 (아바타용).
 * 다이어트 식단 사진처럼 나중에 갤러리에서 자세히 보는 용도는
 * maxSize 1024~1280, quality 0.72 권장.
 *
 * EXIF 회전 처리
 *   아이폰 인물/풍경 촬영 사진은 EXIF Orientation 이 적용된 raw JPEG 이라,
 *   단순 <img> 로 그리면 옆으로 누운 채 저장된다. 가능한 경우
 *   `createImageBitmap(file, { imageOrientation: 'from-image' })` 로 EXIF 를
 *   반영한 비트맵을 얻고, 실패하면 기존 <Image> 경로로 폴백한다.
 */
export async function compressImage(
  file: File,
  maxSize = 512,
  quality = 0.7,
): Promise<Blob> {
  // 1) createImageBitmap 경로 — 모던 브라우저 + iOS 16.4+ EXIF 지원
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      } as ImageBitmapOptions);
      try {
        return await drawToJpegBlob(bitmap, maxSize, quality);
      } finally {
        bitmap.close?.();
      }
    } catch {
      // 폴백 — 아래 <Image> 경로로
    }
  }

  // 2) <Image> 폴백 경로
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const { width: w, height: h } = fitWithin(
        img.naturalWidth,
        img.naturalHeight,
        maxSize,
      );

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context not available"));
        return;
      }

      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Compression failed"))),
        "image/jpeg",
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}

// ──────────────────────────────────────────────────────────────────
// helpers
// ──────────────────────────────────────────────────────────────────
function fitWithin(
  srcW: number,
  srcH: number,
  maxSize: number,
): { width: number; height: number } {
  if (srcW <= maxSize && srcH <= maxSize) return { width: srcW, height: srcH };
  if (srcW >= srcH) {
    return { width: maxSize, height: Math.round((srcH / srcW) * maxSize) };
  }
  return { width: Math.round((srcW / srcH) * maxSize), height: maxSize };
}

async function drawToJpegBlob(
  src: ImageBitmap,
  maxSize: number,
  quality: number,
): Promise<Blob> {
  const { width, height } = fitWithin(src.width, src.height, maxSize);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context not available");
  ctx.drawImage(src, 0, 0, width, height);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Compression failed"))),
      "image/jpeg",
      quality,
    );
  });
}
