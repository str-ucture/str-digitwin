import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import AdminPage from './pages/AdminPage'
import ModelProcessorPage from './pages/ModelProcessorPage'
import ModelViewerPage from './pages/ModelViewerPage'
import DesignSystemPage from './pages/DesignSystemPage'
import LoginPage from './pages/LoginPage'
import RequireAuth from './components/UI/RequireAuth'
import { AuthProvider } from './lib/authContext'
import { validateConfig, isConfigError } from './lib/config'
import ConfigError from './components/UI/ConfigError'

// Validate env vars once at module load — renders a setup screen if any are missing
const configResult = validateConfig()

const basename = import.meta.env.VITE_BASE_PATH || '/'

export default function App() {
  if (isConfigError(configResult)) {
    return <ConfigError error={configResult} />
  }

  return (
    <AuthProvider>
      <BrowserRouter basename={basename} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/project/:id" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin" element={<RequireAuth><AdminPage /></RequireAuth>} />
          <Route path="/model-processor" element={<RequireAuth><ModelProcessorPage /></RequireAuth>} />
          <Route path="/model-viewer" element={<RequireAuth><ModelViewerPage /></RequireAuth>} />
          <Route path="/design-system" element={<RequireAuth><DesignSystemPage /></RequireAuth>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
