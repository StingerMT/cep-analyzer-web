# CEP Analyzer Web — Developer Log

**Last Updated:** 2026-08-24  
**Maintained by:** Benji Abramovitz

---

## Project Overview

A single-page React/TypeScript web app for ballistic dispersion analysis (CEP — Circular Error Probable).
The user loads a target photo, sets a scale reference, places an origin point and shot markers, then gets a
full suite of ballistic metrics with visual plot, PDF report, and export options (XLSX, CSV, PNG).

**Tech stack:** React 19 · TypeScript 6 · Vite 8 · jsPDF 4 · xlsx 0.18.5 · Canvas API · Web Share API  
**Build:** `npm run build` (tsc + vite)  
**Dev server:** `npm run dev` (HTTPS via mkcert, LAN-accessible for mobile testing)  
**Deploy:** Static build, `base: './'` — works from file://, USB stick, or GitHub Pages  

---

## File Map

```
cep_analyzer_web/
├── public/
│   ├── assets/          40+ SVG icon files (action buttons, cursors, workflow icons)
│   ├── fonts/           Rubik, Heebo, Assistant, DavidLibre (.ttf) — used by jsPDF
│   ├── locales/
│   │   ├── en.json      English UI strings
│   │   └── he.json      Hebrew UI strings (RTL)
│   ├── favicon.svg
│   ├── icons.svg
│   └── manifest.json    PWA manifest
├── src/
│   ├── components/
│   │   ├── CameraModal.tsx   Full-screen camera capture with flip, retake, save-to-downloads
│   │   └── Ico.tsx           SVG icon renderer (wraps <img>, applies invert filter for dark theme)
│   ├── lib/
│   │   ├── cepAnalysis.ts    CEP math engine + exportToCSV + exportToXLSX + calculateMrad
│   │   ├── exportUtils.ts    Legacy XLSX exporter (direct download, largely superseded)
│   │   ├── i18n.ts           Minimal i18n hook (en/he, localStorage persistence, RTL toggle)
│   │   ├── icons.ts          ICONS const map (IconKey type, central swap point for all icons)
│   │   ├── imageUtils.ts     EXIF orientation correction, loadAndCorrectImage, downloadFile
│   │   └── pdfFontLoader.ts  Async TTF→base64 loader + jsPDF VFS registration, 4 font options
│   ├── types/
│   │   └── index.ts          Legacy type stubs (mostly superseded by inline types in App.tsx)
│   ├── App.tsx               ~2800-line monolith: all UI, state, PDF engine, ResultsModal, etc.
│   ├── App.css               Minimal global overrides
│   ├── index.css             Base CSS reset
│   └── main.tsx              React root mount + global error/rejection overlay handlers
```

---

## Architecture Notes

### State Machine (App.tsx)
The workflow is driven by a `step` state variable:

```
'idle' → 'rotate' → 'scale' → 'origin' → 'shots' → 'results'
```

- **idle:** No image loaded. Shows load/camera buttons.
- **rotate:** Image loaded. Slider + step buttons to correct rotation.
- **scale:** User places 2 reference points on a known distance; triggers `ScaleDistanceDialog`.
- **origin:** User taps the point of aim (0,0 of the coordinate system).
- **shots:** User taps each bullet hole. Minimum 3. Right-click removes a point.
- **results:** `computeMetrics()` called → `setMetrics()` → `ResultsModal` opens.

Navigation: sidebar step icons allow going *back* to any completed step (forward is blocked).
`goToStep()` clears downstream data when reversing (e.g. going back to scale clears origin and shots).

### Canvas Pipeline
- Canvas element is sized to full image resolution (sharp at any zoom).
- CSS `width/height` = `displaySize * zoom` — zoom is a pure CSS scaling layer.
- `transform: translate(panX, panY)` handles pan via MMB drag (desktop) or single-finger swipe (mobile).
- `draw()` callback redraws everything: image → scale line → origin crosshair → shot dots → loupe.
- `toCanvas(p)` converts image pixel coordinates to canvas coordinates using a fitted-scale transform.

### Touch & Interaction
- **Single finger on canvas (placing step):** Shows magnifying glass loupe. Lifts to drop point.
- **Single finger (not on canvas):** Pans the view.
- **Two fingers:** Pinch zoom + simultaneous pan via midpoint tracking.
- **Middle mouse button:** Pan on desktop.
- **Ctrl+scroll:** Zoom on desktop.
- **Right-click / long-press:** Remove nearest shot or origin point.
- `blockNextClick` and `ignoreCurrentTouch` refs prevent ghost click events after touch interactions.

