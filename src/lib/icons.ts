/**
 * Icon configuration — swap options here, rest of app updates automatically.
 *
 * Uses import.meta.env.BASE_URL so paths work correctly on both:
 *   - GitHub Pages: /cep-analyzer-web/assets/...
 *   - Local dev / file://: /assets/... or ./assets/...
 */
const B = `${import.meta.env.BASE_URL}assets`

export const ICONS = {
  // Action buttons
  loadImage:  `${B}/gallery select.svg`,      // opt2: load image (1).svg  opt3: multi-image-line.svg
  camera:     `${B}/camera_path.svg`,
  calculate:  `${B}/analyze calculate results.svg`,  // opt2: calculator-line.svg
  exportCSV:  `${B}/download csv (1).svg`,    // opt2: download csv option 2.svg
  exportXLSX: `${B}/save excel file.svg`,
  editShots:  `${B}/edit shots (1).svg`,
  downloadPNG:  `${B}/download-plot-png.svg`,
  undo:       `${B}/undo.svg`,
  back:       `${B}/back button option 1.svg`,
  results:    `${B}/analyze calculate results.svg`,
  confirm:    `${B}/confirm.svg`,
  // Zoom
  zoomIn:     `${B}/zoom-in.svg`,
  zoomOut:    `${B}/zoom-out.svg`,
  zoomReset:  `${B}/reset zoom button.svg`,
  // Rotation
  rotateCW:   `${B}/rotate image clockwise 90.svg`,
  rotateCCW:  `${B}/rotate-step-op3.svg`,
  flipCamera: `${B}/icon-flip-camera.svg`,
  // Workflow sidebar
  stepShots:   `${B}/select shots workflow icon.svg`,
  stepOrigin:  `${B}/crosshair (2).svg`,
  stepScale:   `${B}/ruler-line.svg`,
  stepResults: `${B}/analyze calculate results.svg`,
  stepRotate:  `${B}/rotate-step.svg`,
  // Special
  crosshair:  `${B}/gemini-svg.svg`,
  panCursor:  `${B}/drag-pan-cursor-op2.svg`,
  // Future
  settings:   `${B}/settings.svg`,            // opt2: settings option 2.svg
  share:      `${B}/share results to another app.svg`,
  toggleL:    `${B}/toggle-left.svg`,
  toggleR:    `${B}/toggle-right.svg`,
} as const

export type IconKey = keyof typeof ICONS
export const I = (key: IconKey) => ICONS[key]