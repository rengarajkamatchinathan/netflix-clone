import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
import { AuthPage, Landing } from './pages/Public'
import Profiles from './pages/Profiles'
import { BrowsePage, ChannelPage, ChannelsPage, MyListPage, SearchPage } from './pages/Main'
import { LivePage, WatchPage } from './pages/Player'
import { BrowseProvider } from './components/Browse'
import './styles.css'

function Guard({ children, needProfile = true }) {
  const { user, profile } = useApp()
  if (!user) return <Navigate to="/login" replace />
  if (needProfile && !profile) return <Navigate to="/profiles" replace />
  return children
}

function PublicOnly({ children }) {
  const { user } = useApp()
  return user ? <Navigate to="/profiles" replace /> : children
}

function ScrollTop() {
  const { pathname } = useLocation()
  React.useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppProvider>
      <BrowserRouter>
        <ScrollTop />
        <BrowseProvider>
        <Routes>
          <Route path="/" element={<PublicOnly><Landing /></PublicOnly>} />
          <Route path="/login" element={<PublicOnly><AuthPage mode="login" /></PublicOnly>} />
          <Route path="/signup" element={<PublicOnly><AuthPage mode="signup" /></PublicOnly>} />
          <Route path="/profiles" element={<Guard needProfile={false}><Profiles /></Guard>} />
          <Route path="/browse" element={<Guard><BrowsePage /></Guard>} />
          <Route path="/browse/:type" element={<Guard><BrowsePage /></Guard>} />
          <Route path="/channels" element={<Guard><ChannelsPage /></Guard>} />
          <Route path="/channel/:id" element={<Guard><ChannelPage /></Guard>} />
          <Route path="/live/:id" element={<Guard><LivePage /></Guard>} />
          <Route path="/watch/:id" element={<Guard><WatchPage /></Guard>} />
          <Route path="/my-list" element={<Guard><MyListPage /></Guard>} />
          <Route path="/search" element={<Guard><SearchPage /></Guard>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </BrowseProvider>
      </BrowserRouter>
    </AppProvider>
  </React.StrictMode>
)
