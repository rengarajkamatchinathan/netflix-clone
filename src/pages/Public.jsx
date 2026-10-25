import { useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { titles } from '../data/catalog'
import { Footer, Logo, PosterArt } from '../components/ui'
import { ChevronLeft, ChevronRight, Download, Plus, Telescope, Tv, Smile } from '../components/icons'

const FAQS = [
  ['What is StreamFlix?', 'StreamFlix is a demo streaming service with films, series and nostalgic kids channels you can watch live, all in one place.'],
  ['How much does StreamFlix cost?', 'Nothing. This is a demo project, so there are no plans or payments.'],
  ['Where can I watch?', 'Anywhere with a modern browser: laptop, tablet or phone.'],
  ['What are Channels?', 'Channels bring back the feeling of classic kids TV. Pick one, press Watch Live, and shows play back-to-back on a schedule.'],
  ['Is StreamFlix good for kids?', 'Yes. The kids channels are full of family-friendly cartoons, and every family member can have their own profile.'],
]

const REASONS = [
  ['Watch on your TV', 'Smart TVs, consoles, streaming sticks and more.', Tv],
  ['Download to watch offline', 'Save favourites so there is always something to watch.', Download],
  ['Relive kids TV, live', 'Action, cartoon and anime channels, playing back-to-back.', Telescope],
  ['Profiles for kids', 'Kids get their own space with shows made for them.', Smile],
]

function Backdrop() {
  return (
    <div className="backdrop">
      <div className="backdrop-grid">{[...titles, ...titles].slice(0, 60).map((t, i) => <PosterArt key={i} t={t} wide={false} />)}</div>
      <div className="backdrop-shade" />
    </div>
  )
}

function EmailCta() {
  const [email, setEmail] = useState('')
  const nav = useNavigate()
  return (
    <form className="email-cta" onSubmit={e => { e.preventDefault(); nav('/signup', { state: { email } }) }}>
      <p>Ready to watch? Enter your email to create or restart your membership.</p>
      <div>
        <label className="float pill"><input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder=" " /><span>Email address</span></label>
        <button className="btn red big">Get Started <ChevronRight size={24} /></button>
      </div>
    </form>
  )
}

function Trending() {
  const ref = useRef()
  const nav = useNavigate()
  const scroll = d => ref.current.scrollBy({ left: d * ref.current.clientWidth * 0.8, behavior: 'smooth' })
  return (
    <section className="trending">
      <h2>Trending Now</h2>
      <div className="trending-wrap">
        <button className="trend-arrow left" onClick={() => scroll(-1)}><ChevronLeft size={18} /></button>
        <div className="trending-track" ref={ref}>
          {titles.slice(0, 10).map((t, i) => (
            <button key={t.id} className="trend-item" onClick={() => nav('/signup')}>
              <PosterArt t={t} wide={false} />
              <span className="trend-num">{i + 1}</span>
            </button>
          ))}
        </div>
        <button className="trend-arrow right" onClick={() => scroll(1)}><ChevronRight size={18} /></button>
      </div>
    </section>
  )
}

export function Landing() {
  const [open, setOpen] = useState(null)
  return (
    <div className="landing">
      <section className="landing-hero">
        <Backdrop />
        <header className="landing-nav">
          <Logo size={44} />
          <div>
            <select className="lang" aria-label="Language"><option>English</option><option>हिन्दी</option><option>தமிழ்</option></select>
            <Link className="btn red small" to="/login">Sign In</Link>
          </div>
        </header>
        <div className="landing-copy">
          <h1>Films, series and the cartoon channels you grew up with</h1>
          <h3>Free to watch. No card needed.</h3>
          <EmailCta />
        </div>
      </section>
      <div className="curve"><div /></div>

      <div className="landing-inner">
        <Trending />
        <section className="reasons">
          <h2>More Reasons to Join</h2>
          <div className="reason-grid">
            {REASONS.map(([h, p, Icon]) => (
              <div key={h} className="reason">
                <h3>{h}</h3><p>{p}</p>
                <span className="reason-icon"><Icon size={64} /></span>
              </div>
            ))}
          </div>
        </section>
        <section className="faq">
          <h2>Frequently Asked Questions</h2>
          {FAQS.map(([q, a], i) => (
            <div key={q} className={`faq-item ${open === i ? 'open' : ''}`}>
              <button onClick={() => setOpen(open === i ? null : i)}>{q}<span className="faq-icon"><Plus size={36} sw={1.5} /></span></button>
              <div className="faq-a"><div><p>{a}</p></div></div>
            </div>
          ))}
          <EmailCta />
        </section>
      </div>
      <Footer />
    </div>
  )
}

export function AuthPage({ mode }) {
  const { signIn, signUp } = useApp()
  const nav = useNavigate()
  const loc = useLocation()
  const [email, setEmail] = useState(loc.state?.email || '')
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [err, setErr] = useState('')
  const [touched, setTouched] = useState({})
  const isUp = mode === 'signup'
  const emailBad = touched.email && !/^\S+@\S+\.\S+$/.test(email)
  const pwBad = touched.pw && (pw.length < 4 || pw.length > 60)

  const submit = e => {
    e.preventDefault()
    setTouched({ email: true, pw: true })
    if (!/^\S+@\S+\.\S+$/.test(email) || pw.length < 4 || pw.length > 60) return
    const error = isUp ? signUp(email, pw) : signIn(email, pw)
    if (error) return setErr(error)
    nav('/profiles')
  }

  return (
    <div className="auth">
      <Backdrop />
      <header className="landing-nav"><Link to="/"><Logo size={44} /></Link></header>
      <form className="auth-card" onSubmit={submit} noValidate>
        <h1>{isUp ? 'Sign Up' : 'Sign In'}</h1>
        {err && <div className="auth-err"><b>{isUp ? 'Hmm…' : 'Incorrect details.'}</b> {err}</div>}
        <div>
          <label className={`float ${emailBad ? 'bad' : ''}`}><input value={email} onChange={e => setEmail(e.target.value)} onBlur={() => setTouched(s => ({ ...s, email: true }))} placeholder=" " /><span>Email or mobile number</span></label>
          {emailBad && <p className="field-err">ⓧ Please enter a valid email address.</p>}
        </div>
        <div>
          <label className={`float ${pwBad ? 'bad' : ''}`}>
            <input type={show ? 'text' : 'password'} value={pw} onChange={e => setPw(e.target.value)} onBlur={() => setTouched(s => ({ ...s, pw: true }))} placeholder=" " /><span>Password</span>
            {pw && <button type="button" className="show-pw" onClick={() => setShow(!show)}>{show ? 'HIDE' : 'SHOW'}</button>}
          </label>
          {pwBad && <p className="field-err">ⓧ Your password must contain between 4 and 60 characters.</p>}
        </div>
        <button className="btn red full">{isUp ? 'Sign Up' : 'Sign In'}</button>
        {!isUp && <><div className="or">OR</div><button type="button" className="btn grey full">Use a sign-in code</button><a className="center link" href="#">Forgot password?</a></>}
        <label className="remember"><input type="checkbox" defaultChecked /> Remember me</label>
        <p className="switch">
          {isUp ? <>Already have an account? <Link to="/login">Sign in now.</Link></> : <>New to StreamFlix? <Link to="/signup">Sign up now.</Link></>}
        </p>
        <p className="fine">Demo only. Accounts are stored in this browser. Don't use a real password.</p>
      </form>
    </div>
  )
}
