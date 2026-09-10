# Deployment Guide - USB Stick Distribution

## Overview

This guide explains how to build and deploy the CEP Target Analyzer as a completely offline, USB-deployable web application.

## Requirements

### For Building (Development Machine)
- Node.js 18+ 
- npm or yarn
- Terminal/Command Prompt

### For Running (Target Devices)
- Modern web browser (Chrome, Firefox, Safari, Edge)
- No internet connection required
- No special permissions needed

## Build Process

### Step 1: Install Dependencies

```bash
cd cep_analyzer_web
npm install
```

### Step 2: Build Production Version

```bash
npm run build
```

This creates an optimized, minified build in the `dist/` folder.

**Build output:**
```
dist/
├── index.html          # Main entry point
├── assets/
│   ├── index-[hash].js   # All JavaScript bundled
│   ├── index-[hash].css  # All CSS bundled
│   └── icons/           # App icons
└── manifest.json        # PWA manifest
```

### Step 3: Test the Build Locally

```bash
npm run preview
```

Open browser to `http://localhost:4173` and test all functionality offline (disable network in DevTools).

## Packaging for Distribution

### Option 1: ZIP File (Recommended)

**Windows:**
```powershell
cd dist
Compress-Archive -Path * -DestinationPath ../cep_analyzer_web.zip
```

**Mac/Linux:**
```bash
cd dist
zip -r ../cep_analyzer_web.zip .
```

### Option 2: Direct Folder Copy

Simply copy the entire `dist/` folder to USB stick. Rename it to something user-friendly like `CEP_Analyzer`.

## USB Stick Setup

### Recommended Structure

```
USB_STICK/
├── CEP_Analyzer/           # The app
│   ├── index.html
│   ├── assets/
│   └── manifest.json
├── README.txt              # Instructions for users
└── CHANGELOG.txt           # Version history
```

### Create User Instructions (README.txt)

```
CEP TARGET ANALYZER - OFFLINE WEB APP
=====================================

INSTALLATION:
1. Copy the "CEP_Analyzer" folder to your device
2. Open the folder
3. Double-click "index.html"
4. App opens in your default browser

USAGE:
- Works completely offline (no internet needed)
- Load images from camera or gallery
- Mark shot points by tapping
- Calculate CEP statistics
- Export results to CSV

REQUIREMENTS:
- Modern web browser (Chrome, Firefox, Safari, Edge)
- No special permissions needed
- No installation required

TROUBLESHOOTING:
- If app doesn't open, right-click index.html → Open With → Choose browser
- For camera access, browser may ask for permission (allow it)
- If images appear rotated, the app will auto-correct them

VERSION: 1.0.0
CONTACT: https://github.com/StingerMT
```

## Deployment to Devices

### Android Devices

1. **Connect USB stick** to Android device (may need USB-OTG adapter)
2. **Open file manager** app
3. **Navigate to USB stick** → CEP_Analyzer folder
4. **Tap index.html**
5. **Choose browser** (Chrome recommended)
6. App opens and runs offline!

**Alternative - Copy to Device:**
1. Copy CEP_Analyzer folder to device storage (e.g., Downloads)
2. Open file manager → Navigate to folder
3. Tap index.html → Opens in browser

### iOS Devices

1. **Use Files app** to access USB stick (requires USB-C adapter or AirDrop)
2. **Navigate to CEP_Analyzer** folder
3. **Tap index.html**
4. **Opens in Safari**

**Alternative - AirDrop:**
1. Zip the CEP_Analyzer folder
2. AirDrop to iOS device
3. Unzip using Files app
4. Tap index.html

### Windows Devices

1. **Insert USB stick**
2. **Open File Explorer** → Navigate to USB stick
3. **Open CEP_Analyzer folder**
4. **Double-click index.html**
5. Opens in default browser (Edge/Chrome)

### Mac Devices

1. **Insert USB stick**
2. **Open Finder** → Navigate to USB stick
3. **Open CEP_Analyzer folder**
4. **Double-click index.html**
5. Opens in default browser (Safari/Chrome)

### Linux Devices

1. **Mount USB stick** (usually automatic)
2. **Open file manager** → Navigate to USB stick
3. **Open CEP_Analyzer folder**
4. **Double-click index.html** or right-click → Open With → Browser

## Installing as PWA (Optional)

Users can "install" the app for a more native experience:

