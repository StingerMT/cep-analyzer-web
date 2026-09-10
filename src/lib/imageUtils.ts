/**
 * Image Utilities
 * Handles image loading, EXIF rotation correction, and file download.
 */

export interface LoadedImage {
  url: string;
  width: number;
  height: number;
  element: HTMLImageElement;
}

// ─── EXIF orientation reader ──────────────────────────────────────────────────
// Reads only the first 64 KB of the file (enough to cover any EXIF block).
// Parses the JPEG marker chain manually using DataView to find APP1 (0xFFE1),
// confirms it's EXIF (magic bytes 0x45786966 = "Exif"), then walks the IFD
// (Image File Directory) entries to find tag 0x0112 (Orientation).
// Returns orientation value 1–8, or 1 (normal) if not found / not a JPEG.
//
// Orientation values and their meaning:
//   1 = normal (no rotation)
//   2 = mirrored horizontally
//   3 = rotated 180°
//   4 = mirrored vertically
//   5 = mirrored + rotated 90° CCW
//   6 = rotated 90° CW  (most common on phones held portrait)
//   7 = mirrored + rotated 90° CW
//   8 = rotated 90° CCW
async function getExifOrientation(file: File): Promise<number> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const buf = e.target?.result as ArrayBuffer;
        const view = new DataView(buf);

        // Must start with JPEG SOI marker
        if (view.getUint16(0, false) !== 0xFFD8) { resolve(1); return; }

        let offset = 2;
        while (offset < view.byteLength - 2) {
          const marker = view.getUint16(offset, false);
          offset += 2;

          if (marker === 0xFFE1) {
            // APP1 – may contain EXIF
            const segLen = view.getUint16(offset, false);
            void segLen; // segLen is read to advance past the field but the value isn't needed
            // Check for "Exif" magic string at offset+2 (big-endian uint32 = 0x45786966)
            if (view.getUint32(offset + 2, false) !== 0x45786966) { resolve(1); return; }

            // Byte order marker: 0x4949 = little-endian ("II"), 0x4D4D = big-endian ("MM")
            const little = view.getUint16(offset + 8, false) === 0x4949;
            const ifdOffset = offset + 8 + view.getUint32(offset + 12, little);
            const entries  = view.getUint16(ifdOffset, little);

            for (let i = 0; i < entries; i++) {
              const tag = view.getUint16(ifdOffset + 2 + i * 12, little);
              if (tag === 0x0112) {
                resolve(view.getUint16(ifdOffset + 2 + i * 12 + 8, little));
                return;
              }
            }
            resolve(1);
            return;
          } else if ((marker & 0xFF00) !== 0xFF00) {
            break;
          } else {
            offset += view.getUint16(offset, false);
          }
        }
        resolve(1);
      } catch {
        resolve(1);
      }
    };

    reader.onerror = () => resolve(1);
    reader.readAsArrayBuffer(file.slice(0, 65536));
  });
}

// ─── Canvas transform for EXIF orientation ───────────────────────────────────
// Applies a 2D canvas affine transform to pre-rotate drawing so that when we
// ctx.drawImage(img, 0, 0) the result is correctly oriented.
// Each case is a ctx.transform(a,b,c,d,e,f) call that encodes the rotation/flip
// as a 2×2 matrix [a,b; c,d] plus translation [e,f].
// The canvas dimensions must be swapped (needsSwap = orientation >= 5) for 90°/270° cases.
function applyExifTransform(
  ctx: CanvasRenderingContext2D,
  orientation: number,
  w: number,
  h: number
): void {
  switch (orientation) {
    case 2: ctx.transform(-1, 0, 0,  1, w, 0); break;
    case 3: ctx.transform(-1, 0, 0, -1, w, h); break;
    case 4: ctx.transform( 1, 0, 0, -1, 0, h); break;
    case 5: ctx.transform( 0, 1, 1,  0, 0, 0); break;
    case 6: ctx.transform( 0, 1,-1,  0, h, 0); break;
    case 7: ctx.transform( 0,-1,-1,  0, h, w); break;
    case 8: ctx.transform( 0,-1, 1,  0, 0, w); break;
    default: break; // 1 = normal
  }
}

// ─── Load image element from data-URL ────────────────────────────────────────

function imgFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode image'));
    img.src = url;
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Load a File, auto-correct EXIF orientation, return a LoadedImage.
 */
export async function loadAndCorrectImage(file: File): Promise<LoadedImage> {
  // 1. Read file as data-URL
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

  // 2. Decode image
  const img = await imgFromUrl(dataUrl);
  const naturalW = img.naturalWidth;
  const naturalH = img.naturalHeight;

  // 3. Read EXIF orientation
  const orientation = await getExifOrientation(file);

  // 4. If no rotation needed, return as-is
  if (orientation <= 1) {
    return { url: dataUrl, width: naturalW, height: naturalH, element: img };
  }

  // 5. Draw onto canvas with corrected orientation.
  // needsSwap: orientations 5–8 involve a 90° or 270° rotation, which swaps width and height.
  // The canvas dimensions must reflect the output size, not the raw image size.
  const needsSwap = orientation >= 5;
  const canvas = document.createElement('canvas');
  canvas.width  = needsSwap ? naturalH : naturalW;
  canvas.height = needsSwap ? naturalW : naturalH;

  const ctx = canvas.getContext('2d')!;
  applyExifTransform(ctx, orientation, naturalW, naturalH);
  ctx.drawImage(img, 0, 0);

  const correctedUrl = canvas.toDataURL('image/jpeg', 0.95);
  const correctedImg = await imgFromUrl(correctedUrl);

  return {
    url: correctedUrl,
    width: canvas.width,
    height: canvas.height,
    element: correctedImg,
  };
}

/**
 * Trigger a file download in the browser.
 * NOTE: Currently unused in App.tsx — the app now uses triggerFileDownload() defined
 * inline inside ResultsModal, which follows the same pattern. This export is kept
 * for potential external use or future refactor.
 */
export function downloadFile(
  data: string,
  filename: string,
  mimeType = 'text/plain'
): void {
  const blob = new Blob([data], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
