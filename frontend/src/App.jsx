import { useState, useEffect, useRef, useCallback } from 'react'
import { ThemeProvider, useTheme } from './hooks/useTheme.jsx'
import { AuthProvider, useAuth } from './hooks/useAuth.jsx'
import { DEVICES, EDGES, ALERTS, VULNS, STATS, genTimeline } from './data/mock.js'
import './styles/app.css'

/* ══════════════════════════════════════════════════
   ROOT
   ══════════════════════════════════════════════════ */
export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </ThemeProvider>
  )
}

function AppInner() {
  const { user, loading } = useAuth()
  const [page, setPage] = useState('landing') // 'landing' | 'dashboard'

  useEffect(() => {
    if (user) setPage('dashboard')
    else setPage('landing')
  }, [user])

  if (loading) return <Loader />
  if (page === 'dashboard' && user) return <Dashboard setPage={setPage} />
  return <Landing setPage={setPage} />
}

/* ══════════════════════════════════════════════════
   SHARED: LOADER
   ══════════════════════════════════════════════════ */
function Loader() {
  return (
    <div className="loader-screen">
      <div className="loader-shield">
        <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
          <path d="M16 3 L27 8 L27 18 C27 24 22 29 16 31 C10 29 5 24 5 18 L5 8 Z" stroke="var(--accent)" strokeWidth="1.5" fill="none"/>
          <circle cx="16" cy="17" r="4" fill="var(--accent)" opacity=".9"/>
        </svg>
      </div>
      <div className="loader-spinner" />
    </div>
  )
}

/* ══════════════════════════════════════════════════
   SHARED: THEME TOGGLE
   ══════════════════════════════════════════════════ */
function ThemeBtn({ className = '' }) {
  const { theme, toggle } = useTheme()
  return (
    <button className={`theme-btn ${className}`} onClick={toggle} aria-label="Toggle theme">
      {theme === 'dark'
        ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
      }
    </button>
  )
}

/* ══════════════════════════════════════════════════
   SPOTLIGHT HOOK
   ══════════════════════════════════════════════════ */
function useSpotlight() {
  const ref = useRef(null)
  const onMove = useCallback(e => {
    if (!ref.current) return
    const r = ref.current.getBoundingClientRect()
    ref.current.style.setProperty('--sx', `${((e.clientX-r.left)/r.width)*100}%`)
    ref.current.style.setProperty('--sy', `${((e.clientY-r.top)/r.height)*100}%`)
  }, [])
  const onLeave = useCallback(() => {
    if (!ref.current) return
    ref.current.style.setProperty('--sx', '50%')
    ref.current.style.setProperty('--sy', '50%')
  }, [])
  return { ref, onMouseMove: onMove, onMouseLeave: onLeave }
}

/* ══════════════════════════════════════════════════
   GLASS CARD COMPONENT
   ══════════════════════════════════════════════════ */
function Card({ children, className='', style={}, noHover=false, ...rest }) {
  const sp = useSpotlight()
  return (
    <div
      className={`glass spotlight ${noHover?'no-hover':''} ${className}`}
      style={style}
      {...sp}
      {...rest}
    >
      <div className="spotlight-layer" />
      {children}
    </div>
  )
}

/* ══════════════════════════════════════════════════
   LANDING PAGE
   ══════════════════════════════════════════════════ */
function Landing({ setPage }) {
  const { login, signup } = useAuth()

  // Parallax orbs
  const [scrollY, setScrollY] = useState(0)
  useEffect(() => {
    const h = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])

  // Reveal observer
  useEffect(() => {
    const els = document.querySelectorAll('.reveal')
    const obs = new IntersectionObserver(entries =>
      entries.forEach(e => e.isIntersecting && e.target.classList.add('visible')),
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    )
    els.forEach(e => obs.observe(e))
    return () => obs.disconnect()
  }, [])

  return (
    <div className="landing">
      <BgCanvas />
      <div className="noise" aria-hidden="true" />

      {/* NAV */}
      <nav className="land-nav">
        <div className="land-nav-inner">
          <div className="brand">
            <ShieldIcon />
            <span className="brand-name">CyberWatch</span>
            <span className="badge badge-live"><span className="pip" />LIVE</span>
          </div>
          <div className="land-nav-links">
            <a href="#hero">Home</a>
            <a href="#bento">Dashboard</a>
            <a href="#ai">AI Detection</a>
          </div>
          <div className="land-nav-right">
            <ThemeBtn />
            <a href="https://github.com/Ritika-Sorout/cyberwatch" target="_blank" rel="noopener" className="nav-gh" aria-label="GitHub">
              <GhIcon />
            </a>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section id="hero" className="hero">
        <div className="orbs" style={{ transform:`translateY(${scrollY*0.3}px)` }} aria-hidden="true">
          <div className="orb o1"/><div className="orb o2"/><div className="orb o3"/>
        </div>
        <div className="hero-inner">
          <HeroCopy setPage={setPage} />
          <AuthCard login={login} signup={signup} setPage={setPage} />
        </div>
        <div className="scroll-hint" aria-hidden="true">
          <span>scroll to explore</span>
          <div className="scroll-arr" />
        </div>
      </section>

      {/* BENTO */}
      <section id="bento" className="section">
        <SectionHeader eyebrow="Live Dashboard" title="Security Operations Center" sub="en0 · 172.17.81.0/24 · All systems nominal" />
        <BentoGrid setPage={setPage} />
      </section>

      {/* AI SECTION */}
      <section id="ai" className="section">
        <SectionHeader eyebrow="Novel Research" title="Behavioral Fingerprinting AI" sub="Detects zero-day malware with no signatures — purely from how devices behave" />
        <AnomalySection />
      </section>

      {/* FOOTER */}
      <LandingFooter setPage={setPage} />
    </div>
  )
}

/* ─── HERO COPY ─────────────────────────────────── */
function HeroCopy({ setPage }) {
  const { user } = useAuth()
  return (
    <div className="hero-copy">
      <div className="eyebrow fade-up" style={{animationDelay:'.1s'}}>
        <span className="pip accent-pip" />Real-Time Threat Intelligence
      </div>
      <h1 className="hero-title fade-up" style={{animationDelay:'.25s'}}>
        <Typewriter phrases={['Monitor Networks In Real-Time.','Detect Zero-Day Threats.','Fingerprint Every Device.','Respond Before Damage Spreads.']} />
      </h1>
      <p className="hero-sub fade-up" style={{animationDelay:'.4s'}}>
        Full-stack SOC platform capturing <strong>44,424 alerts</strong> and fingerprinting <strong>16 live hosts</strong> — powered by behavioral AI that catches zero-day threats no signature ever could.
      </p>
      <div className="hero-stats fade-up" style={{animationDelay:'.55s'}}>
        {[['44k+','Alerts'],['50k+','Signatures'],['<5s','Response'],['2.5σ','Threshold']].map(([v,l]) => (
          <div key={l} className="hstat"><span className="hstat-v mono">{v}</span><span className="hstat-l">{l}</span></div>
        ))}
      </div>
      <div className="hero-ctas fade-up" style={{animationDelay:'.7s'}}>
        <button className="cta-primary" onClick={() => {
          if (user) setPage('dashboard')
          else document.getElementById('auth-card')?.scrollIntoView({ behavior:'smooth' })
        }}>
          {user ? 'Open Dashboard' : 'Get Started'}
          <ArrowIcon />
        </button>
        <a href="https://github.com/Ritika-Sorout/cyberwatch" target="_blank" rel="noopener" className="cta-ghost">View Source</a>
      </div>
    </div>
  )
}

