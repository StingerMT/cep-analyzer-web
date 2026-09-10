import { useState, useRef, useEffect, useCallback } from 'react'

const C = {
  bg:'#1e1f22', surface:'#2b2d31', card:'#313338', elevated:'#383a40',
  border:'#3f4147', accent:'#5865f2', green:'#57f287', red:'#ed4245',
  text:'#dbdee1', muted:'#949ba4', faint:'#5c5f66',
}

interface Props { onCapture:(file:File)=>void; onClose:()=>void; t:(key:string,vars?:Record<string,string|number>)=>string }
type CamState = 'starting'|'live'|'captured'|'error'|'unsupported'

export default function CameraModal({ onCapture, onClose, t }: Props) {
  const videoRef  = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream|null>(null)
  const [state,       setState]       = useState<CamState>('starting')
  const [errorMsg,    setErrorMsg]    = useState('')
  const [capturedUrl, setCapturedUrl] = useState<string|null>(null)
  const [facingBack,  setFacingBack]  = useState(true)

  const startCamera = useCallback(async (back: boolean) => {
    streamRef.current?.getTracks().forEach(t=>t.stop())
    streamRef.current = null
    setState('starting'); setCapturedUrl(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      setState('unsupported')
      setErrorMsg(t('camera.error_unsupported'))
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video:{ facingMode: back?'environment':'user', width:{ideal:3840}, height:{ideal:2160} },
        audio:false,
      })
      streamRef.current = stream
      if (videoRef.current) { 
        videoRef.current.srcObject = stream; 
        videoRef.current.play().catch(e => {
          // Ignores the harmless Strict Mode interruption, but logs real errors
          if (e.name !== 'AbortError') console.error('Camera play error:', e)
        }) 
      }
      setState('live')
    } catch(err:unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMsg(
        msg.includes('ermission')||msg.includes('NotAllowed')
      ? t('camera.error_denied')
          : msg.includes('NotFound')
          ? 'No camera found on this device.'
          : `Camera error: ${msg}`
      )
      setState('error')
    }
  }, [])

  useEffect(() => {
    startCamera(true)
    return () => { streamRef.current?.getTracks().forEach(t=>t.stop()) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const flipCamera = () => { const n=!facingBack; setFacingBack(n); startCamera(n) }

  const capture = () => {
    const v=videoRef.current, c=canvasRef.current; if(!v||!c) return
    c.width=v.videoWidth; c.height=v.videoHeight
    c.getContext('2d')!.drawImage(v,0,0)
    c.toBlob(blob=>{
      if(!blob) return
      setCapturedUrl(URL.createObjectURL(blob))
      setState('captured')
      streamRef.current?.getTracks().forEach(t=>{ if(t.kind==='video') t.enabled=false })
    },'image/jpeg',0.95)
  }

  const usePhoto = () => {
    canvasRef.current?.toBlob(blob => {
      if (!blob) return
      const ts = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `cep_target_${ts}.jpg`
      const file = new File([blob], filename, { type: 'image/jpeg' })
      // Save photo silently to device downloads
      const dlUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = dlUrl; a.download = filename
      document.body.appendChild(a); a.click()
      document.body.removeChild(a); URL.revokeObjectURL(dlUrl)
      // Pass to analyzer
      onCapture(file); onClose()
    }, 'image/jpeg', 0.95)
  }

  const retake = () => {
    if(capturedUrl) URL.revokeObjectURL(capturedUrl)
    setCapturedUrl(null)
    streamRef.current?.getTracks().forEach(t=>{ t.enabled=true })
    setState('live')
  }

  const btnBase: React.CSSProperties = {
    border:'none', cursor:'pointer', fontFamily:'inherit', fontWeight:600,
    display:'flex', alignItems:'center', justifyContent:'center',
  }

  return (
    <div style={{position:'fixed',inset:0,zIndex:500,background:'#000',
      display:'flex',flexDirection:'column',fontFamily:"'Segoe UI',system-ui,sans-serif"}}>

      {/* Header bar */}
      <div style={{position:'absolute',top:0,left:0,right:0,padding:'12px 16px',zIndex:10,
        display:'flex',alignItems:'center',justifyContent:'space-between',
        background:'linear-gradient(to bottom,rgba(0,0,0,0.75),transparent)'}}>
        <span style={{color:'#fff',fontWeight:600,fontSize:'0.95rem'}}>
      {state==='captured' ? t('camera.title_preview') : t('camera.title_live')}
        </span>
        <button onClick={onClose} style={{...btnBase,
          background:'rgba(0,0,0,0.5)',border:'1px solid rgba(255,255,255,0.3)',
          color:'#fff',borderRadius:'50%',width:38,height:38,fontSize:'1rem'}}>
          ✕
        </button>
      </div>

      {/* Viewfinder */}
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',position:'relative'}}>
        <video ref={videoRef} autoPlay playsInline muted
          style={{width:'100%',height:'100%',objectFit:'cover',
            display:state==='live'||state==='starting'?'block':'none',
            opacity:state==='starting'?0.25:1,transition:'opacity 0.3s'}}/>

        {state==='captured'&&capturedUrl&&(
          <img src={capturedUrl} alt="Captured"
            style={{width:'100%',height:'100%',objectFit:'contain'}}/>
        )}

        {state==='starting'&&(
          <div style={{position:'absolute',color:C.muted,textAlign:'center'}}>
            <div style={{fontSize:'2.5rem',marginBottom:8}}>📷</div>
        <div style={{fontSize:'0.85rem'}}>{t('camera.starting')}</div>
          </div>
        )}

        {(state==='error'||state==='unsupported')&&(
          <div style={{position:'absolute',color:C.text,textAlign:'center',padding:28,maxWidth:340}}>
            <div style={{fontSize:'3rem',marginBottom:14}}>🚫</div>
            <div style={{fontSize:'0.88rem',color:C.muted,lineHeight:1.6,marginBottom:20}}>{errorMsg}</div>
            <button onClick={onClose} style={{...btnBase,
              background:C.accent,color:'#fff',borderRadius:10,
        padding:'11px 28px',fontSize:'0.9rem'}}>{t('camera.close')}</button>
          </div>
        )}
      </div>

      {/* Hidden capture canvas */}
      <canvas ref={canvasRef} style={{display:'none'}}/>

      {/* Bottom controls */}
      {(state==='live'||state==='captured')&&(
        <div style={{position:'absolute',bottom:0,left:0,right:0,
          padding:'20px 32px 44px',
          background:'linear-gradient(to top,rgba(0,0,0,0.8),transparent)',
          display:'flex',alignItems:'center',justifyContent:'space-around'}}>

          {state==='live'&&(
            <>
              {/* Flip */}
              <button onClick={flipCamera} title={t('camera.flip')}
                style={{...btnBase,background:'rgba(255,255,255,0.15)',
                  border:'1px solid rgba(255,255,255,0.3)',borderRadius:'50%',
                  width:52,height:52,color:'#fff',fontSize:'1.3rem'}}>
                🔄
              </button>

              {/* Shutter */}
              <button onClick={capture}
                style={{...btnBase,background:'#fff',
                  border:'5px solid rgba(255,255,255,0.45)',
                  borderRadius:'50%',width:80,height:80,
                  boxShadow:'0 0 0 3px rgba(255,255,255,0.25)',
                  transition:'transform 0.1s'}}
                onMouseDown={e=>(e.currentTarget.style.transform='scale(0.91)')}
                onMouseUp={e=>(e.currentTarget.style.transform='scale(1)')}
                onTouchStart={e=>(e.currentTarget.style.transform='scale(0.91)')}
                onTouchEnd={e=>(e.currentTarget.style.transform='scale(1)')}
              />

              {/* Spacer */}
              <div style={{width:52}}/>
            </>
          )}

          {state==='captured'&&(
            <>
              <button onClick={retake}
                style={{...btnBase,
                  background:'rgba(255,255,255,0.15)',
                  border:'1px solid rgba(255,255,255,0.4)',
                  color:'#fff',borderRadius:12,padding:'13px 30px',fontSize:'0.95rem'}}>
        {t('buttons.retake')}
              </button>
              <button onClick={usePhoto}
                style={{...btnBase,background:C.green,color:'#000',
                  borderRadius:12,padding:'13px 30px',fontSize:'0.95rem'}}>
        {t('buttons.use_photo')}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
