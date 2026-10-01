import { useEffect, useState, lazy, Suspense } from 'react'
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import ChatBot from './components/ChatBot'
import { AppContext } from './lib/store'
import type { Lang } from './lib/i18n'
import Home from './pages/Home'

const About = lazy(() => import('./pages/About'))
const Policy = lazy(() => import('./pages/Policy'))
const ElNino = lazy(() => import('./pages/ElNino'))
const Tana = lazy(() => import('./pages/Tana'))
const Health = lazy(() => import('./pages/Health'))
const NBS = lazy(() => import('./pages/NBS'))
const Community = lazy(() => import('./pages/Community'))
const Gallery = lazy(() => import('./pages/Gallery'))
const Report = lazy(() => import('./pages/Report'))

function ScrollTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

export default function App() {
  const [lang, setLangState] = useState<Lang>(() => {
    try { return (localStorage.getItem('csg-lang') as Lang) || 'en' } catch { return 'en' }
  })
  const setLang = (l: Lang) => { setLangState(l); try { localStorage.setItem('csg-lang', l) } catch { /* private mode */ } }
  useEffect(() => { document.documentElement.lang = lang === 'so' ? 'so' : lang }, [lang])
  return (
    <AppContext.Provider value={{ lang, setLang }}>
      <HashRouter>
        <ScrollTop />
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[2000] focus:rounded focus:bg-white focus:p-2">Skip to content</a>
        <Header />
        <main id="main">
          <Suspense fallback={<div className="p-20 text-center text-muted">Loading…</div>}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/about" element={<About />} />
              <Route path="/policy" element={<Policy />} />
              <Route path="/elnino" element={<ElNino />} />
              <Route path="/tana" element={<Tana />} />
              <Route path="/health" element={<Health />} />
              <Route path="/nbs" element={<NBS />} />
              <Route path="/community" element={<Community />} />
              <Route path="/gallery" element={<Gallery />} />
              <Route path="/report" element={<Report />} />
              <Route path="*" element={<Home />} />
            </Routes>
          </Suspense>
        </main>
        <Footer />
        <ChatBot />
      </HashRouter>
    </AppContext.Provider>
  )
}
