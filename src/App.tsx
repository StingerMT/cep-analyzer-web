/**
 * App.tsx — root component and workflow orchestrator.
 *
 * Responsibilities:
 *   - State machine: idle → rotate → scale → origin → shots → results
 *   - Canvas rendering (draw loop, toCanvas transform, loupe)
 *   - All mouse / touch / keyboard interaction handlers
 *   - File loading and EXIF orientation correction
 *   - Mounting / unmounting of modal components
 *
 * All UI sub-components live in src/components/:
 *   Atoms.tsx            — Btn, IconBtn, SvgToggle
 *   MetricCard.tsx       — metric display cell
 *   CEPPlot.tsx          — pure-SVG scatter plot
 *   ScaleDistanceDialog  — paper-size preset + custom distance dialog
 *   SettingsPanel.tsx    — display & plot-layer settings modal
 *   ResultsModal.tsx     — metrics, plot, export, and share modal
 *   CameraModal.tsx      — native camera capture
 *   Ico.tsx              — SVG icon renderer
 *
 * Design tokens: src/lib/theme.ts (C and CEP_THEME)
 * PDF utilities:  src/lib/pdfUtils.ts
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { loadAndCorrectImage } from './lib/imageUtils'
import { computeMetrics, exportToCSV, exportToXLSX } from './lib/cepAnalysis'
import { useI18n } from './lib/i18n'
import { C } from './lib/theme'
import { ICONS } from './lib/icons'
import type { IconKey } from './lib/icons'
import React from 'react'

// ── Component imports ─────────────────────────────────────────────────────────
import { Btn, IconBtn } from './components/Atoms'
import Ico from './components/Ico'
import CameraModal from './components/CameraModal'
import { ScaleDistanceDialog } from './components/ScaleDistanceDialog'
import { SettingsPanel } from './components/SettingsPanel'
import { ResultsModal } from './components/ResultsModal'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Point { x: number; y: number }
type Step = 'idle' | 'rotate' | 'scale' | 'origin' | 'shots' | 'results'
interface Metrics {
  numPoints: number; meanX: number; meanY: number
  sigmaX: number; sigmaY: number; combinedStd: number
  cep50: number; blockingRadius: number; extremeSpread: number
  meanToOrigin: number; unit: string; realPoints: Point[]
}

// ─── Custom cursor strings ────────────────────────────────────────────────────
// The `16 16` hotspot coordinates point to the centre of the 32×32 icon.
// The fallback keyword activates if the browser rejects the custom cursor URL.
const CROSSHAIR_CURSOR = `url('${ICONS.crosshair}') 16 16, crosshair`;
const PAN_CURSOR       = `url('${ICONS.panCursor}') 16 16, move`;

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const { t, lang, isRTL, setLang } = useI18n()

  // ── Image state ────────────────────────────────────────────────────────────
  const [imgUrl,   setImgUrl]   = useState<string | null>(null)
  const [imgW,     setImgW]     = useState(0)
  const [imgH,     setImgH]     = useState(0)
  const [rotation, setRotation] = useState(0)

  // ── Workflow state ─────────────────────────────────────────────────────────
  const [step,       setStep]       = useState<Step>('idle')
  const [origin,     setOrigin]     = useState<Point | null>(null)
  const [shots,      setShots]      = useState<Point[]>([])
  const [scalePts,   setScalePts]   = useState<Point[]>([])
  const [scaleUnit,  setScaleUnit]  = useState('cm')
  const [upp,        setUpp]        = useState(0)   // units per pixel
  const [metrics,    setMetrics]    = useState<Metrics | null>(null)

  // ── UI visibility flags ────────────────────────────────────────────────────
  const [showScale,    setShowScale]    = useState(false)
  const [showResults,  setShowResults]  = useState(false)
  const [showCamera,   setShowCamera]   = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // ── View state ─────────────────────────────────────────────────────────────
  const [zoom,   setZoom]   = useState(1)
  const [panX,   setPanX]   = useState(0)
  const [panY,   setPanY]   = useState(0)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  // ── Visual / accessibility settings ───────────────────────────────────────
  const [dotSize,        setDotSize]        = useState(7)
  const [scaleLineWidth, setScaleLineWidth] = useState(2)
  const [shotColor,      setShotColor]      = useState<string>(C.green)
  const [originColor,    setOriginColor]    = useState<string>(C.red)
  const [scaleColor,     setScaleColor]     = useState<string>(C.accent)

  // ── Plot layer visibility (passed to CEPPlot and SettingsPanel) ────────────
  const [showGridlines,     setShowGridlines]     = useState(true)
  const [showLabels,        setShowLabels]        = useState(true)
  const [showCEP,           setShowCEP]           = useState(true)
  const [showBlockingRadius,setShowBlockingRadius]= useState(true)
  const [showES,            setShowES]            = useState(true)
  const [showMeanOrigin,    setShowMeanOrigin]    = useState(true)

  // ── Canvas / interaction state ─────────────────────────────────────────────
  // mouseImgPos: cursor position in image-pixel space (for rubber-band preview and crosshair)
  const [mouseImgPos,    setMouseImgPos]    = useState<Point | null>(null)
  // overImage: true when cursor is over actual image pixels (not the letterbox area)
  const [overImage,      setOverImage]      = useState(false)
  const [touchScreenPos, setTouchScreenPos] = useState<{ x: number; y: number } | null>(null)
  const [isPanning,      setIsPanning]      = useState(false)
  const [displaySize,    setDisplaySize]    = useState({ w: 800, h: 600 })

  // ── Refs ───────────────────────────────────────────────────────────────────
  const fileRef        = useRef<HTMLInputElement>(null)
  const canvasRef      = useRef<HTMLCanvasElement>(null)
  const imgElRef       = useRef<HTMLImageElement | null>(null)   // decoded HTMLImageElement for draw()
  const containerRef   = useRef<HTMLDivElement>(null)
  const loupeCanvasRef = useRef<HTMLCanvasElement>(null)
  const isMmbPanning   = useRef(false)
  const lastMmb        = useRef<Point>({ x: 0, y: 0 })
  const lastPinch      = useRef<number | null>(null)
  const isTouchPan     = useRef(false)
  const lastTouch      = useRef<Point>({ x: 0, y: 0 })
  const ignoreCurrentTouch = useRef(false)  // long-press: abort touchEnd placement
  const blockNextClick     = useRef(false)  // long-press: swallow synthetic click

  // ── Resize handler ─────────────────────────────────────────────────────────
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // ── displaySize: CSS size that fits the image in the container ─────────────
  // Canvas pixel dimensions always = full image resolution (sharp at any zoom).
  // Zoom is a pure CSS width/height multiplier — canvas.width stays fixed.
  useEffect(() => {
    if (!imgW || !imgH) return
    const el = containerRef.current; if (!el) return
    const aw = el.clientWidth - 16, ah = el.clientHeight - 16
    const s = Math.min(aw / imgW, ah / imgH, 1)
    setDisplaySize({ w: imgW * s, h: imgH * s })
  }, [imgUrl, imgW, imgH])

  // ── draw() ─────────────────────────────────────────────────────────────────
  // Redraws the entire canvas on every relevant state change.
  // Layer order: image → scale line → origin crosshair → shot dots → loupe.
  //
  // imgScale: uniform scale factor that fits the rotated image into the canvas.
  // Formula for a rotated rectangle bounding box:
  //   rotated_w = imgW * cosA + imgH * sinA
  //   rotated_h = imgW * sinA + imgH * cosA
  //
  // toCanvas(p): image-pixel coords → canvas coords.
  //   Center of canvas = center of image.
  //   Offset = (p − imageCenter) * imgScale
  const draw = useCallback(() => {
    const canvas = canvasRef.current, img = imgElRef.current
    if (!canvas || !img || !imgUrl) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const rad   = Math.abs(rotation * Math.PI / 180) % (Math.PI / 2)
    const cosA  = Math.cos(rad), sinA = Math.sin(rad)
    const imgScale = Math.min(
      canvas.width  / (imgW * cosA + imgH * sinA),
      canvas.height / (imgW * sinA + imgH * cosA)
    )

    ctx.save()
    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.rotate((rotation * Math.PI) / 180)
    ctx.scale(imgScale, imgScale)
    ctx.drawImage(img, -imgW / 2, -imgH / 2, imgW, imgH)
    ctx.restore()

    const toCanvas = (p: Point) => ({
      x: canvas.width  / 2 + (p.x - imgW / 2) * imgScale,
      y: canvas.height / 2 + (p.y - imgH / 2) * imgScale,
    })

    // Scale reference line + rubber-band preview
    if (scalePts.length > 0) {
      const c0 = toCanvas(scalePts[0])
      ctx.strokeStyle = scaleColor; ctx.lineWidth = scaleLineWidth; ctx.setLineDash([scaleLineWidth, scaleLineWidth])
      if (scalePts.length === 1 && mouseImgPos) {
        const cm = toCanvas(mouseImgPos)
        ctx.beginPath(); ctx.moveTo(c0.x, c0.y); ctx.lineTo(cm.x, cm.y); ctx.stroke()
      } else if (scalePts.length === 2) {
        const c1 = toCanvas(scalePts[1])
        ctx.beginPath(); ctx.moveTo(c0.x, c0.y); ctx.lineTo(c1.x, c1.y); ctx.stroke()
      }
      ctx.setLineDash([])
      scalePts.forEach(p => {
        const c = toCanvas(p)
        ctx.fillStyle = scaleColor; ctx.fillRect(c.x - scaleLineWidth, c.y - scaleLineWidth, scaleLineWidth * 2, scaleLineWidth * 2)
      })
    }

    // Origin crosshair (gap style) + filled centre dot
    if (origin) {
      const { x, y } = toCanvas(origin)
      const g = Math.ceil(scaleLineWidth)
      ctx.strokeStyle = originColor; ctx.lineWidth = Math.ceil(scaleLineWidth / 2); ctx.setLineDash([])
      ctx.beginPath(); ctx.moveTo(x - g * 4, y); ctx.lineTo(x - g, y); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(x + g, y); ctx.lineTo(x + g * 4, y); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(x, y - g * 4); ctx.lineTo(x, y - g); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(x, y + g); ctx.lineTo(x, y + g * 4); ctx.stroke()
      ctx.fillStyle = originColor
      ctx.beginPath(); ctx.arc(x, y, Math.ceil(scaleLineWidth / 3), 0, Math.PI * 2); ctx.fill()
    }

    // Shot dots — white ring + coloured fill + index number
    shots.forEach((p, i) => {
      const { x, y } = toCanvas(p)
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = dotSize * 0.25; ctx.setLineDash([])
      ctx.beginPath(); ctx.arc(x, y, dotSize + dotSize / 3, 0, Math.PI * 2); ctx.stroke()
      ctx.fillStyle = C.green
      ctx.beginPath(); ctx.arc(x, y, dotSize, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#000'; ctx.font = 'bold 7px system-ui'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(String(i + 1), x, y)
    })

    // Magnifying loupe (touch only)
    if (touchScreenPos && loupeCanvasRef.current && canvasRef.current) {
      const loupeCanvas = loupeCanvasRef.current
      const lCtx = loupeCanvas.getContext('2d')
      if (lCtx) {
        lCtx.clearRect(0, 0, loupeCanvas.width, loupeCanvas.height)
        const rect   = canvas.getBoundingClientRect()
        const canvasX = ((touchScreenPos.x - rect.left) / rect.width)  * canvas.width
        const canvasY = ((touchScreenPos.y - rect.top)  / rect.height) * canvas.height
        const srcSize = 50
        lCtx.save()
        lCtx.beginPath(); lCtx.arc(loupeCanvas.width / 2, loupeCanvas.height / 2, loupeCanvas.width / 2, 0, Math.PI * 2); lCtx.clip()
        lCtx.drawImage(canvas, canvasX - srcSize / 2, canvasY - srcSize / 2, srcSize, srcSize, 0, 0, loupeCanvas.width, loupeCanvas.height)
        lCtx.strokeStyle = C.accent; lCtx.lineWidth = 1.5
        lCtx.beginPath()
        lCtx.moveTo(loupeCanvas.width / 2 - 12, loupeCanvas.height / 2)
        lCtx.lineTo(loupeCanvas.width / 2 + 12, loupeCanvas.height / 2)
        lCtx.moveTo(loupeCanvas.width / 2, loupeCanvas.height / 2 - 12)
        lCtx.lineTo(loupeCanvas.width / 2, loupeCanvas.height / 2 + 12)
        lCtx.stroke()
        lCtx.restore()
      }
    }
  }, [imgUrl, imgW, imgH, rotation, origin, shots, scalePts, mouseImgPos, step, displaySize, zoom, touchScreenPos])

  useEffect(() => { draw() }, [draw])

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, shots, scalePts, origin])

  // ── Prevent mobile overscroll / pull-to-refresh ────────────────────────────
  useEffect(() => {
    document.documentElement.style.overscrollBehavior = 'none'
    document.body.style.overscrollBehavior = 'none'
    document.body.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overscrollBehavior = ''
      document.body.style.overscrollBehavior = ''
      document.body.style.overflow = ''
    }
  }, [])

  // ── Warn before closing with unsaved work ──────────────────────────────────
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (imgUrl || step !== 'idle') {
        e.preventDefault()
        e.returnValue = 'You have an active progress sequence. Are you sure you want to leave?'
        return e.returnValue
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [imgUrl, step])

  // ── File loader ────────────────────────────────────────────────────────────
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    try {
      const data = await loadAndCorrectImage(file)
      imgElRef.current = data.element
      setImgUrl(data.url); setImgW(data.width); setImgH(data.height)
      setRotation(0); setStep('rotate')
      setOrigin(null); setShots([]); setScalePts([])
      setUpp(0); setMetrics(null); setZoom(1); setPanX(0); setPanY(0)
      setMouseImgPos(null)
    } catch (err) { alert(t('errors.load_image').replace('{msg}', String(err))) }
    e.target.value = ''
  }

  // ── Coordinate helpers ─────────────────────────────────────────────────────
  // getImgCoords: mouse event → image pixel coords.
  // Uses offsetX/clientWidth fraction then inverts the imgScale transform.
  const getImgCoords = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current!
    const fx = e.nativeEvent.offsetX / canvas.clientWidth
    const fy = e.nativeEvent.offsetY / canvas.clientHeight
    const rad = Math.abs(rotation * Math.PI / 180) % (Math.PI / 2)
    const cosA = Math.cos(rad), sinA = Math.sin(rad)
    const imgScale = Math.min(
      canvas.width  / (imgW * cosA + imgH * sinA),
      canvas.height / (imgW * sinA + imgH * cosA)
    )
    return {
      x: (fx * canvas.width  - canvas.width  / 2) / imgScale + imgW / 2,
      y: (fy * canvas.height - canvas.height / 2) / imgScale + imgH / 2,
    }
  }

  // getImgCoordsFromClient: clientX/Y → image pixel coords (used by touch events).
  const getImgCoordsFromClient = (clientX: number, clientY: number): Point => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const fx = (clientX - rect.left) / rect.width
    const fy = (clientY - rect.top)  / rect.height
    const rad = Math.abs(rotation * Math.PI / 180) % (Math.PI / 2)
    const cosA = Math.cos(rad), sinA = Math.sin(rad)
    const imgScale = Math.min(
      canvas.width  / (imgW * cosA + imgH * sinA),
      canvas.height / (imgW * sinA + imgH * cosA)
    )
    return {
      x: (fx * canvas.width  - canvas.width  / 2) / imgScale + imgW / 2,
      y: (fy * canvas.height - canvas.height / 2) / imgScale + imgH / 2,
    }
  }

  // ── Canvas click — place scale/origin/shot points ─────────────────────────
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Guard: swallow synthetic click emitted right after a mobile long-press
    if (blockNextClick.current) { blockNextClick.current = false; return }
    if (!imgUrl || isMmbPanning.current) return
    const pt = getImgCoords(e)

    if (step === 'scale') {
      const next = [...scalePts, pt]
      setScalePts(next)
      if (next.length === 2) { setMouseImgPos(null); setShowScale(true) }
    } else if (step === 'origin') {
      setOrigin(pt); setStep('shots')
    } else if (step === 'shots') {
      // Proximity check: warn if new shot overlaps an existing marker
      const thresh = imgW > 0 ? (imgW / displaySize.w) * 1 : 40
      const allPts: Point[] = [...shots, ...(origin ? [origin] : [])]
      const tooClose = allPts.some(p => Math.hypot(pt.x - p.x, pt.y - p.y) < thresh)
      if (tooClose && !window.confirm(t('proximity.warning'))) return
      setShots(prev => [...prev, pt])
    }
  }

  // ── Right-click: remove nearest shot or clear origin ──────────────────────
  const handleCanvasContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    if (!imgUrl) return

    // On mobile, a long-press fires: touchstart → contextmenu → synthetic click.
    // Set flags so neither touchEnd nor the synthetic click place a new point.
    const isMobileLongPress = touchScreenPos !== null
    if (isMobileLongPress) {
      ignoreCurrentTouch.current = true
      blockNextClick.current = true
    }
    setTouchScreenPos(null); setMouseImgPos(null); setOverImage(false)

    const pt = getImgCoords(e)
    const hitR = imgW > 0 ? (imgW / displaySize.w) * 2.25 : 20

    if (step === 'shots' || step === 'results') {
      let bestIdx = -1, bestDist = hitR
      shots.forEach((s, i) => {
        const d = Math.hypot(pt.x - s.x, pt.y - s.y)
        if (d < bestDist) { bestDist = d; bestIdx = i }
      })
      if (bestIdx >= 0) { setShots(prev => prev.filter((_, i) => i !== bestIdx)); return }
    }
    if (origin && (step === 'shots' || step === 'origin')) {
      if (Math.hypot(pt.x - origin.x, pt.y - origin.y) < hitR) {
        setOrigin(null); setStep('origin')
      }
    }
  }

  // ── Mouse move on canvas — rubber-band line + custom cursor ───────────────
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (step !== 'scale' && step !== 'origin' && step !== 'shots') return
    const canvas = canvasRef.current!
    const fx = e.nativeEvent.offsetX / canvas.clientWidth
    const fy = e.nativeEvent.offsetY / canvas.clientHeight
    const canvasX = fx * canvas.width, canvasY = fy * canvas.height
    const rad  = Math.abs(rotation * Math.PI / 180) % (Math.PI / 2)
    const cosA = Math.cos(rad), sinA = Math.sin(rad)
    const iScale = Math.min(canvas.width / (imgW * cosA + imgH * sinA), canvas.height / (imgW * sinA + imgH * cosA))
    const imgLeft   = canvas.width  / 2 - (imgW / 2) * iScale
    const imgRight  = canvas.width  / 2 + (imgW / 2) * iScale
    const imgTop    = canvas.height / 2 - (imgH / 2) * iScale
    const imgBottom = canvas.height / 2 + (imgH / 2) * iScale
    setOverImage(canvasX >= imgLeft && canvasX <= imgRight && canvasY >= imgTop && canvasY <= imgBottom)
    setMouseImgPos(getImgCoords(e))
  }

  const handleCanvasMouseLeave = () => { setMouseImgPos(null); setOverImage(false) }

  // ── Middle mouse button pan ────────────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1) { isMmbPanning.current = true; lastMmb.current = { x: e.clientX, y: e.clientY }; setIsPanning(true); e.preventDefault() }
  }
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMmbPanning.current) return
    const dx = e.clientX - lastMmb.current.x, dy = e.clientY - lastMmb.current.y
    lastMmb.current = { x: e.clientX, y: e.clientY }
    setPanX(p => p + dx); setPanY(p => p + dy)
  }
  const handleMouseUp = () => { if (isMmbPanning.current) { isMmbPanning.current = false; setIsPanning(false) } }

  // ── Ctrl+scroll = zoom, plain scroll = pan ────────────────────────────────
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    if (e.ctrlKey || e.metaKey) {
      const delta = e.deltaY > 0 ? -0.15 : 0.15
      setZoom(z => Math.min(8, Math.max(0.5, +(z + delta).toFixed(2))))
    } else {
      setPanX(p => p - e.deltaX); setPanY(p => p - e.deltaY)
    }
  }, [])

  // ── Touch interaction ──────────────────────────────────────────────────────
  // Single finger on canvas (placing step) → magnifying loupe + lift-to-drop
  // Single finger elsewhere                → pan
  // Two fingers                            → pinch zoom + pan
  const handleTouchStart = useCallback((e: TouchEvent) => {
    const isPlacingStep = step === 'scale' || step === 'origin' || step === 'shots'
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('select') || target.closest('input')) return

    ignoreCurrentTouch.current = false
    blockNextClick.current = false

    if (e.touches.length === 1) {
      const touch = e.touches[0]
      const canvas = canvasRef.current
      if (isPlacingStep && canvas && e.target === canvas) {
        isTouchPan.current = false
        setMouseImgPos(getImgCoordsFromClient(touch.clientX, touch.clientY))
        setOverImage(true)
        setTouchScreenPos({ x: touch.clientX, y: touch.clientY })
        return
      }
      isTouchPan.current = true
      lastTouch.current = { x: touch.clientX, y: touch.clientY }
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      lastPinch.current = Math.hypot(dx, dy)
      lastTouch.current = { x: (e.touches[0].clientX + e.touches[1].clientX) / 2, y: (e.touches[0].clientY + e.touches[1].clientY) / 2 }
      isTouchPan.current = false
      setTouchScreenPos(null)
    }
  }, [step, imgW, imgH, rotation])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    const isPlacingStep = step === 'scale' || step === 'origin' || step === 'shots'

    if (e.touches.length === 2) {
      e.preventDefault()
      const t0 = e.touches[0], t1 = e.touches[1]
      const dist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY)
      if (lastPinch.current !== null && lastPinch.current > 0) {
        const prevPinch = lastPinch.current
        setZoom(z => Math.min(8, Math.max(0.5, +(z * (dist / prevPinch)).toFixed(2))))
      }
      lastPinch.current = dist
      const midX = (t0.clientX + t1.clientX) / 2, midY = (t0.clientY + t1.clientY) / 2
      if (lastTouch.current) { setPanX(p => p + midX - lastTouch.current.x); setPanY(p => p + midY - lastTouch.current.y) }
      lastTouch.current = { x: midX, y: midY }
    } else if (e.touches.length === 1) {
      const touch = e.touches[0]
      const canvas = canvasRef.current
      if (isPlacingStep && touchScreenPos && canvas) {
        e.preventDefault()
        setMouseImgPos(getImgCoordsFromClient(touch.clientX, touch.clientY))
        setTouchScreenPos({ x: touch.clientX, y: touch.clientY })
        const rect   = canvas.getBoundingClientRect()
        const fx = (touch.clientX - rect.left) / rect.width
        const fy = (touch.clientY - rect.top)  / rect.height
        const canvasX = fx * canvas.width, canvasY = fy * canvas.height
        const rad  = Math.abs(rotation * Math.PI / 180) % (Math.PI / 2)
        const cosA = Math.cos(rad), sinA = Math.sin(rad)
        const iScale = Math.min(canvas.width / (imgW * cosA + imgH * sinA), canvas.height / (imgW * sinA + imgH * cosA))
        const imgLeft = canvas.width / 2 - (imgW / 2) * iScale, imgRight  = canvas.width  / 2 + (imgW / 2) * iScale
        const imgTop  = canvas.height / 2 - (imgH / 2) * iScale, imgBottom = canvas.height / 2 + (imgH / 2) * iScale
        setOverImage(canvasX >= imgLeft && canvasX <= imgRight && canvasY >= imgTop && canvasY <= imgBottom)
      } else if (isTouchPan.current) {
        const dx = touch.clientX - lastTouch.current.x, dy = touch.clientY - lastTouch.current.y
        lastTouch.current = { x: touch.clientX, y: touch.clientY }
        setPanX(p => p + dx); setPanY(p => p + dy)
      }
    }
  }, [step, touchScreenPos, imgW, imgH, rotation])

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    const isPlacingStep = step === 'scale' || step === 'origin' || step === 'shots'

    if (ignoreCurrentTouch.current) {
      e.preventDefault(); ignoreCurrentTouch.current = false; isTouchPan.current = false; lastPinch.current = null; return
    }
    if (isPlacingStep && touchScreenPos) {
      e.preventDefault()
      if (mouseImgPos && overImage) {
        if (step === 'scale') {
          setScalePts(prev => {
            const next = [...prev, mouseImgPos]
            if (next.length === 2) { setMouseImgPos(null); setTouchScreenPos(null); setTimeout(() => setShowScale(true), 50) }
            return next
          })
        } else if (step === 'origin') {
          setOrigin(mouseImgPos); setStep('shots')
        } else if (step === 'shots') {
          const thresh = imgW > 0 ? (imgW / displaySize.w) * 1 : 40
          const allPts: Point[] = [...shots, ...(origin ? [origin] : [])]
          const tooClose = allPts.some(p => Math.hypot(mouseImgPos.x - p.x, mouseImgPos.y - p.y) < thresh)
          if (!tooClose || window.confirm(t('proximity.warning')))
            setShots(prev => [...prev, mouseImgPos])
        }
      }
      setTouchScreenPos(null); setMouseImgPos(null); setOverImage(false)
    }
    isTouchPan.current = false; lastPinch.current = null
  }, [step, touchScreenPos, mouseImgPos, overImage, imgW, displaySize.w, shots, origin])

  // ── Register non-passive event listeners ──────────────────────────────────
  useEffect(() => {
    const el = containerRef.current; if (!el) return
    el.addEventListener('wheel',      handleWheel,      { passive: false })
    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchmove',  handleTouchMove,  { passive: false })
    el.addEventListener('touchend',   handleTouchEnd,   { passive: false })
    return () => {
      el.removeEventListener('wheel',      handleWheel)
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchmove',  handleTouchMove)
      el.removeEventListener('touchend',   handleTouchEnd)
    }
  }, [handleWheel, handleTouchStart, handleTouchMove, handleTouchEnd])

  // ── Step navigation ────────────────────────────────────────────────────────
  // goToStep: navigate backwards, clearing downstream data as we go.
  const goToStep = (target: Step) => {
    const order: Step[] = ['idle', 'rotate', 'scale', 'origin', 'shots', 'results']
    const ti = order.indexOf(target), ci = order.indexOf(step)
    if (ti >= ci) return
    if (ti <= order.indexOf('scale'))  { setScalePts([]); setUpp(0); setMouseImgPos(null) }
    if (ti <= order.indexOf('origin')) { setOrigin(null) }
    if (ti <= order.indexOf('shots'))  { setShots([]); setMetrics(null) }
    setStep(target)
  }

  // ── Undo ───────────────────────────────────────────────────────────────────
  const undo = () => {
    if      (step === 'shots')  { if (shots.length > 0) setShots(p => p.slice(0, -1)); else { setOrigin(null); setStep('origin') } }
    else if (step === 'scale')  { setScalePts(p => p.slice(0, -1)) }
    else if (step === 'origin') { setScalePts([]); setUpp(0); setStep('scale') }
  }

  // ── Calculate ──────────────────────────────────────────────────────────────
  const calculate = () => {
    if (!origin || shots.length < 3 || upp === 0) {
      alert(t('errors.calculation')); return
    }
    try {
      const m = computeMetrics(shots, origin, upp, scaleUnit)
      setMetrics(m); setStep('results'); setShowResults(true)
    } catch (err) { alert(t('errors.calculation_failed').replace('{msg}', String(err))) }
  }

  // ── Export blob routers (passed to ResultsModal) ───────────────────────────
  const handleGetCSVBlob  = (distance: number): Blob => exportToCSV(shots,  metrics!, distance, metrics!.unit)
  const handleGetXLSXBlob = (distance: number): Blob => exportToXLSX(shots, metrics!, distance, metrics!.unit)

  // ── Sidebar step definitions ───────────────────────────────────────────────
  const sideSteps: { key: Step; label: string }[] = [
    { key: 'rotate',  label: t('steps.rotate')  },
    { key: 'scale',   label: t('steps.scale')   },
    { key: 'origin',  label: t('steps.origin')  },
    { key: 'shots',   label: t('steps.shots')   },
    { key: 'results', label: t('steps.results') },
  ]
  const stepOrder: Step[] = ['idle', 'rotate', 'scale', 'origin', 'shots', 'results']
  const stepIdx = stepOrder.indexOf(step)

  const statusText = (): string => {
    switch (step) {
      case 'idle':    return t('status.idle')
      case 'rotate':  return t('status.rotate')
      case 'scale':   return scalePts.length === 0 ? t('status.scale_tap1') : t('status.scale_tap2')
      case 'origin':  return t('status.origin')
      case 'shots':   return shots.length >= 3
        ? t('status.shots_ready',     { count: shots.length })
        : t('status.shots_need_more', { count: shots.length })
      case 'results': return t('status.results', { cep: metrics?.cep50.toFixed(2) ?? '?', unit: metrics?.unit ?? '' })
      default:        return ''
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100dvh', width: '100vw', overscrollBehavior: 'none',
      background: C.bg, color: C.text,
      fontFamily: "'Segoe UI', system-ui, sans-serif", overflow: 'hidden',
    }}>
      {/* Hidden file input */}
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />

      {/* Body row: left sidebar + canvas + right sidebar */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* ── Left workflow sidebar ───────────────────────────────────────── */}
        {step !== 'idle' && (
          <div className="cep-slide-left" style={{
            width: 50, background: C.surface, borderRight: `1px solid ${C.border}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '12px 0', gap: 4, flexShrink: 0,
          }}>
            {sideSteps.map(({ key, label }, i) => {
              const idx      = stepOrder.indexOf(key)
              const done     = stepIdx > idx
              const active   = step === key
              const col      = done ? C.green : active ? C.accent : C.faint
              const canNav   = done

              const sidebarIconKey = (
                key === 'shots'   ? 'stepShots'  :
                key === 'origin'  ? 'stepOrigin' :
                key === 'scale'   ? 'stepScale'  :
                key === 'results' ? 'stepResults':
                key === 'rotate'  ? 'stepRotate' : 'loadImage'
              ) as IconKey

              return (
                <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '4px 0' }}>
                  <div
                    onClick={() => canNav && goToStep(key as Step)}
                    title={canNav ? t('sidebar.step_title_done', { step: label }) : t('sidebar.step_title_active', { step: label })}
                    className={`cep-step-dot${canNav ? ' can-nav' : ''}`}
                    style={{
                      width: 34, height: 34, borderRadius: '50%',
                      background: done ? C.green + '22' : active ? C.accent + '22' : 'transparent',
                      border: `2px solid ${col}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: done ? '0.8rem' : '1rem', color: col,
                      cursor: canNav ? 'pointer' : 'default',
                    }}
                  >
                    {done ? '✓' : <Ico icon={sidebarIconKey} size={18} />}
                  </div>
                  <span style={{ fontSize: '0.55rem', color: col, textAlign: 'center' }}>{label}</span>
                  {i < sideSteps.length - 1 && (
                    <div className="cep-step-connector" style={{ width: 2, height: 12, background: done ? C.green : C.border, borderRadius: 1 }} />
                  )}
                </div>
              )
            })}

            {/* Back button */}
            {stepIdx > 1 && (
              <div style={{ marginTop: 'auto', paddingBottom: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{ width: '60%', height: 1, background: C.border, marginBottom: 4 }} />
                <button
                  className="cep-btn"
                  onClick={() => goToStep(stepOrder[stepIdx - 1] as Step)}
                  title={t('sidebar.back_title')}
                  style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 6, color: C.muted, cursor: 'pointer', fontSize: '1.1rem', width: 32, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}
                >
                  <Ico icon="back" size={16} />
                </button>
                <span style={{ fontSize: '0.5rem', color: C.faint }}>{t('buttons.back')}</span>
              </div>
            )}
          </div>
        )}

        {/* ── Canvas area ─────────────────────────────────────────────────── */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onContextMenu={e => e.preventDefault()}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', position: 'relative',
            cursor: isPanning ? PAN_CURSOR
              : (step === 'scale' || step === 'origin' || step === 'shots') && overImage
                ? CROSSHAIR_CURSOR : 'default',
          }}
        >
          {/* Embossed copyright watermark */}
          <div style={{
            position: 'absolute', bottom: 14, left: 10,
            fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.13em',
            color: 'transparent', textShadow: '1px 1px 0 #2a2b2eff, -1px 1.25px 0 #131417',
            pointerEvents: 'none', userSelect: 'none' as const, whiteSpace: 'nowrap' as const, zIndex: 0,
          }}>
            ©Benji Abramovitz, 2026
          </div>

          {/* App title watermark */}
          <div style={{
            position: 'absolute', top: 10, left: 10,
            fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em',
            color: 'transparent', textShadow: '1px 1px 0 #3c3e42ff, -1px -1px 0 #17181b',
            pointerEvents: 'none', userSelect: 'none' as const, whiteSpace: 'nowrap' as const, zIndex: 0,
          }}>
            {t('app.title').toUpperCase()} &nbsp;&middot; v1.0.0
          </div>

          {imgUrl ? (
            <div style={{ position: 'relative', zIndex: 1 }}>
              <canvas
                ref={canvasRef}
                width={imgW} height={imgH}
                onClick={handleCanvasClick}
                onMouseMove={handleCanvasMouseMove}
                onContextMenu={handleCanvasContextMenu}
                onMouseLeave={handleCanvasMouseLeave}
                style={{
                  display: 'block', border: `2px solid ${C.border}`, borderRadius: 6,
                  width: displaySize.w * zoom, height: displaySize.h * zoom,
                  transform: `translate(${panX}px, ${panY}px)`,
                  cursor: isPanning ? PAN_CURSOR
                    : (step === 'scale' || step === 'origin' || step === 'shots') && overImage
                      ? CROSSHAIR_CURSOR : 'default',
                  boxSizing: 'content-box' as const,
                }}
              />
            </div>
          ) : (
            <div style={{ textAlign: 'center', userSelect: 'none' as const, position: 'relative', zIndex: 1 }}>
              <div className="cep-float" style={{ fontSize: '4rem', marginBottom: 12, opacity: 0.5, display: 'inline-block' }}>🎯</div>
              <div style={{ color: C.muted, marginBottom: 20, fontSize: '0.95rem' }}>{t('idle.no_image')}</div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' as const }}>
                <Btn onClick={() => fileRef.current?.click()} bg={C.accent}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Ico icon="loadImage" size={20} />{t('buttons.load_image')}</span>
                </Btn>
                <Btn onClick={() => setShowCamera(true)} bg={C.card}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Ico icon="camera" size={20} />{t('buttons.camera')}</span>
                </Btn>
              </div>
            </div>
          )}

          {/* Status pill — pulses when user action is actively needed */}
          <div
            className={
              step === 'scale' || step === 'origin' ||
              (step === 'shots' && shots.length < 3)
                ? 'cep-pulse-glow' : ''
            }
            style={{
              position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(43,45,49,0.95)', border: `1px solid ${C.border}`,
              borderRadius: 16, padding: '6px 14px', fontSize: '0.75rem', lineHeight: '1.3',
              color: step === 'results' ? C.green : C.accent, textAlign: 'center',
              boxShadow: '0 4px 14px rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)',
              zIndex: 5, pointerEvents: 'none', width: 'calc(100% - 32px)', maxWidth: 440,
            }}
          >
            {statusText()}
          </div>

          {/* Floating action card (bottom-right) — slides up on first render */}
          {step !== 'idle' && (
            <div className="cep-slide-up" style={{ position: 'absolute', bottom: 16, right: 16, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'stretch', zIndex: 10 }}>
              <div style={{
                background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
                padding: isMobile ? '8px' : '8px 10px', display: 'flex', flexDirection: 'column', gap: 6,
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)', minWidth: isMobile ? 'auto' : 140,
              }}>
                {step === 'rotate' && (
                  <Btn onClick={() => setStep('scale')} bg={C.green} title={t('buttons.confirm')}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                      <Ico icon="confirm" size={25} />{!isMobile && t('buttons.confirm')}
                    </span>
                  </Btn>
                )}
                {step === 'shots' && shots.length >= 3 && (
                  <Btn onClick={calculate} bg={C.green} title={t('buttons.calculate')}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                      <Ico icon="calculate" size={20} />{!isMobile && t('buttons.calculate')}
                    </span>
                  </Btn>
                )}
                {step === 'results' && (
                  <Btn onClick={() => setShowResults(true)} bg={C.accent} title={t('buttons.results')}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                      <Ico icon="results" size={20} />{!isMobile && t('buttons.results')}
                    </span>
                  </Btn>
                )}
                {step !== 'results' && (
                  <Btn onClick={undo} bg={C.orange} title={t('buttons.undo')}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                      <Ico icon="undo" size={20} />{!isMobile && t('buttons.undo')}
                    </span>
                  </Btn>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Right sidebar (zoom + global actions) ───────────────────────── */}
        {imgUrl && (
          <div style={{
            width: 50, background: C.surface, borderLeft: `1px solid ${C.border}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '10px 6px', gap: 6, flexShrink: 0,
          }}>
            <IconBtn onClick={() => setZoom(z => Math.min(8, +(z + 0.25).toFixed(2)))} title={t('zoom.zoom_in')}><Ico icon="zoomIn" size={18} /></IconBtn>
            <div style={{ fontSize: '0.58rem', color: C.muted, textAlign: 'center', lineHeight: 1.1 }}>{Math.round(zoom * 100)}%</div>
            <IconBtn onClick={() => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))} title={t('zoom.zoom_out')}><Ico icon="zoomOut" size={18} /></IconBtn>
            <IconBtn onClick={() => { setZoom(1); setPanX(0); setPanY(0) }} title={t('zoom.reset')}><Ico icon="zoomReset" size={18} /></IconBtn>
            <div style={{ fontSize: '0.5rem', color: C.faint, textAlign: 'center', marginTop: 4, lineHeight: 1.3 }}>{t('zoom.mmb_hint')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'auto', paddingBottom: 4 }}>
              <IconBtn onClick={() => fileRef.current?.click()} title={t('buttons.load_image')}><Ico icon="loadImage" size={18} /></IconBtn>
              <IconBtn onClick={() => setShowCamera(true)} title={t('buttons.camera')}><Ico icon="camera" size={18} /></IconBtn>
              <IconBtn onClick={() => setShowSettings(true)} title={t('settings.title')}><Ico icon="settings" size={18} /></IconBtn>
            </div>
          </div>
        )}
      </div>

      {/* ── Rotation bar (rotate step only) ──────────────────────────────── */}
      {step === 'rotate' && imgUrl && (
        <div className="cep-slide-up" style={{
          background: C.surface, borderTop: `1px solid ${C.border}`,
          padding: '8px 16px', flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 10,
          flexWrap: 'wrap' as const, justifyContent: 'center',
        }}>
          <span style={{ fontSize: '0.78rem', color: C.muted, whiteSpace: 'nowrap' as const, width: 45 }}>
            {rotation.toFixed(1)}°
          </span>
          <input
            type="range" min="-180" max="180" step="0.1" value={rotation}
            onChange={e => setRotation(parseFloat(e.target.value))}
            onDoubleClick={() => setRotation(0)}
            onWheel={e => {
              const dir = e.deltaY < 0 ? 1 : -1
              setRotation(r => Math.min(180, Math.max(-180, +(r + dir * 0.5).toFixed(1))))
            }}
            title="Scroll wheel to fine-tune • Double-click to reset to 0°"
            style={{ flex: 1, minWidth: 120, maxWidth: 280, accentColor: C.accent, cursor: 'pointer' }}
          />
          <Btn onClick={() => setRotation(r => (Math.round(r / 90) + 1) * 90)} bg={C.elevated} small>
            <Ico icon="rotateCCW" size={18} />
          </Btn>
          <Btn onClick={() => setRotation(0)} bg={C.faint} small>{t('rotation.reset')}</Btn>
        </div>
      )}

      {/* ── Modals ────────────────────────────────────────────────────────── */}

      {/* Scale distance dialog */}
      {showScale && (
        <ScaleDistanceDialog
          onConfirm={(dist, unit) => {
            const dx = scalePts[1].x - scalePts[0].x
            const dy = scalePts[1].y - scalePts[0].y
            const px = Math.hypot(dx, dy)
            if (px > 0) { setUpp(dist / px); setScaleUnit(unit) }
            setShowScale(false); setStep('origin')
          }}
          onCancel={() => { setScalePts([]); setShowScale(false) }}
          isMobile={isMobile}
          t={t}
        />
      )}

      {/* Magnifying loupe (touch only) */}
      {touchScreenPos && (
        <div style={{
          position: 'fixed', left: touchScreenPos.x - 65, top: touchScreenPos.y - 135,
          width: 130, height: 130, borderRadius: '50%', border: `3px solid ${C.accent}`,
          boxShadow: '0 10px 30px rgba(0,0,0,0.6)', overflow: 'hidden',
          backgroundColor: C.bg, zIndex: 500, pointerEvents: 'none',
        }}>
          <canvas ref={loupeCanvasRef} width={130} height={130} style={{ display: 'block' }} />
        </div>
      )}

      {/* Results modal */}
      {showResults && metrics && (
        <ResultsModal
          metrics={metrics}
          onClose={() => setShowResults(false)}
          t={t}
          getCSVBlob={handleGetCSVBlob}
          getXLSXBlob={handleGetXLSXBlob}
          onEditShots={() => { setShowResults(false); setStep('shots') }}
          lang={lang}
          isRTL={isRTL}
          showGridlines={showGridlines}
          showLabels={showLabels}
          showCEP={showCEP}
          showBlockingRadius={showBlockingRadius}
          showES={showES}
          showMeanOrigin={showMeanOrigin}
          loadedImageSrc={imgUrl || undefined}
        />
      )}

      {/* Camera modal */}
      {showCamera && (
        <CameraModal
          onCapture={file => handleFile({ target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>)}
          onClose={() => setShowCamera(false)}
          t={t}
        />
      )}

      {/* Settings panel */}
      {showSettings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
          lang={lang} setLang={setLang} t={t} isRTL={isRTL}
          dotSize={dotSize} setDotSize={setDotSize}
          scaleLineWidth={scaleLineWidth} setScaleLineWidth={setScaleLineWidth}
          shotColor={shotColor} setShotColor={setShotColor}
          originColor={originColor} setOriginColor={setOriginColor}
          scaleColor={scaleColor} setScaleColor={setScaleColor}
          showGridlines={showGridlines}     setShowGridlines={setShowGridlines}
          showLabels={showLabels}           setShowLabels={setShowLabels}
          showCEP={showCEP}                 setShowCEP={setShowCEP}
          showBlockingRadius={showBlockingRadius} setShowBlockingRadius={setShowBlockingRadius}
          showES={showES}                   setShowES={setShowES}
          showMeanOrigin={showMeanOrigin}   setShowMeanOrigin={setShowMeanOrigin}
        />
      )}
    </div>
  )
}
