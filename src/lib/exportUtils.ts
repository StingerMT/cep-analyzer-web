// ⚠️  ORPHANED FILE — not imported anywhere in the current codebase.
// This was the original direct-download XLSX exporter, written before the
// Blob-returning pattern was adopted in cepAnalysis.ts.
//
// Key differences from the current cepAnalysis.exportToXLSX:
//   - Takes raw canvas-pixel shots + origin + upp and converts to real units internally
//     (the new version expects pre-converted real-unit coordinates from metrics.realPoints)
//   - Triggers a browser download immediately (no Blob return)
//   - Produces two sheets (Results + Shot Coordinates) vs one sheet in the new version
//   - Uses a minified coding style
//
// Safe to delete once you're certain no external code depends on this export.
import * as XLSX from 'xlsx'

interface Pt { x: number; y: number }
interface M {
  numPoints:number; meanX:number; meanY:number
  sigmaX:number; sigmaY:number; combinedStd:number
  cep50:number; blockingRadius:number; extremeSpread:number
  meanToOrigin:number; unit:string; realPoints:Pt[]
}

// r(): rounds a number to `d` decimal places using multiply-round-divide (avoids floating-point drift)
function r(v:number,d=2){const f=Math.pow(10,d);return Math.round(v*f)/f}
// toCm(): unit converter for mrad calculation — same logic as toCentimeters in cepAnalysis.ts
function toCm(v:number,u:string){if(u==='mm')return v/10;if(u==='in')return v*2.54;return v}

export function exportToXLSX(
  shots:Pt[], origin:Pt|null, upp:number,
  unitName:string, metrics:M, distanceM=100
):void{
  const wb=XLSX.utils.book_new(), u=unitName
  const mradX=distanceM>0?(toCm(metrics.sigmaX,u)/100/distanceM)*1000:0
  const mradY=distanceM>0?(toCm(metrics.sigmaY,u)/100/distanceM)*1000:0

  const s1=XLSX.utils.aoa_to_sheet([
    ['CEP Target Analyzer — Results','',''],
    ['','',''],
    ['Metric','Value','Unit'],
    ['Shots',metrics.numPoints,''],
    ['CEP 50%',r(metrics.cep50),u],
    ['Extreme Spread',r(metrics.extremeSpread),u],
    ['Blocking Radius',r(metrics.blockingRadius),u],
    ['Mean to Origin',r(metrics.meanToOrigin),u],
    ['Sigma X',r(metrics.sigmaX),u],
    ['Sigma Y',r(metrics.sigmaY),u],
    ['Combined Std Dev',r(metrics.combinedStd),u],
    ['Mean X',r(metrics.meanX),u],
    ['Mean Y',r(metrics.meanY),u],
    ['','',''],
    ['Milliradian','',''],
    ['Distance to target',distanceM,'m'],
    ['Sigma X',r(mradX,3),'mrad'],
    ['Sigma Y',r(mradY,3),'mrad'],
  ])
  s1['!cols']=[{wch:22},{wch:14},{wch:8}]
  XLSX.utils.book_append_sheet(wb,s1,'Results')

  const org=origin??shots[0]
  const s2=XLSX.utils.aoa_to_sheet([
    ['Shot Coordinates ('+u+')','',''],
    ['','',''],
    ['Shot #','X ('+u+')','Y ('+u+')'],
    ...shots.map((p,i)=>[i+1,r((p.x-org.x)*upp,4),r(-(p.y-org.y)*upp,4)])
  ])
  s2['!cols']=[{wch:8},{wch:14},{wch:14}]
  XLSX.utils.book_append_sheet(wb,s2,'Shot Coordinates')

  const buf=XLSX.write(wb,{bookType:'xlsx',type:'array'}) as ArrayBuffer
  const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})
  const url=URL.createObjectURL(blob)
  const a=document.createElement('a')
  a.href=url; a.download='cep_'+new Date().toISOString().replace(/[:.]/g,'-')+'.xlsx'
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
}