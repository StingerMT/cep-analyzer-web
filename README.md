# CEP Target Analyzer — Web

**Browser-based ballistic target analysis tool. No installation, no server, no internet required.**

Live at: **[https://stingermt.github.io/cep-analyzer-web/](https://stingermt.github.io/cep-analyzer-web/)**

---

## What It Does

Load a photo of a shooting target, mark your shot holes, set a scale reference and origin point — the app calculates all standard precision and dispersion metrics in real units (cm, mm, or inches):

| Metric | Description |
|--------|-------------|
| **Napam X, Y** | Mean hit point coordinates |
| **Sigma X, Y** | Horizontal / vertical standard deviation |
| **CEP 50%** | Median radius — 50% circular error probable |
| **Blocking Radius** | Furthest point from mean |
| **Extreme Spread** | Max distance between any two shots |
| **Dist. Napam→Napar** | Mean hit point to origin distance |
| **mrad** | Milliradian equivalents based on target distance |

---

## Key Features

- **Works offline** — runs entirely in the browser, no network calls
- **USB deployable** — copy the `dist/` folder to a USB stick, open `index.html`
- **Bilingual** — full English (LTR) and Hebrew (RTL) support
- **Mobile-first** — pinch-to-zoom, magnifying loupe for precise touch placement
- **Camera capture** — take photos directly from the app (requires HTTPS)
- **Export** — CSV, XLSX, PNG plot, and PDF report with target photo
- **Share** — Web Share API for native mobile sharing
- **PWA-ready** — installable on mobile home screens

---

## Usage

1. **Load Image** — open a target photo or capture with the camera
2. **Rotate** *(optional)* — straighten the image with 0.1° precision
3. **Set Scale** — click two known reference points, enter the real distance (paper-size presets available)
4. **Set Origin** — click the aiming point (target centre)
5. **Mark Shots** — click each bullet hole
6. **Calculate** — get all metrics instantly
7. **Export / Share** — download CSV/XLSX/PNG or share a full PDF report

---

## Running Locally

```bash
# Clone the repo
git clone https://github.com/StingerMT/cep-analyzer-web.git
cd cep-analyzer-web

# Install dependencies
npm install

# Start dev server (HTTPS via mkcert — required for camera API)
npm run dev
```

> Camera capture requires HTTPS. The dev server uses `vite-plugin-mkcert` to generate a local certificate automatically.

## Building for Production

```bash
npm run build
# Output in dist/ — works from file://, USB stick, or any static host
```

---

## Tech Stack

- **React 19** + **TypeScript 6** + **Vite 8**
- **jsPDF 4** — PDF report generation
- **xlsx** — Excel export
- **Canvas API** — image rendering and loupe magnifier
- **Web Share API** — native mobile sharing

---

## License

[PolyForm Noncommercial 1.0.0](LICENSE) — Free for non-commercial use. Attribution required.
Commercial use requires explicit written permission.
© 2025 Benyamin Abramovitz | [GitHub](https://github.com/StingerMT)
