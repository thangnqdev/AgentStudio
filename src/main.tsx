import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './application/hooks/ThemeProvider.tsx'
import type { ThemePreference } from './domain/entities/theme.ts'
import { resolveTheme } from './application/services/theme.ts'
import { BrowserThemeEnvironment } from './infrastructure/browser/browserThemeEnvironment.ts'
import { ThemePreferenceBridge } from './infrastructure/ipc/themePreferenceBridge.ts'

async function bootstrap() {
  let preference: ThemePreference = 'system'
  try {
    preference = await ThemePreferenceBridge.load()
  } catch (error) {
    console.error('Failed to load theme preference', error)
  }
  BrowserThemeEnvironment.apply(resolveTheme(preference, BrowserThemeEnvironment.isSystemDark()))

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ThemeProvider
        environment={BrowserThemeEnvironment}
        initialPreference={preference}
        preferencePort={ThemePreferenceBridge}
      >
        <App />
      </ThemeProvider>
    </StrictMode>,
  )
}

void bootstrap()