### Chrome/Edge (Desktop & Android)
1. Open the app in browser
2. Click the install icon in address bar (⊕)
3. Click "Install"
4. App appears as standalone application

### Safari (iOS/Mac)
1. Open the app in Safari
2. Tap Share button
3. Tap "Add to Home Screen"
4. App appears on home screen like native app

## Updating the App

### Process
1. Build new version: `npm run build`
2. Package new dist folder
3. Distribute via USB stick
4. Users replace old folder with new one

### Version Management

Update version in `package.json`:
```json
{
  "version": "1.1.0"
}
```

Version appears in app footer and helps users know which version they have.

### Changelog

Maintain a CHANGELOG.txt on the USB stick:

```
CEP TARGET ANALYZER - CHANGELOG
================================

Version 1.0.0 (2025)
- Initial release
- Full CEP analysis (CEP50, sigma X/Y, blocking radius, extreme spread, mrad)
- Camera & gallery support
- Bilingual EN/HE with RTL layout
- Export to CSV, XLSX, PNG, and PDF report
- Web Share API for native mobile sharing
- PWA installable
```

## Troubleshooting Deployment

### App Won't Open

**Problem**: Double-clicking index.html doesn't work

**Solutions**:
- Right-click → Open With → Choose browser manually
- Check file permissions (must be readable)
- Try different browser

### Camera Not Working

**Problem**: Camera button doesn't work

**Solutions**:
- Browser needs camera permission (allow it)
- Camera API requires HTTPS or localhost (file:// protocol has limitations)
- **Workaround**: Use gallery/file upload instead

### Images Not Loading

**Problem**: Selected images don't appear

**Solutions**:
- Check browser console for errors (F12)
- Try smaller image files (< 10MB)
- Check file format (JPG, PNG supported)

### Export Not Working

**Problem**: CSV export doesn't download

**Solutions**:
- Check browser download settings
- Check download folder permissions
- Try different browser
- **Workaround**: Copy results text manually

## Security Considerations

### Safe for Restricted Environments

- **No network requests** - App never connects to internet
- **No data transmission** - Everything stays on device
- **No tracking** - No analytics or telemetry
- **No external dependencies** - All code bundled in app

### File System Access

- **Read-only** - App only reads image files user selects
- **No automatic writes** - Only writes when user exports CSV
- **User-initiated** - All file operations require user action

## Performance Optimization

### Build Optimization

The build process automatically:
- Minifies JavaScript (reduces size by ~70%)
- Minifies CSS (reduces size by ~60%)
- Optimizes images
- Removes dead code
- Bundles all dependencies

### Runtime Performance

- **Fast load**: < 1 second on modern devices
- **Responsive**: UI updates in < 16ms (60 FPS)
- **Efficient**: Uses < 50MB RAM typical

### Large Image Handling

For very large images (> 20MP):
- App automatically downscales for display
- Original resolution used for calculations
- May be slower on older devices

## Distribution Checklist

Before distributing:

- [ ] Build production version (`npm run build`)
- [ ] Test offline (disable network in DevTools)
- [ ] Test on target devices (Android, iOS, etc.)
- [ ] Test camera access
- [ ] Test gallery/file upload
- [ ] Test CEP calculations (verify against known results)
- [ ] Test CSV export
- [ ] Create README.txt with instructions
- [ ] Create CHANGELOG.txt with version info
- [ ] Package as ZIP or folder
- [ ] Copy to USB stick
- [ ] Test deployment on clean device

## Support & Maintenance

### User Support

Provide users with:
- README.txt with clear instructions
- Contact information for support
- Known issues and workarounds
- Version number for reference

### Maintenance

- Keep source code in version control (Git)
- Document all changes in CHANGELOG
- Test thoroughly before each release
- Maintain backward compatibility when possible

## Advanced: Custom Domain (Optional)

If you want to host on a web server (in addition to USB deployment):

1. Build: `npm run build`
2. Upload `dist/` contents to web server
3. Configure HTTPS (required for camera access)
4. Users can access via URL or download for offline use

**Note**: USB deployment is still recommended for restricted environments.

## Conclusion

This deployment method provides:
- ✅ Maximum compatibility (works everywhere)
- ✅ Zero dependencies (no installation needed)
- ✅ Complete offline operation (no internet required)
- ✅ Easy updates (replace files)
- ✅ Cross-platform (one build for all devices)

Perfect for restricted environments where traditional app deployment isn't possible!