---

## Key Components

### `generateDataPdfReport()` (App.tsx, exported)
Async jsPDF report generator. As of the latest update:

- **`loadImage()` utility:** Safe async image loader with 3s timeout guard, proper event cleanup,
  and synchronous `img.complete` short-circuit for already-cached data URLs.
- **Dynamic MIME detection:** Parses `data:image/(png|jpeg|jpg|webp)` from base64 header to pass
  correct format string to `doc.addImage()` — prevents jsPDF crashes on non-JPEG assets.
- **Hero SVG fallback:** SVG icon rendered via Canvas; falls back to native `doc.circle()` on error.
- **Hebrew RTL (`fixHebrewRTL`):** Strips bracketed LTR tokens, prepends them on left, reverses
  remaining Hebrew strings character-by-character for jsPDF's LTR rendering engine.
- **Font registration:** Delegates to `registerPdfFont(doc, selectedFont)` in `pdfFontLoader.ts`.
- **Page 2:** Optional target photo page, auto-sized to image aspect ratio.

### `ResultsModal` (App.tsx)
Modal overlay showing metrics grid, CEP plot, and export/share actions.

**State management (post-refactor):**
- **`useEffect` #1 (PDF pre-generator):** Fires when `activePopup === 'share'` AND assets are ready.
  - Removed the aggressive `isMounted = false` cancellation that caused permanent spinner locks.
  - `loadedImageError` state ensures a failed target photo fetch doesn't block PDF generation.
- **`useEffect` #2 (asset fetcher):** Runs on `activePopup` open — generates PNG blob from SVG,
  fetches target image blob, generates CSV/XLSX blobs. Separated from PDF compilation to avoid
  reference loops and state churn.
- **`useEffect` #3 (cache reset):** Clears PDF/error state when `distanceInput`, `metrics.numPoints`,
  or `unifiedImageSrc` changes.
- **`isPdfBundleActive`:** True when both images AND csv are selected — triggers auto-PDF-bundle hint
  and bundles everything into a single PDF for the share payload.

**Export/Share:**
- **Download popup:** Checkboxes for XLSX, PNG plot, CSV. `executeBatchDownload()` dispatches all.
- **Share popup:** Checkboxes for target photo, PNG plot, CSV. Smart share logic:
  - Images+CSV selected → bundles into PDF via `generateDataPdfReport()`.
  - Images only → shares PNG + target photo as files.
  - CSV only → shares raw CSV.
  - Uses `navigator.share({ files })` Web Share API Level 2.

### `CEPPlot` (App.tsx)
Pure SVG component — no external charting library.
- Dynamic legend: only shows items that are toggled on.
- RTL-aware legend positioning (mirrors to right side for Hebrew).
- All layer visibility controlled by props from Settings panel.
- ID `cep-functional-svg` allows `generatePngBlob()` to clone it for 2000×2000 PNG export.

### `SettingsPanel` (App.tsx)
- Two-column layout on desktop, single column on mobile.
- Live preview SVG canvas that reflects all visual setting changes in real time.
- "Plot Layer Customization" sub-panel (animated slide-in) with toggles for each plot layer.
- Sliders for dot size and line width, color pickers for shot/origin/scale colors.
- Language switch (en ↔ he) with immediate RTL/LTR document dir update.

### `CameraModal` (components/CameraModal.tsx)
- Uses `getUserMedia` with `facingMode: environment` (back camera default).
- Camera flip button toggles `facingMode: user`.
- Capture → freeze preview → "Use Photo" downloads JPEG to device AND passes `File` to `onCapture`.
- Handles AbortError from React StrictMode double-invocation gracefully.

---

## Library Notes

### `cepAnalysis.ts`
- `computeMetrics()`: CEP50 = median radius from mean. Blocking radius = max radius. ES = max pairwise dist.
- Y-axis is flipped to match ballistic convention (up = positive).
- `exportToCSV()` / `exportToXLSX()`: Both return a `Blob` (not a direct download trigger).
  Sections: raw coordinates → spacer → summary metrics → spacer → mrad conversions.
- `calculateMrad()`: exported helper. Used in App for on-demand mrad display.
- **Note:** `exportUtils.ts` contains an older, direct-download version of XLSX export and is largely
  superseded. Not currently imported by App.tsx.

