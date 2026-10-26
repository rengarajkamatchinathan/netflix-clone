'use client'
import { useRef, useState, type ComponentType } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCatalog } from '@/context/CatalogContext'
import { Footer, Logo, PosterArt } from '@/components/ui'
import { ChevronLeft, ChevronRight, Download, Plus, Smile, Telescope, Tv, type IconProps } from '@/components/icons'

const FAQS: [string, string][] = [
  ['What is StreamFlix?', 'StreamFlix is a demo streaming service with films, series and nostalgic kids channels you can watch live, all in one place.'],
  ['How much does StreamFlix cost?', 'Nothing. This is a demo project, so there are no plans or payments.'],
  ['Where can I watch?', 'Anywhere with a modern browser: laptop, tablet or phone.'],
  ['What are Channels?', 'Channels bring back the feeling of classic kids TV. Pick one, press Watch Live, and shows play back-to-back on a schedule.'],
  ['Is StreamFlix good for kids?', 'Yes. The kids channels are full of family-friendly cartoons, and every family member can have their own profile.'],
]

const REASONS: [string, string, ComponentType<IconProps>][] = [
  ['Watch on your TV', 'Smart TVs, consoles, streaming sticks and more.', Tv],
  ['Download to watch offline', 'Save favourites so there is always something to watch.', Download],
  ['Relive kids TV, live', 'Action, cartoon and anime channels, playing back-to-back.', Telescope],
  ['Profiles for kids', 'Kids get their own space with shows made for them.', Smile],
]

export function Backdrop() {
  const { titles } = useCatalog()
  return (
    <div className="backdrop">
      <div className="backdrop-grid">{[...titles, ...titles].slice(0, 60).map((t, i) => <PosterArt key={i} t={t} wide={false} />)}</div>
      <div className="backdrop-shade" />
    </div>
  )
}

function EmailCta() {
  const [email, setEmail] = useState('')
  const router = useRouter()
  return (
    <form className="email-cta" onSubmit={e => { e.preventDefault(); router.push(`/signup?email=${encodeURIComponent(email)}`) }}>
      <p>Ready to watch? Enter your email to create or restart your membership.</p>
      <div>
        <label className="float pill"><input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder=" " /><span>Email address</span></label>
        <button className="btn red big">Get Started <ChevronRight size={24} /></button>
      </div>
    </form>
  )
}

function Trending() {
  const { titles } = useCatalog()
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const scroll = (d: number) => ref.current!.scrollBy({ left: d * ref.current!.clientWidth * 0.8, behavior: 'smooth' })
  return (
    <section className="trending">
      <h2>Trending Now</h2>
      <div className="trending-wrap">
        <button className="trend-arrow left" onClick={() => scroll(-1)}><ChevronLeft size={18} /></button>
        <div className="trending-track" ref={ref}>
          {titles.slice(0, 10).map((t, i) => (
            <button key={t.id} className="trend-item" onClick={() => router.push('/signup')}>
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
  const [open, setOpen] = useState<number | null>(null)
  return (
    <div className="landing">
      <section className="landing-hero">
        <Backdrop />
        <header className="landing-nav">
          <Logo size={44} />
          <div>
            <select className="lang" aria-label="Language"><option>English</option><option>हिन्दी</option><option>தமிழ்</option></select>
            <Link className="btn red small" href="/login">Sign In</Link>
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
