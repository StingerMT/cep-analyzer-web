// SupportedPdfFont: the four Hebrew-capable TTF fonts shipped in /public/fonts/.
// Only these four can be used with the Hebrew PDF path — jsPDF's built-in fonts
// (helvetica, etc.) don't contain Hebrew glyphs so they would silently drop the text.
export type SupportedPdfFont = 'Rubik' | 'Heebo' | 'Assistant' | 'DavidLibre';

// AVAILABLE_FONTS: metadata registry for each font.
// `label` / `labelHe` are for a future font-picker UI in SettingsPanel (not yet wired up).
export const AVAILABLE_FONTS: Record<SupportedPdfFont, { name: string; file: string; label: string; labelHe: string }> = {
  Rubik:      { name: 'Rubik',      file: `${import.meta.env.BASE_URL}fonts/Rubik-Regular.ttf`,      label: 'Rubik (Sans-Serif)', labelHe: 'רוביק' },
  Heebo:      { name: 'Heebo',      file: `${import.meta.env.BASE_URL}fonts/Heebo-Regular.ttf`,      label: 'Heebo (Modern)',     labelHe: 'היבו' },
  Assistant:  { name: 'Assistant',  file: `${import.meta.env.BASE_URL}fonts/Assistant-Regular.ttf`,  label: 'Assistant (Clean)',  labelHe: 'אסיסטנט' },
  DavidLibre: { name: 'DavidLibre', file: `${import.meta.env.BASE_URL}fonts/DavidLibre-Regular.ttf`, label: 'David Libre (Serif)', labelHe: 'דוד ליברה' },
};

// Module-level cache: stores the base64 string for each font key after the first fetch.
// Keyed by SupportedPdfFont string (e.g. 'Rubik'). Persists across PDF generations
// within the same browser session — the font is only fetched once per page load.
const fontBase64Cache: Record<string, string> = {};

// registerPdfFont: fetches the TTF file, base64-encodes it in 8 KB chunks (to avoid
// call-stack overflow from large String.fromCharCode arrays), registers it with jsPDF's
// virtual file system (VFS), and sets it as the active font on the doc.
//
// Why chunked encoding: btoa(String.fromCharCode(...bytes)) fails for large arrays because
// Function.apply has a max argument limit. 8192-byte chunks stay safely below that limit.
//
// The `doc` parameter is typed `any` because jsPDF doesn't export a public TS interface
// for its document class in a way that works cleanly with dynamic import().
//
// Returns the font name that was activated ('Rubik', 'helvetica' on fallback, etc.)
export const registerPdfFont = async (doc: any, fontKey: SupportedPdfFont = 'Rubik'): Promise<string> => {
  const fontConfig = AVAILABLE_FONTS[fontKey] || AVAILABLE_FONTS.Rubik;
  const fontName = fontConfig.name;

  try {
    if (!fontBase64Cache[fontKey]) {
      const response = await fetch(fontConfig.file);
      if (!response.ok) {
        throw new Error(`Failed to load font asset: ${fontConfig.file} (${response.status})`);
      }

      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      // Chunked base64 encoding — avoids stack overflow on large TTF files
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
      }
      
      fontBase64Cache[fontKey] = btoa(binary);
    }

    // jsPDF VFS registration: addFileToVFS registers the raw base64 data,
    // addFont maps it to a font family name usable by setFont().
    const vfsFileName = `${fontName}-Regular.ttf`;
    doc.addFileToVFS(vfsFileName, fontBase64Cache[fontKey]);
    doc.addFont(vfsFileName, fontName, 'normal');
    doc.setFont(fontName);
    
    return fontName;
  } catch (err) {
    console.error('Offline PDF Font Registration Error:', err);
    // Graceful degradation: fall back to built-in helvetica so the PDF still generates,
    // but Hebrew characters will be dropped or garbled.
    doc.setFont('helvetica');
    return 'helvetica';
  }
};