/* ─── TYPEWRITER ────────────────────────────────── */
function Typewriter({ phrases }) {
  const [text, setText] = useState('')
  const [pi, setPi] = useState(0)
  const [ci, setCi] = useState(0)
  const [del, setDel] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setText(phrases[0]); return }
    const phrase = phrases[pi]
    let timer
    if (!del) {
      if (ci < phrase.length) timer = setTimeout(() => { setText(phrase.slice(0,ci+1)); setCi(c=>c+1) }, 55)
      else timer = setTimeout(() => setDel(true), 2200)
    } else {
      if (ci > 0) timer = setTimeout(() => { setText(phrase.slice(0,ci-1)); setCi(c=>c-1) }, 28)
      else { setDel(false); setPi(p=>(p+1)%phrases.length); timer = setTimeout(()=>{},300) }
    }
    return () => clearTimeout(timer)
  }, [text, ci, del, pi, phrases])

  return <><span>{text}</span><span className="tw-cur" aria-hidden="true">|</span></>
}

/* ─── AUTH CARD ─────────────────────────────────── */
function AuthCard({ login, signup, setPage }) {
  const [tab, setTab] = useState('login')
  const [form, setForm] = useState({ name:'', email:'', pass:'' })
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [shaking, setShaking] = useState(false)
  const sp = useSpotlight()

  const set = k => e => setForm(f=>({...f,[k]:e.target.value}))

  const shake = () => { setShaking(true); setTimeout(()=>setShaking(false),500) }

  const submitLogin = e => {
    e.preventDefault(); setErr('')
    if (!form.email || !form.pass) return shake()
    const r = login(form.email, form.pass)
    if (r.error) { setErr(r.error); shake() }
    else { setOk(`Welcome back!`); setTimeout(() => setPage('dashboard'), 700) }
  }

  const submitSignup = e => {
    e.preventDefault(); setErr('')
    if (!form.email || !form.pass || form.pass.length < 6) return shake()
    const r = signup(form.email, form.pass, form.name)
    if (r.error) { setErr(r.error); shake() }
    else { setOk(`Account created!`); setTimeout(() => setPage('dashboard'), 700) }
  }

  return (
    <div id="auth-card" className={`auth-card glass spotlight fade-up ${shaking?'shake':''}`}
      style={{animationDelay:'.35s'}} {...sp}>
      <div className="spotlight-layer"/>
      <div className="auth-head">
        <div className="auth-avatar"><ShieldIcon /></div>
        <div><div className="auth-title">SOC Access</div><div className="auth-sub mono">Secure analyst portal</div></div>
      </div>
      <div className="auth-tabs" role="tablist">
        {['login','signup'].map(t => (
          <button key={t} className={`auth-tab ${tab===t?'active':''}`}
            role="tab" aria-selected={tab===t} onClick={()=>{setTab(t);setErr('');setOk('')}}>
            {t==='login'?'Sign In':'Sign Up'}
          </button>
        ))}
      </div>
      {err && <p className="auth-msg auth-err">{err}</p>}
      {ok  && <p className="auth-msg auth-ok">✓ {ok}</p>}
      {tab === 'login'
        ? <form onSubmit={submitLogin} className="auth-form">
            <Field label="Email"    id="le" type="email"    val={form.email} onChange={set('email')} ph="analyst@soc.io" />
            <Field label="Password" id="lp" type="password" val={form.pass}  onChange={set('pass')}  ph="••••••••" />
            <button className="form-btn" type="submit">Enter Dashboard</button>
            <p className="form-hint mono">Demo: any credentials work</p>
          </form>
        : <form onSubmit={submitSignup} className="auth-form">
            <Field label="Name"     id="sn" type="text"     val={form.name}  onChange={set('name')}  ph="Ritika Sorout" />
            <Field label="Email"    id="se" type="email"    val={form.email} onChange={set('email')} ph="analyst@soc.io" />
            <Field label="Password" id="sp" type="password" val={form.pass}  onChange={set('pass')}  ph="min 6 chars" minLength={6} />
            <button className="form-btn" type="submit">Create Account</button>
          </form>
      }
    </div>
  )
}

function Field({ label, id, val, onChange, ph, type='text', minLength }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type={type} value={val} onChange={onChange} placeholder={ph} minLength={minLength} />
    </div>
  )
}

/* ─── SECTION HEADER ────────────────────────────── */
function SectionHeader({ eyebrow, title, sub }) {
  return (
    <div className="sec-head reveal">
      <div className="eyebrow"><span className="pip accent-pip"/>{eyebrow}</div>
      <h2 className="sec-title">{title}</h2>
      <p className="sec-sub mono">{sub}</p>
    </div>
  )
}

/* ─── BENTO GRID ────────────────────────────────── */
function BentoGrid({ setPage }) {
  return (
    <div className="bento reveal">
      <Card className="b-network">
        <div className="card-row">
          <span className="card-title">Network Explorer</span>
          <span className="badge badge-live"><span className="pip"/>en0</span>
        </div>
        <NetworkMini />
        <div className="card-foot mono"><span>16 hosts</span><span>10 GB+/day</span></div>
      </Card>

      <Card className="b-alerts">
        <div className="card-row">
          <span className="card-title">Threat Alerts</span>
          <span className="badge badge-danger">3 Critical</span>
        </div>
        <AlertFeedMini />
      </Card>

      <Card className="b-devices">
        <div className="card-row">
          <span className="card-title">Device Status</span>
          <span className="badge badge-ok">8 Online</span>
        </div>
        <DeviceListMini />
      </Card>

      <Card className="b-stat">
        <div className="stat-big">
          <AnimCount to={44424} className="stat-num mono" />
          <span className="stat-label">Alerts Processed</span>
          <span className="stat-tiny mono">First live session</span>
        </div>
        <Sparkline />
      </Card>

      <Card className="b-stat">
        <div className="stat-big">
          <span className="stat-num mono">50k+</span>
          <span className="stat-label">IDS Signatures</span>
          <span className="stat-tiny mono">Emerging Threats</span>
        </div>
        <div className="mini-bars">
          {[88,72,95,61].map((w,i) => <div key={i} className="mini-bar-bg"><div className="mini-bar" style={{width:`${w}%`}}/></div>)}
        </div>
      </Card>

      <Card className="b-stat">
        <div className="stat-big">
          <span className="stat-num mono">&lt;5s</span>
          <span className="stat-label">Auto-Block</span>
          <span className="stat-tiny mono">pf + Slack + SMTP</span>
        </div>
        <RingChart pct={97} />
      </Card>

      <Card className="b-stack">
        <div className="card-row"><span className="card-title">Tech Stack</span><span className="badge badge-live">Running</span></div>
        <StackLayers />
      </Card>

      <Card className="b-cta" noHover>
        <div className="bento-cta-inner">
          <ShieldIcon big />
          <p>Ready to monitor your network in real-time?</p>
          <button className="cta-primary" onClick={() => document.getElementById('auth-card')?.scrollIntoView({behavior:'smooth'})}>
            Open Full Dashboard <ArrowIcon />
          </button>
        </div>
      </Card>
    </div>
  )
}