### `pdfFontLoader.ts`
- Fetches TTF from `/public/fonts/`, converts to base64 in chunks of 8192 bytes.
- Caches result in module-level `fontBase64Cache` — only one network fetch per font per session.
- Falls back to `helvetica` on any fetch/parse error.
- Four fonts available: Rubik (default), Heebo, Assistant, DavidLibre.

### `imageUtils.ts`
- `loadAndCorrectImage()`: Reads EXIF orientation tag from raw JPEG bytes, applies canvas transform,
  returns corrected data URL + HTMLImageElement.
- Returns image as-is (no re-encode) if orientation is normal (≤ 1).

### `i18n.ts`
- Language stored in `localStorage` under key `cep_lang`.
- Sets `document.documentElement.dir` and `lang` attribute on language change.
- `t(key, vars)` resolves dot-notation keys and interpolates `{varName}` placeholders.

---

## Known Issues / Tech Debt

| Issue | Severity | Notes |
|-------|----------|-------|
| `App.tsx` is ~2800 lines | Medium | Should be split into separate component files. ResultsModal, CEPPlot, SettingsPanel, ScaleDistanceDialog are all candidates for extraction. |
| Duplicate `useEffect` for asset fetching | ~~Low~~ | ✅ Resolved — duplicate removed. Single effect with `.ok` check and `loadedImageError` remains. |
| `exportUtils.ts` is orphaned | Low | Old direct-download XLSX exporter, not imported anywhere. Can be deleted or kept as reference. |
| `types/index.ts` partially stale | Low | `WorkflowStep` enum and some interfaces are unused — App uses its own inline types. |
| `CEP_THEME` vs `C` constants | Low | Two separate design token objects exist in App.tsx. `CEP_THEME` is used in ResultsModal, `C` everywhere else. Could be unified. |
| No PDF font selector exposed to user | Low | `registerPdfFont` supports 4 fonts but `generateDataPdfReport` is always called with the default `'Rubik'`. Font picker UI exists in pdfFontLoader types but isn't wired to Settings. |
| `mkcert` required for HTTPS in dev | Info | Camera API requires HTTPS. `vite-plugin-mkcert` handles this locally. GitHub Pages deployment provides HTTPS natively. |
| `vite.config.ts` `base: './'` | Info | Means all asset paths are relative. Correct for file:// and GitHub Pages, but subpath deployments need adjustment. |

---

## Recent Changes (as of 2026-08-24)

Based on the summary provided at session start:

### PDF Generator Engine (`generateDataPdfReport`)
- Replaced raw `onload` promises with dedicated `loadImage()` utility (3s timeout, proper cleanup, sync short-circuit for cached base64 strings).
- Added `data:image/(png|jpeg|jpg|webp)` regex to auto-detect base64 MIME type instead of hardcoded `'JPEG'` in `doc.addImage()`.
- Hero SVG→Canvas rendering wrapped in try/catch with native circle fallback.
- Reinforced `fixHebrewRTL()` logic for bracketed LTR tokens and bidirectional text stability.

### State Machine & Asset Pipeline (`ResultsModal`)
- Removed `isMounted = false` cancellation trap — prevents permanent PDF spinner lock on re-renders.
- Added `loadedImageError` state — target photo fetch failure (CORS/network) no longer blocks PDF generation, falls back gracefully to metric-only report.
- Separated asset fetching (PNG, target photo, CSV/XLSX) into distinct `useEffect` hooks away from PDF compilation logic.

### Mobile Web Share
- Streamlined Web Share API payload: PDF blob, PNG plot, and CSV all attach correctly to native mobile share sheets.
- Desktop simulation: Chrome DevTools `navigator.share` mock enables full share flow testing in responsive device mode.

### Debugging Infrastructure
- ADB/USB debugging configured for Android/MIUI (POCO F5).
- Eruda floating in-browser console integrated for standalone mobile testing.

---

## Upcoming / Next Steps

- **SVG Animations & Micro-interactions:** Interactive shot markers and target plot elements.
- **Hebrew Localization Pass:** Full RTL layout audit across all UI components — some strings may still be hardcoded in English within App.tsx.
- **GitHub Pages Release:** Production build + deployment workflow.
- **App.tsx Decomposition:** Extract `ResultsModal`, `CEPPlot`, `SettingsPanel`, `ScaleDistanceDialog` into separate files under `src/components/`.
- **Remove duplicate `useEffect`:** The second identical asset-fetching effect block in ResultsModal.
- **Expose PDF font picker in Settings:** Wire `selectedFont` state to `generateDataPdfReport` call.
