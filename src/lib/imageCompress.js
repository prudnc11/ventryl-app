/**
 * Compress an image file before upload.
 * Returns the original file unchanged if it's not an image or already small.
 * Target: max 1200px wide, 80% JPEG quality, under 500KB.
 */
export function compressImage(file, { maxWidth = 1200, quality = 0.8, maxSizeKB = 500 } = {}) {
  return new Promise((resolve) => {
    // Skip non-images or already small files
    if (!file.type.startsWith('image/') || file.size <= maxSizeKB * 1024) {
      resolve(file);
      return;
    }

    // Skip SVGs and GIFs (can't canvas-compress)
    if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
      resolve(file);
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let w = img.width;
      let h = img.height;

      // Scale down if wider than maxWidth
      if (w > maxWidth) {
        h = Math.round(h * (maxWidth / w));
        w = maxWidth;
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            // Compression didn't help, use original
            resolve(file);
            return;
          }
          // Create a new File with the same name
          const compressed = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(compressed);
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file); // fallback to original
    };

    img.src = url;
  });
}