/* ─── NETWORK MINI CANVAS ───────────────────────── */
function NetworkMini() {
  const canvasRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let t = 0

    const resize = () => {
      const W = canvas.parentElement.clientWidth
      const H = 220
      canvas.width  = W * devicePixelRatio
      canvas.height = H * devicePixelRatio
      canvas.style.width  = W + 'px'
      canvas.style.height = H + 'px'
      ctx.scale(devicePixelRatio, devicePixelRatio)
    }

    resize()

    const STATUS = { normal:'#4caf82', warning:'#e8a838', anomaly:'#e8a838', critical:'#ff4f4f' }

    function draw() {
      const W = parseInt(canvas.style.width)
      const H = parseInt(canvas.style.height)
      ctx.clearRect(0, 0, W, H)
      t += 0.007
      const isDark = document.documentElement.getAttribute('data-theme') !== 'light'
      const edgeC  = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'
      const critC  = isDark ? 'rgba(255,79,79,.35)' : 'rgba(212,64,64,.35)'

      EDGES.forEach(({s, t: tt, traffic}) => {
        const na = DEVICES.find(d=>d.id===s)
        const nb = DEVICES.find(d=>d.id===tt)
        if (!na||!nb) return
        const isCrit = traffic==='critical'
        ctx.beginPath()
        ctx.moveTo(na.x*W, na.y*H)
        ctx.lineTo(nb.x*W, nb.y*H)
        ctx.strokeStyle = isCrit ? critC : edgeC
        ctx.lineWidth   = isCrit ? 1.5 : 1
        ctx.setLineDash(isCrit ? [4,4] : [])
        ctx.stroke(); ctx.setLineDash([])
      })

      // Animated data packet
      EDGES.forEach(({s, t: tt}, i) => {
        const na = DEVICES.find(d=>d.id===s)
        const nb = DEVICES.find(d=>d.id===tt)
        if (!na||!nb) return
        const ph = (t + i*0.28) % 1
        const px = na.x*W + (nb.x*W - na.x*W)*ph
        const py = na.y*H + (nb.y*H - na.y*H)*ph
        ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI*2)
        ctx.fillStyle = 'rgba(76,175,130,0.55)'
        ctx.fill()
      })

      DEVICES.forEach((d, idx) => {
        const x = d.x*W, y = d.y*H
        const col = STATUS[d.status] || STATUS.normal
        if (d.status !== 'normal') {
          const pulse = .5 + .5*Math.sin(t*4+idx)
          ctx.beginPath(); ctx.arc(x, y, 13+pulse*7, 0, Math.PI*2)
          ctx.strokeStyle = col+'33'; ctx.lineWidth = 1.5; ctx.stroke()
        }
        const g = ctx.createRadialGradient(x-2,y-2,1,x,y,10)
        g.addColorStop(0, isDark?'rgba(38,38,50,.95)':'rgba(255,252,240,.98)')
        g.addColorStop(1, isDark?'rgba(22,22,32,.95)':'rgba(235,225,205,.98)')
        ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI*2)
        ctx.fillStyle=g; ctx.fill()
        ctx.strokeStyle=col; ctx.lineWidth=2; ctx.stroke()
        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI*2)
        ctx.fillStyle=col; ctx.fill()
        ctx.font='600 8px Syne, sans-serif'
        ctx.fillStyle=isDark?'rgba(180,180,200,.7)':'rgba(60,60,80,.7)'
        ctx.textAlign='center'
        ctx.fillText(d.label, x, y+20)
      })

      rafRef.current = requestAnimationFrame(draw)
    }

    // Extend device positions for mini canvas
    DEVICES.forEach((d, i) => {
      if (d.x===undefined) {
        d.x = [.5,.22,.78,.15,.15,.82,.82,.5][i]||.5
        d.y = [.5,.22,.22,.55,.82,.55,.82,.88][i]||.5
      }
    })

    draw()
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  return <canvas ref={canvasRef} className="net-canvas" aria-label="Network topology"/>
}

// Ensure device positions exist
DEVICES.forEach((d, i) => {
  const xs = [.5,.2,.78,.15,.15,.82,.82,.5]
  const ys = [.5,.2,.22,.58,.82,.58,.88,.88]
  if (!d.x) { d.x = xs[i]||.5; d.y = ys[i]||.5 }
})

/* ─── ALERT FEED MINI ───────────────────────────── */
function AlertFeedMini() {
  const [alerts, setAlerts] = useState(ALERTS.slice(0,6))

  useEffect(() => {
    const id = setInterval(() => {
      const types = ['Port Scan','DNS Anomaly','Behavioral','XSS','C2 Beacon','Brute Force']
      const sevs  = ['critical','critical','high','medium']
      const sev   = sevs[Math.floor(Math.random()*sevs.length)]
      setAlerts(prev => [{
        id:'live-'+Date.now(), ts:Date.now(), sev,
        type: types[Math.floor(Math.random()*types.length)],
        src: `172.17.81.${Math.floor(Math.random()*254+1)}`,
        rule:'Real-time detection', blocked: sev==='critical',
      }, ...prev].slice(0,8))
    }, 4500)
    return () => clearInterval(id)
  }, [])

  return (
    <ul className="alert-list" aria-live="polite">
      {alerts.map(a => <AlertRow key={a.id} a={a} />)}
    </ul>
  )
}

function AlertRow({ a }) {
  const ago = Math.round((Date.now()-a.ts)/1000)
  const t = ago<60?`${ago}s`:ago<3600?`${Math.floor(ago/60)}m`:`${Math.floor(ago/3600)}h`
  return (
    <li className={`alert-row ar-${a.sev}`} style={{animation:'slide-in-right .3s ease both'}}>
      <span className={`asev badge-${a.sev}`}>{a.sev.slice(0,4).toUpperCase()}</span>
      <div className="alert-body">
        <span className="alert-type">{a.type}</span>
        <span className="alert-src mono">{a.src}</span>
      </div>
      <span className="alert-t mono">{t}</span>
      {a.blocked && <span className="blocked-tag">BLOCKED</span>}
    </li>
  )
}

/* ─── DEVICE LIST MINI ──────────────────────────── */
function DeviceListMini() {
  return (
    <ul className="dev-list">
      {DEVICES.map(d => (
        <li key={d.id} className="dev-row">
          <span className="dev-icon">{({router:'⬡',laptop:'▭',mobile:'▯',iot:'◈',server:'▣'})[d.type]||'○'}</span>
          <div className="dev-info">
            <span>{d.label}</span>
            <span className="mono">{d.ip}</span>
          </div>
          <span className={`status-pip sp-${d.status}`} aria-label={d.status}/>
        </li>
      ))}
    </ul>
  )
}

/* ─── ANIM COUNT ────────────────────────────────── */
function AnimCount({ to, className }) {
  const [v, setV] = useState(0)
  const ref = useRef(null)
  useEffect(() => {
    const obs = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) return
      obs.disconnect()
      const dur = 1500, start = performance.now()
      const tick = now => {
        const p = Math.min((now-start)/dur, 1)
        const e = 1-Math.pow(1-p, 3)
        setV(Math.round(e*to))
        if (p<1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }, { threshold:.5 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [to])
  return <span ref={ref} className={className}>{v.toLocaleString()}</span>
}

/* ─── SPARKLINE ─────────────────────────────────── */
function Sparkline() {
  const data = [12,18,14,22,19,28,24,32,25,30,26,35,28,38,32,40,35,42,38,45,50,60,72,85]
  const max = Math.max(...data)
  const W=100, H=28
  const pts = data.map((v,i)=>`${(i/(data.length-1))*W},${H-(v/max)*H}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} className="sparkline" aria-hidden="true">
      <polygon points={`${pts} ${W},${H} 0,${H}`} fill="var(--accent)" opacity=".08"/>
      <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

/* ─── RING CHART ────────────────────────────────── */
function RingChart({ pct }) {
  const r=22, circ=2*Math.PI*r
  return (
    <div className="ring-wrap" aria-hidden="true">
      <svg width="56" height="56" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={r} fill="none" stroke="currentColor" strokeWidth="3" opacity=".08"/>
        <circle cx="28" cy="28" r={r} fill="none" stroke="var(--accent)" strokeWidth="3"
          strokeDasharray={circ} strokeDashoffset={circ*(1-pct/100)}
          strokeLinecap="round" transform="rotate(-90 28 28)"/>
      </svg>
      <span className="ring-val mono">{pct}%</span>
    </div>
  )
}

/* ─── STACK LAYERS ──────────────────────────────── */
function StackLayers() {
  const layers = [
    { label:'Capture',   color:'var(--info)',    tags:['tshark','DPI Engine','Flow Track'] },
    { label:'Detection', color:'var(--accent)',  tags:['Suricata','Behavioral AI','Nmap NSE'] },
    { label:'Storage',   color:'var(--success)', tags:['Elasticsearch','Kibana','Logstash'] },
    { label:'Response',  color:'var(--danger)',  tags:['pf Firewall','Slack','SMTP'] },
  ]
  return (
    <div className="stack-layers">
      {layers.map(l => (
        <div key={l.label} className="stack-layer" style={{'--lc':l.color}}>
          <span className="sl-label mono">{l.label}</span>
          <div className="sl-tags">{l.tags.map(t => <span key={t} className="sl-tag mono">{t}</span>)}</div>
        </div>
      ))}
    </div>
  )
}

/* ─── ANOMALY SECTION ───────────────────────────── */
function AnomalySection() {
  return (
    <div className="anom-grid">
      <Card className="anom-explain reveal">
        <h3 className="card-title" style={{marginBottom:'20px'}}>How It Works</h3>
        {[
          ['01','60-Sample Baseline','Every device builds a rolling 1-hour behavioral baseline across 5 metrics: packets/min, bytes/min, DNS rate, unique destination IPs, and unique ports.'],
          ['02','Statistical Detection','When ≥2 metrics simultaneously deviate more than 2.5σ from baseline, a graded alert fires — regardless of whether the malware has a known signature.'],
          ['03','Zero-Day Capable','Caught a compromised IP Camera exfiltrating data at +4.2σ above normal — unknown malware that all 50,000 Suricata signatures missed entirely.'],
        ].map(([n,t,d]) => (
          <div key={n} className="ae-step">
            <div className="ae-num mono">{n}</div>
            <div><strong>{t}</strong><p>{d}</p></div>
          </div>
        ))}
      </Card>
      <Card className="anom-chart reveal">
        <div className="card-row">
          <span className="card-title mono">172.17.81.31 · IP Camera</span>
          <span className="badge badge-danger">+4.2σ</span>
        </div>
        <AnomalyChart />
        <div className="chart-legend">
          <span><span className="cl-dot cl-normal"/>Baseline</span>
          <span><span className="cl-dot cl-anom"/>Anomaly</span>
          <span><span className="cl-line"/>2.5σ threshold</span>
        </div>
      </Card>
      <div className="anom-metrics reveal">
        <h3 className="am-title">Live Metrics — IP Camera (172.17.81.31)</h3>
        <div className="am-grid">
          {[
            { label:'Packets/min', val:'18,240', sigma:'+4.2σ', bad:true,  pct:96 },
            { label:'DNS Rate',    val:'124/min', sigma:'+3.8σ', bad:true,  pct:88 },
            { label:'Dst IPs',     val:'88',      sigma:'+3.1σ', bad:true,  pct:79 },
            { label:'Bytes/min',   val:'1.2 MB',  sigma:'+1.1σ', bad:false, pct:42 },
            { label:'Dst Ports',   val:'71',      sigma:'+2.3σ', warn:true, pct:62 },
          ].map(m => (
            <Card key={m.label} className={`am-card ${m.bad?'am-bad':''}`}>
              <span className="am-label">{m.label}</span>
              <span className="am-val mono">{m.val}</span>
              <span className={`am-sig ${m.bad?'sig-bad':m.warn?'sig-warn':'sig-ok'}`}>{m.sigma}</span>
              <div className="am-bar"><div className="am-fill" style={{width:`${m.pct}%`, background: m.bad?'var(--danger)':m.warn?'var(--warn)':'var(--success)'}}/></div>
            </Card>
          ))}
        </div>
        <div className="verdict" role="status" aria-live="polite">
          <span className="pip" style={{background:'var(--danger)',animation:'pulse-pip 1s infinite'}}/>
          <strong>Verdict:</strong> Device compromised — C2 beacon pattern. Auto-blocked in 3.2s.
        </div>
      </div>
    </div>
  )
}

/* ─── ANOMALY CHART ─────────────────────────────── */
function AnomalyChart() {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const wrap = canvas.parentElement
    const W = wrap.clientWidth - 32 || 400
    const H = 180
    const DPR = devicePixelRatio||1
    canvas.width=W*DPR; canvas.height=H*DPR
    canvas.style.width=W+'px'; canvas.style.height=H+'px'
    const ctx=canvas.getContext('2d'); ctx.scale(DPR,DPR)
    const isDark = document.documentElement.getAttribute('data-theme')!=='light'
    const textC = isDark?'rgba(90,90,110,1)':'rgba(120,100,70,1)'
    const gridC = isDark?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.04)'
    const N=60, ANOM=42, BASE=80
    const data = Array.from({length:N},(_,i)=>i<ANOM?BASE+Math.random()*18-9:BASE+(i-ANOM)/(N-ANOM)*540+Math.random()*25)
    const max=Math.max(...data)*1.1
    const P={t:14,r:14,b:28,l:38}
    const cW=W-P.l-P.r, cH=H-P.t-P.b
    const px=i=>P.l+(i/(N-1))*cW, py=v=>P.t+cH-(v/max)*cH
    ctx.strokeStyle=gridC; ctx.lineWidth=1
    for(let i=0;i<=4;i++){const y=P.t+(i/4)*cH;ctx.beginPath();ctx.moveTo(P.l,y);ctx.lineTo(P.l+cW,y);ctx.stroke();ctx.fillStyle=textC;ctx.font='9px DM Mono, monospace';ctx.textAlign='right';ctx.fillText(Math.round(((4-i)/4)*max),P.l-5,y+3)}
    ctx.fillStyle=textC;ctx.font='9px DM Mono, monospace';ctx.textAlign='center'
    for(let i=0;i<=6;i++){const idx=Math.round((i/6)*(N-1));ctx.fillText(`-${N-1-idx}m`,px(idx),H-P.b+14)}
    ctx.fillStyle=isDark?'rgba(255,79,79,.06)':'rgba(212,64,64,.05)'
    ctx.fillRect(px(ANOM),P.t,cW-(px(ANOM)-P.l),cH)
    ctx.fillStyle=isDark?'rgba(255,79,79,.45)':'rgba(212,64,64,.4)';ctx.font='9.5px Syne,sans-serif';ctx.textAlign='left'
    ctx.fillText('⚠ Anomaly',px(ANOM)+5,P.t+13)
    const sigY=py(BASE+2.5*12)
    ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(P.l,sigY);ctx.lineTo(P.l+cW,sigY)
    ctx.strokeStyle=isDark?'rgba(255,255,255,.15)':'rgba(0,0,0,.12)';ctx.lineWidth=1;ctx.stroke();ctx.setLineDash([])
    ctx.fillStyle=textC;ctx.font='8px DM Mono,monospace';ctx.textAlign='left';ctx.fillText('2.5σ',P.l+4,sigY-4)
    ctx.beginPath()
    for(let i=0;i<=ANOM;i++) i?ctx.lineTo(px(i),py(data[i])):ctx.moveTo(px(i),py(data[i]))
    ctx.lineTo(px(ANOM),P.t+cH);ctx.lineTo(P.l,P.t+cH);ctx.closePath()
    const ng=ctx.createLinearGradient(0,P.t,0,P.t+cH);ng.addColorStop(0,'rgba(76,175,130,.22)');ng.addColorStop(1,'rgba(76,175,130,.02)')
    ctx.fillStyle=ng;ctx.fill()
    ctx.beginPath()
    for(let i=ANOM;i<N;i++) i===ANOM?ctx.moveTo(px(i),py(data[i])):ctx.lineTo(px(i),py(data[i]))
    ctx.lineTo(px(N-1),P.t+cH);ctx.lineTo(px(ANOM),P.t+cH);ctx.closePath()
    const ag=ctx.createLinearGradient(0,P.t,0,P.t+cH);ag.addColorStop(0,'rgba(255,79,79,.28)');ag.addColorStop(1,'rgba(255,79,79,.02)')
    ctx.fillStyle=ag;ctx.fill()
    ctx.beginPath();for(let i=0;i<=ANOM;i++) i?ctx.lineTo(px(i),py(data[i])):ctx.moveTo(px(i),py(data[i]))
    ctx.strokeStyle='#4caf82';ctx.lineWidth=2;ctx.lineJoin='round';ctx.stroke()
    ctx.beginPath();for(let i=ANOM;i<N;i++) i===ANOM?ctx.moveTo(px(i),py(data[i])):ctx.lineTo(px(i),py(data[i]))
    ctx.strokeStyle='#ff4f4f';ctx.lineWidth=2;ctx.stroke()
    for(let i=ANOM+4;i<N;i+=5){ctx.beginPath();ctx.arc(px(i),py(data[i]),3,0,Math.PI*2);ctx.fillStyle='#ff4f4f';ctx.fill()}
  }, [])
  return <canvas ref={canvasRef} className="anom-canvas" aria-label="Behavioral anomaly timeline"/>
}

/* ─── LANDING FOOTER ────────────────────────────── */
function LandingFooter({ setPage }) {
  const { user } = useAuth()
  return (
    <footer className="land-footer">
      <Card className="footer-inner" noHover>
        <div className="footer-brand">
          <ShieldIcon /><div><span className="brand-name">CyberWatch</span><span className="footer-tag">SOC Platform · Ritika Sorout · macOS M2</span></div>
        </div>
        <div className="footer-links">
          {user && <button className="cta-primary sm" onClick={()=>setPage('dashboard')}>Open Dashboard <ArrowIcon/></button>}
          <a href="https://github.com/Ritika-Sorout/cyberwatch" target="_blank" rel="noopener" className="footer-link"><GhIcon/>GitHub</a>
          <a href="https://app.netlify.com" target="_blank" rel="noopener" className="footer-link">↑ Netlify</a>
        </div>
        <div className="footer-meta mono">
          <span>Python 3.12 · React · ELK 8.11 · Suricata · FastAPI</span>
          <span>© 2026 Ritika Sorout</span>
        </div>
      </Card>
    </footer>
  )
}

/* ══════════════════════════════════════════════════
   DASHBOARD
   ══════════════════════════════════════════════════ */
function Dashboard({ setPage }) {
  const [tab, setTab] = useState('overview')
  const tabs = ['overview','network','alerts','behavior','vulns']

  return (
    <div className="dashboard">
      <DashNav tab={tab} setTab={setTab} setPage={setPage} tabs={tabs} />
      <main className="dash-main">
        {tab==='overview'  && <Overview  setTab={setTab} />}
        {tab==='network'   && <NetworkPage />}
        {tab==='alerts'    && <AlertsPage />}
        {tab==='behavior'  && <BehaviorPage />}
        {tab==='vulns'     && <VulnsPage />}
      </main>
    </div>
  )
}

/* ─── DASHBOARD NAV ─────────────────────────────── */
function DashNav({ tab, setTab, setPage, tabs }) {
  const { user, logout } = useAuth()
  return (
    <nav className="dash-nav">
      <div className="brand">
        <ShieldIcon />
        <span className="brand-name">CyberWatch</span>
        <span className="badge badge-live"><span className="pip"/>LIVE</span>
      </div>
      <div className="dash-tabs">
        {tabs.map(t => (
          <button key={t} className={`dash-tab ${tab===t?'active':''}`} onClick={()=>setTab(t)}>
            {t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
      </div>
      <div className="dash-nav-right">
        <ThemeBtn />
        <button className="dash-tab" onClick={()=>setPage('landing')} title="Back to landing">← Site</button>
        <div className="user-chip">
          <div className="user-av">{user?.name?.[0]?.toUpperCase()||'U'}</div>
          <span className="user-name">{user?.name}</span>
          <button className="logout-btn" onClick={logout} aria-label="Sign out">⎋</button>
        </div>
      </div>
    </nav>
  )
}

/* ─── OVERVIEW ──────────────────────────────────── */
function Overview({ setTab }) {
  return (
    <div className="dash-page fade-in">
      <div className="dash-header">
        <div><h2>Security Overview</h2><p className="mono">172.17.81.0/24 · en0 · Updated just now</p></div>
        <button className="cta-ghost sm" onClick={()=>exportPDF()}>↓ Export PDF</button>
      </div>
      <div className="overview-stats">
        {[
          { label:'Alerts Processed', val:44424,  color:'accent',  count:true },
          { label:'Hosts Discovered', val:16,      color:'info',    count:true },
          { label:'Critical Threats', val:3,       color:'danger',  count:true },
          { label:'Auto-Blocked',     val:5,       color:'success', count:true },
          { label:'Anomalies',        val:3,       color:'warn',    count:true },
          { label:'IDS Signatures',   val:'50k+',  color:'neutral'             },
        ].map(s => (
          <div key={s.label} className={`ov-stat glass ov-${s.color}`}>
            {s.count
              ? <AnimCount to={s.val} className="ov-num mono"/>
              : <span className="ov-num mono">{s.val}</span>
            }
            <span className="ov-label">{s.label}</span>
          </div>
        ))}
      </div>
      <div className="overview-grid">
        <Card className="ov-alerts-card">
          <div className="card-row"><span className="card-title">Recent Alerts</span>
            <button className="card-link" onClick={()=>setTab('alerts')}>All alerts →</button></div>
          <ul className="alert-list">{ALERTS.slice(0,6).map(a=><AlertRow key={a.id} a={a}/>)}</ul>
        </Card>
        <Card className="ov-devices-card">
          <div className="card-row"><span className="card-title">Device Status</span>
            <button className="card-link" onClick={()=>setTab('network')}>Network →</button></div>
          <DeviceListMini />
        </Card>
        <Card className="ov-arch-card">
          <div className="card-row"><span className="card-title">Stack Architecture</span><span className="badge badge-live">Running</span></div>
          <StackLayers />
        </Card>
      </div>
    </div>
  )
}

/* ─── NETWORK PAGE ──────────────────────────────── */
function NetworkPage() {
  const [sel, setSel] = useState(null)
  return (
    <div className="dash-page fade-in">
      <div className="dash-header"><div><h2>Network Topology</h2><p className="mono">16 hosts · Live · Click node to inspect</p></div></div>
      <div className="net-layout">
        <Card className="net-big">
          <NetworkFull onSelect={setSel} />
          <div className="net-legend">
            {['normal','warning','critical'].map(s=><span key={s} className={`legend-item li-${s}`}>{s}</span>)}
          </div>
        </Card>
        {sel
          ? <DeviceDetail device={sel} onClose={()=>setSel(null)} />
          : <div className="net-hint glass"><span>Click a node to inspect device</span></div>
        }
      </div>
    </div>
  )
}

function NetworkFull({ onSelect }) {
  const canvasRef = useRef(null)
  const rafRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let t = 0
    const resize = () => {
      const W=canvas.parentElement.clientWidth, H=canvas.parentElement.clientHeight||480
      canvas.width=W*devicePixelRatio; canvas.height=H*devicePixelRatio
      canvas.style.width=W+'px'; canvas.style.height=H+'px'
      ctx.scale(devicePixelRatio, devicePixelRatio)
    }
    resize()
    const STATUS={'normal':'#4caf82','warning':'#e8a838','anomaly':'#e8a838','critical':'#ff4f4f'}
    function draw() {
      const W=parseInt(canvas.style.width), H=parseInt(canvas.style.height)
      ctx.clearRect(0,0,W,H); t+=.007
      const dark=document.documentElement.getAttribute('data-theme')!=='light'
      EDGES.forEach(({s,t:tt,traffic})=>{
        const a=DEVICES.find(d=>d.id===s),b=DEVICES.find(d=>d.id===tt)
        if(!a||!b) return
        const crit=traffic==='critical'
        ctx.beginPath();ctx.moveTo(a.x*W,a.y*H);ctx.lineTo(b.x*W,b.y*H)
        ctx.strokeStyle=crit?(dark?'rgba(255,79,79,.4)':'rgba(212,64,64,.4)'):(dark?'rgba(255,255,255,.06)':'rgba(0,0,0,.07)')
        ctx.lineWidth=crit?2:1;ctx.setLineDash(crit?[4,4]:[]);ctx.stroke();ctx.setLineDash([])
      })
      EDGES.forEach(({s,t:tt},i)=>{
        const a=DEVICES.find(d=>d.id===s),b=DEVICES.find(d=>d.id===tt)
        if(!a||!b) return
        const ph=(t+i*.28)%1
        ctx.beginPath();ctx.arc(a.x*W+(b.x*W-a.x*W)*ph,a.y*H+(b.y*H-a.y*H)*ph,2.2,0,Math.PI*2)
        ctx.fillStyle='rgba(76,175,130,.55)';ctx.fill()
      })
      DEVICES.forEach((d,i)=>{
        const x=d.x*W,y=d.y*H,col=STATUS[d.status]||STATUS.normal
        if(d.status!=='normal'){const p=.5+.5*Math.sin(t*4+i);ctx.beginPath();ctx.arc(x,y,16+p*8,0,Math.PI*2);ctx.strokeStyle=col+'33';ctx.lineWidth=1.5;ctx.stroke()}
        const g=ctx.createRadialGradient(x-2,y-2,1,x,y,12)
        g.addColorStop(0,dark?'rgba(38,38,50,.95)':'rgba(255,252,240,.98)')
        g.addColorStop(1,dark?'rgba(22,22,32,.95)':'rgba(235,225,205,.98)')
        ctx.beginPath();ctx.arc(x,y,12,0,Math.PI*2);ctx.fillStyle=g;ctx.fill()
        ctx.strokeStyle=col;ctx.lineWidth=2.5;ctx.stroke()
        ctx.beginPath();ctx.arc(x,y,3.5,0,Math.PI*2);ctx.fillStyle=col;ctx.fill()
        ctx.font='600 9px Syne,sans-serif'
        ctx.fillStyle=dark?'rgba(180,180,200,.75)':'rgba(50,50,70,.75)'
        ctx.textAlign='center';ctx.fillText(d.label,x,y+24)
      })
      rafRef.current=requestAnimationFrame(draw)
    }
    draw()
    canvas.addEventListener('click',e=>{
      const r=canvas.getBoundingClientRect()
      const mx=(e.clientX-r.left), my=(e.clientY-r.top)
      const W=parseInt(canvas.style.width), H=parseInt(canvas.style.height)
      const hit=DEVICES.find(d=>{const dx=d.x*W-mx,dy=d.y*H-my;return Math.sqrt(dx*dx+dy*dy)<16})
      if(hit) onSelect(hit)
    })
    return ()=>{ if(rafRef.current)cancelAnimationFrame(rafRef.current) }
  },[onSelect])
  return <canvas ref={canvasRef} className="net-canvas-full" aria-label="Network topology graph"/>
}

function DeviceDetail({ device:d, onClose }) {
  const metrics=[
    {label:'Packets/min',val:d.pkts.toLocaleString()},
    {label:'KB/min',val:Math.round(d.bytes/1024)+'KB'},
    {label:'DNS rate',val:d.dns+'/min'},
    {label:'Dst IPs',val:d.dstIps},{label:'Dst Ports',val:d.ports},
  ]
  const statusLabel={normal:'Normal',warning:'Elevated',anomaly:'Anomaly Detected',critical:'Critical Threat'}
  const predictions={normal:{l:'Benign Traffic',c:97,cl:'success'},warning:{l:'Suspicious',c:71,cl:'warn'},anomaly:{l:'Possible C2 Beacon',c:84,cl:'warn'},critical:{l:'Compromised Device',c:94,cl:'danger'}}
  const pred=predictions[d.status]||predictions.normal
  return (
    <Card className="dev-detail fade-in">
      <div className="card-row"><div><div className="card-title">{d.label}</div><div className="mono" style={{fontSize:11,color:'var(--text3)'}}>{d.ip}</div></div>
        <button className="close-btn" onClick={onClose} aria-label="Close">✕</button></div>
      <div className={`status-row sr-${d.status}`}><span className="pip"/>{statusLabel[d.status]||d.status}</div>
      <div className="detail-metrics">
        {metrics.map(m=><div key={m.label} className="dm-row"><span>{m.label}</span><span className="mono">{m.val}</span></div>)}
      </div>
      <div className="ai-pred">
        <div className="card-row"><span className={`pred-label text-${pred.cl}`}>{pred.l}</span><span className="mono" style={{fontSize:12,color:'var(--text3)'}}>{pred.c}%</span></div>
        <div className="pred-bar"><div className={`pred-fill pf-${pred.cl}`} style={{width:`${pred.c}%`}}/></div>
        <p className="mono" style={{fontSize:10,color:'var(--text3)',marginTop:6}}>Behavioral fingerprinting · 2.5σ threshold</p>
      </div>
    </Card>
  )
}

/* ─── ALERTS PAGE ───────────────────────────────── */
function AlertsPage() {
  const [alerts,setAlerts]=useState(ALERTS)
  const [sev,setSev]=useState('all')
  const [q,setQ]=useState('')
  const [live,setLive]=useState(true)

  useEffect(()=>{
    if(!live) return
    const id=setInterval(()=>{
      const types=['Port Scan','DNS Anomaly','Behavioral','XSS','Brute Force','C2']
      const sevs=['critical','critical','high','medium','low']
      const s=sevs[Math.floor(Math.random()*sevs.length)]
      setAlerts(p=>[{id:'l'+Date.now(),ts:Date.now(),sev:s,type:types[Math.floor(Math.random()*types.length)],src:`172.17.81.${Math.floor(Math.random()*254+1)}`,rule:'Real-time',blocked:s==='critical'},...p].slice(0,200))
    },4000)
    return ()=>clearInterval(id)
  },[live])

  const filtered=alerts
    .filter(a=>sev==='all'||a.sev===sev)
    .filter(a=>!q||(a.type+a.src+a.rule).toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="dash-page fade-in">
      <div className="dash-header">
        <div><h2>Alert Feed</h2><p className="mono">{filtered.length} alerts · {alerts.filter(a=>a.blocked).length} auto-blocked</p></div>
        <label className="live-toggle"><input type="checkbox" checked={live} onChange={e=>setLive(e.target.checked)}/><span className="lt-track"><span className="lt-thumb"/></span>Live</label>
      </div>
      <div className="alerts-bar">
        {['all','critical','high','medium','low','info'].map(s=>(
          <button key={s} className={`sev-btn ${sev===s?'active':''} sb-${s}`} onClick={()=>setSev(s)}>
            {s==='all'?'All':s} {s!=='all'&&`(${alerts.filter(a=>a.sev===s).length})`}
          </button>
        ))}
        <input className="alert-search" type="search" placeholder="Search…" value={q} onChange={e=>setQ(e.target.value)}/>
      </div>
      <Card noHover className="alerts-table-wrap">
        <table className="alerts-table">
          <thead><tr><th>Time</th><th>Severity</th><th>Type</th><th>Source</th><th>Rule</th><th>Action</th></tr></thead>
          <tbody>
            {filtered.map((a,i)=>{
              const ago=Math.round((Date.now()-a.ts)/1000)
              const t=ago<2?'now':ago<60?`${ago}s`:ago<3600?`${Math.floor(ago/60)}m`:`${Math.floor(ago/3600)}h`
              return (
                <tr key={a.id} className={`atr atr-${a.sev} ${i===0&&live?'atr-new':''}`}>
                  <td className="mono">{t}</td>
                  <td><span className={`badge badge-${a.sev==='critical'?'danger':a.sev==='high'?'warn':a.sev==='medium'?'info':'neutral'}`}>{a.sev}</span></td>
                  <td style={{fontWeight:600}}>{a.type}</td>
                  <td className="mono" style={{color:'var(--text2)'}}>{a.src}</td>
                  <td style={{color:'var(--text2)',fontSize:12}}>{a.rule}</td>
                  <td>{a.blocked?<span className="badge badge-ok">BLOCKED</span>:<span className="badge badge-neutral">MONITOR</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

/* ─── BEHAVIOR PAGE ─────────────────────────────── */
function BehaviorPage() {
  const [selId, setSelId]=useState(DEVICES[2].id)
  const device=DEVICES.find(d=>d.id===selId)
  const series=genTimeline(device)
  return (
    <div className="dash-page fade-in">
      <div className="dash-header"><div><h2>Behavioral Fingerprinting</h2><p className="mono">60-min baseline · 2.5σ threshold · 5 metrics per device</p></div><span className="badge badge-danger" style={{padding:'6px 14px',fontSize:11}}>Novel Research</span></div>
      <div className="beh-explain">
        {[['📊','Baseline Learning','60-sample rolling window per device across 5 behavioral metrics.'],['⚡','Statistical Detection','≥2 metrics at >2.5σ simultaneously triggers a graded alert.'],['🎯','Zero-Day Capable','No signatures — detects novel malware from behavioral change alone.']].map(([ic,t,d])=>(
          <Card key={t} className="beh-card"><span className="beh-icon">{ic}</span><strong>{t}</strong><p>{d}</p></Card>
        ))}
      </div>
      <div className="beh-selector">
        {DEVICES.map(d=>(
          <button key={d.id} className={`dev-sel-btn ${selId===d.id?'active':''} dsel-${d.status}`} onClick={()=>setSelId(d.id)}>
            <span className={`pip sp-${d.status}`}/>{d.label}
          </button>
        ))}
      </div>
      <Card noHover className="beh-chart-card">
        <div className="card-row"><div><span className="card-title">{device.label}</span><span className="mono" style={{fontSize:11,marginLeft:10,color:'var(--text3)'}}>{device.ip}</span></div>
          <span className={`badge ${device.status==='critical'?'badge-danger':device.status==='warning'||device.status==='anomaly'?'badge-warn':'badge-ok'}`}>{device.status}</span></div>
        <BehChart series={series} />
        <div className="beh-metrics">
          {[
            {label:'Packets/min',val:device.pkts,base:Math.round(device.pkts*.55)},
            {label:'KB/min',val:Math.round(device.bytes/1024),base:Math.round(device.bytes/1024*.55)},
            {label:'DNS rate',val:device.dns,base:Math.round(device.dns*.5)},
            {label:'Dst IPs',val:device.dstIps,base:Math.round(device.dstIps*.5)},
            {label:'Dst Ports',val:device.ports,base:Math.round(device.ports*.5)},
          ].map(m=>{
            const sig=((m.val-m.base)/(m.base*.2||1)).toFixed(1)
            const bad=parseFloat(sig)>2.5
            return (
              <div key={m.label} className={`bm-item ${bad?'bm-bad':''}`}>
                <span className="bm-label">{m.label}</span>
                <span className="bm-val mono">{m.val.toLocaleString()}</span>
                <span className={`bm-sig mono ${bad?'sig-bad':'sig-ok'}`}>σ={sig}</span>
                <div className="bm-bar"><div className="bm-fill" style={{width:`${Math.min((m.val/(m.base*4))*100,100)}%`,background:bad?'var(--danger)':'var(--success)'}}/></div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

function BehChart({ series }) {
  const ref=useRef(null)
  useEffect(()=>{
    const canvas=ref.current; if(!canvas) return
    const W=canvas.parentElement.clientWidth-40||500, H=200, DPR=devicePixelRatio||1
    canvas.width=W*DPR; canvas.height=H*DPR; canvas.style.width=W+'px'; canvas.style.height=H+'px'
    const ctx=canvas.getContext('2d'); ctx.scale(DPR,DPR)
    const dark=document.documentElement.getAttribute('data-theme')!=='light'
    const tC=dark?'rgba(85,85,110,1)':'rgba(110,95,65,1)'
    const vals=series.map(p=>p.v)
    const max=Math.max(...vals)*1.15||1
    const P={t:14,r:14,b:28,l:44}, cW=W-P.l-P.r, cH=H-P.t-P.b
    const px=i=>P.l+(i/(series.length-1))*cW, py=v=>P.t+cH-(v/max)*cH
    ctx.strokeStyle=dark?'rgba(255,255,255,.04)':'rgba(0,0,0,.04)'; ctx.lineWidth=1
    for(let i=0;i<=4;i++){const y=P.t+(i/4)*cH;ctx.beginPath();ctx.moveTo(P.l,y);ctx.lineTo(P.l+cW,y);ctx.stroke();ctx.fillStyle=tC;ctx.font='9px DM Mono,monospace';ctx.textAlign='right';ctx.fillText(Math.round(((4-i)/4)*max),P.l-5,y+3)}
    ctx.fillStyle=tC; ctx.font='9px DM Mono,monospace'; ctx.textAlign='center'
    for(let i=0;i<=6;i++){const idx=Math.round((i/6)*(series.length-1));ctx.fillText(`-${series.length-1-idx}m`,px(idx),H-P.b+14)}
    const aStart=series.findIndex(p=>p.anomaly)
    if(aStart>-1){ctx.fillStyle=dark?'rgba(255,79,79,.06)':'rgba(212,64,64,.05)';ctx.fillRect(px(aStart),P.t,cW-(px(aStart)-P.l),cH);ctx.fillStyle=dark?'rgba(255,79,79,.4)':'rgba(212,64,64,.35)';ctx.font='9px Syne,sans-serif';ctx.textAlign='left';ctx.fillText('⚠ Anomaly',px(aStart)+4,P.t+13)}
    const mean=vals.slice(0,aStart>0?aStart:vals.length).reduce((a,b)=>a+b,0)/(aStart>0?aStart:vals.length)
    const mY=py(mean); ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(P.l,mY);ctx.lineTo(P.l+cW,mY);ctx.strokeStyle=dark?'rgba(255,255,255,.12)':'rgba(0,0,0,.1)';ctx.lineWidth=1;ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=tC;ctx.font='8px DM Mono,monospace';ctx.textAlign='left';ctx.fillText('baseline',P.l+4,mY-4)
    ctx.beginPath(); series.forEach((p,i)=>i?ctx.lineTo(px(i),py(p.v)):ctx.moveTo(px(i),py(p.v)))
    ctx.strokeStyle=series[series.length-1].anomaly?'#ff4f4f':'#4caf82'; ctx.lineWidth=2; ctx.lineJoin='round'; ctx.stroke()
    series.filter(p=>p.anomaly).forEach((p,i)=>{const idx=series.indexOf(p);ctx.beginPath();ctx.arc(px(idx),py(p.v),3.5,0,Math.PI*2);ctx.fillStyle='#ff4f4f';ctx.fill()})
  },[series])
  return <canvas ref={ref} className="beh-canvas" aria-label="Behavioral timeline"/>
}

/* ─── VULNS PAGE ────────────────────────────────── */
function VulnsPage() {
  const [sel,setSel]=useState(null)
  const crit=VULNS.filter(v=>v.cvss>=9).length
  const exp=VULNS.filter(v=>v.exploit).length
  const cvssColor=s=>s>=9?'var(--danger)':s>=7?'var(--warn)':s>=4?'var(--info)':'var(--success)'
  const rem={'CVE-2021-44228':'Upgrade Log4j to 2.17.1+. Block outbound LDAP/RMI.','CVE-2022-0847':'Upgrade Linux kernel to 5.16.11+.','CVE-2023-44487':'Upgrade nginx to 1.25.3+. Rate-limit HTTP/2.','CVE-2021-3156':'Upgrade sudo to 1.9.5p2+.','CVE-2024-1086':'Upgrade kernel to 6.6.15+.'}
  return (
    <div className="dash-page fade-in">
      <div className="dash-header">
        <div><h2>Vulnerability Intelligence</h2><p className="mono">Nmap NSE · CVE extraction · Metasploit verification</p></div>
        <div style={{display:'flex',gap:10}}>
          <span className="badge badge-danger" style={{padding:'6px 12px',fontSize:11}}>{crit} Critical</span>
          <span className="badge badge-warn"   style={{padding:'6px 12px',fontSize:11}}>{exp} Exploitable</span>
        </div>
      </div>
      <div className="vulns-layout">
        <div className="vulns-list">
          {VULNS.map(v=>(
            <Card key={v.id} className={`vuln-card ${sel===v.id?'vuln-selected':''}`} onClick={()=>setSel(sel===v.id?null:v.id)}>
              <div className="card-row">
                <div><span className="vuln-cve mono">{v.cve}</span><span className="vuln-service">{v.service} · {v.host}</span></div>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <span className="vuln-score mono" style={{color:cvssColor(v.cvss)}}>{v.cvss.toFixed(1)}</span>
                  {v.exploit&&<span className="badge badge-danger">EXPLOIT</span>}
                </div>
              </div>
              <p className="vuln-desc">{v.desc}</p>
              {sel===v.id&&(
                <div className="vuln-exp fade-in">
                  <div className="vuln-detail-grid">
                    {[['Host',v.host],['Service',v.service],['CVSS',v.cvss.toFixed(1)],['Metasploit',v.exploit?'✓ Module available':'✗ No module']].map(([l,val])=>(
                      <div key={l} className="vdg-item"><span className="vdg-label">{l}</span><span className="mono">{val}</span></div>
                    ))}
                  </div>
                  <div className="rem-box"><p className="rem-title">Recommended Action</p><p>{rem[v.cve]||'Apply vendor patch immediately.'}</p></div>
                </div>
              )}
            </Card>
          ))}
        </div>
        <div className="vulns-side">
          <Card noHover className="vsb">
            <h3 className="card-title" style={{marginBottom:14}}>Scan Coverage</h3>
            {[['Hosts Scanned','16/16'],['Scan Type','Full + NSE'],['Frequency','Every 60 min'],['CVE Database','NVD + Mitre'],['Verification','Metasploit RPC']].map(([l,v])=>(
              <div key={l} className="vsb-row"><span>{l}</span><span className="mono">{v}</span></div>
            ))}
          </Card>
          <Card noHover className="vsb">
            <h3 className="card-title" style={{marginBottom:14}}>CVSS Distribution</h3>
            {[{l:'Critical (9+)',min:9,c:'var(--danger)'},{l:'High (7-8.9)',min:7,c:'var(--warn)'},{l:'Medium (4-6.9)',min:4,c:'var(--info)'},{l:'Low (<4)',min:0,c:'var(--success)'}].map(b=>{
              const cnt=VULNS.filter(v=>v.cvss>=b.min&&(b.min===9?true:v.cvss<b.min+(b.min===7?2:b.min===4?3:4))).length
              return <div key={b.l} className="cvss-row"><span style={{fontSize:10,color:'var(--text3)',minWidth:90}}>{b.l}</span><div className="cvss-bar-bg"><div className="cvss-bar-fill" style={{width:`${(cnt/VULNS.length)*100}%`,background:b.c}}/></div><span className="mono" style={{fontSize:11,minWidth:14,textAlign:'right'}}>{cnt}</span></div>
            })}
          </Card>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════
   ICONS
   ══════════════════════════════════════════════════ */
function ShieldIcon({ big }) {
  const s = big ? 40 : 22
  return (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M16 3 L27 8 L27 18 C27 24 22 29 16 31 C10 29 5 24 5 18 L5 8 Z" stroke="var(--accent)" strokeWidth="1.5" fill="none"/>
      <circle cx="16" cy="17" r="4" fill="var(--accent)" opacity=".9"/>
      <line x1="16" y1="12" x2="16" y2="8" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}
function ArrowIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
}
function GhIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/></svg>
}

/* ══════════════════════════════════════════════════
   BACKGROUND CANVAS
   ══════════════════════════════════════════════════ */
function BgCanvas() {
  const ref=useRef(null)
  useEffect(()=>{
    const canvas=ref.current; if(!canvas) return
    const ctx=canvas.getContext('2d')
    let W,H,particles=[],raf
    const N=55
    const rand=(a,b)=>Math.random()*(b-a)+a
    class P{constructor(){this.reset()}reset(){this.x=rand(0,W);this.y=rand(0,H);this.vx=rand(-.15,.15);this.vy=rand(-.08,-.25);this.r=rand(1,2.2);this.a=rand(.05,.25);this.life=rand(80,200);this.max=this.life}update(){this.x+=this.vx;this.y+=this.vy;this.life--;if(this.life<=0||this.y<-10)this.reset()}draw(){const dark=document.documentElement.getAttribute('data-theme')!=='light';const alpha=this.a*(this.life/this.max);ctx.beginPath();ctx.arc(this.x,this.y,this.r,0,Math.PI*2);ctx.fillStyle=dark?`rgba(255,111,97,${alpha})`:`rgba(111,168,220,${alpha})`;ctx.fill()}}
    const resize=()=>{W=canvas.width=window.innerWidth;H=canvas.height=window.innerHeight;if(!particles.length)for(let i=0;i<N;i++)particles.push(new P())}
    const loop=()=>{ctx.clearRect(0,0,W,H);const dark=document.documentElement.getAttribute('data-theme')!=='light';particles.forEach(p=>{p.update();p.draw()});for(let i=0;i<particles.length;i++)for(let j=i+1;j<particles.length;j++){const dx=particles[i].x-particles[j].x,dy=particles[i].y-particles[j].y,d=Math.sqrt(dx*dx+dy*dy);if(d<110){const a=(1-d/110)*.055;ctx.beginPath();ctx.moveTo(particles[i].x,particles[i].y);ctx.lineTo(particles[j].x,particles[j].y);ctx.strokeStyle=dark?`rgba(255,111,97,${a})`:`rgba(111,168,220,${a})`;ctx.lineWidth=.7;ctx.stroke()}};raf=requestAnimationFrame(loop)}
    window.addEventListener('resize',resize,{passive:true});resize();loop()
    return ()=>{cancelAnimationFrame(raf);window.removeEventListener('resize',resize)}
  },[])
  return <canvas ref={ref} className="bg-canvas" aria-hidden="true"/>
}

/* ══════════════════════════════════════════════════
   PDF EXPORT
   ══════════════════════════════════════════════════ */
async function exportPDF() {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')
  const doc = new jsPDF()
  const W = doc.internal.pageSize.getWidth()
  doc.setFillColor(13,13,16); doc.rect(0,0,W,26,'F')
  doc.setFont('helvetica','bold'); doc.setFontSize(16); doc.setTextColor(255,111,97)
  doc.text('CYBERWATCH',14,11)
  doc.setFontSize(9); doc.setTextColor(160,160,180)
  doc.text('Security Operations Center Report',14,19)
  doc.text(new Date().toLocaleString(),W-14,19,{align:'right'})
  autoTable(doc,{startY:30,head:[['Metric','Value']],body:[['Alerts Processed',STATS.alerts.toLocaleString()],['Hosts','16'],['Signatures','50,000+'],['Response','<5s']],headStyles:{fillColor:[255,111,97]},styles:{fontSize:9}})
  autoTable(doc,{startY:doc.lastAutoTable.finalY+8,head:[['Time','Severity','Type','Source','Blocked']],body:ALERTS.slice(0,8).map(a=>[new Date(a.ts).toLocaleTimeString(),a.sev.toUpperCase(),a.type,a.src,a.blocked?'YES':'no']),headStyles:{fillColor:[30,30,36],textColor:[240,240,245]},styles:{fontSize:8}})
  doc.save(`cyberwatch-${Date.now()}.pdf`)
}
