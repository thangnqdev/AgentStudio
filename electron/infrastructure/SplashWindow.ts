import { BrowserWindow } from 'electron';
import type { ResolvedTheme } from '../domain/entities/theme.js';

const SPLASH_TIMEOUT_MS = 10_000;

const SPLASH_PALETTES = {
  light: {
    background: '#ffffff', border: '#e7e7e7', text: '#242424', muted: '#7b766f',
    loader: '#f1f1f1', accent: '#9c4326', logoBackground: '#ffffff', logoBorder: '#e7e7e7',
  },
  dark: {
    background: '#18181a', border: '#34343a', text: '#e8e8ea', muted: '#a0a0a8',
    loader: '#2e2e32', accent: '#e07a5a', logoBackground: '#222225', logoBorder: '#3a3a40',
  },
} satisfies Record<ResolvedTheme, Record<string, string>>;

function buildSplashPage(theme: ResolvedTheme): string {
  const palette = SPLASH_PALETTES[theme];
  return `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <style>
      * { box-sizing: border-box; }
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');
      
      body {
        margin: 0;
        height: 100vh;
        overflow: hidden;
        display: flex;
        justify-content: center;
        align-items: center;
        color: ${palette.text};
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background-color: ${palette.background};
        position: relative;
        border-radius: 12px;
        border: 1px solid ${palette.border};
      }
      
      .container {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        width: 100%;
        height: 100%;
      }

      .logo-wrapper {
        margin-bottom: 24px;
        animation: fade-in 1s ease-out;
      }

      .logo {
        width: 64px;
        height: 64px;
      }

      @keyframes fade-in {
        0% { opacity: 0; transform: translateY(10px); }
        100% { opacity: 1; transform: translateY(0); }
      }

      .title-container {
        text-align: center;
        animation: fade-in 1s ease-out 0.2s both;
      }
      h1 { 
        margin: 0 0 6px 0; 
        font-size: 22px; 
        font-weight: 600; 
        letter-spacing: -0.5px;
        color: ${palette.text};
      }
      p { 
        margin: 0; 
        color: ${palette.muted};
        font-size: 13px; 
        font-weight: 400;
      }

      .loader-container {
        margin-top: 32px;
        width: 140px;
        height: 2px;
        background: ${palette.loader};
        border-radius: 2px;
        overflow: hidden;
        position: relative;
        animation: fade-in 1s ease-out 0.4s both;
      }
      .loader-bar {
        position: absolute;
        top: 0;
        left: 0;
        height: 100%;
        width: 30%;
        background: ${palette.accent};
        border-radius: 2px;
        animation: progress-slide 1.5s infinite ease-in-out;
      }

      @keyframes progress-slide {
        0% { left: -30%; }
        100% { left: 100%; }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="logo-wrapper">
        <svg class="logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
          <rect width="100" height="100" rx="22" fill="${palette.logoBackground}" stroke="${palette.logoBorder}" stroke-width="2"/>
          <path d="M50 25 L25 75 L38 75 L50 48 L62 75 L75 75 Z" fill="${palette.text}" />
          <circle cx="50" cy="62" r="6" fill="${palette.accent}" />
        </svg>
      </div>
      <div class="title-container">
        <h1>AgentStudio</h1>
        <p>Đang chuẩn bị không gian làm việc...</p>
      </div>
      <div class="loader-container" aria-label="Đang tải">
        <div class="loader-bar"></div>
      </div>
    </div>
  </body>
</html>`;
}

export class SplashWindow {
  private window: BrowserWindow | null = null;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private readonly getMainWindow: () => BrowserWindow | null;

  constructor(getMainWindow: () => BrowserWindow | null) {
    this.getMainWindow = getMainWindow;
  }

  show(theme: ResolvedTheme): void {
    this.window = new BrowserWindow({
      width: 420,
      height: 280,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      frame: false,
      transparent: true,
      hasShadow: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      show: false,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    this.window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buildSplashPage(theme))}`);
    this.window.once('ready-to-show', () => this.window?.show());
    this.timeoutId = setTimeout(() => this.revealMainWindow(), SPLASH_TIMEOUT_MS);
  }

  revealMainWindow(): void {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    this.timeoutId = null;

    const mainWindow = this.getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }

    if (this.window && !this.window.isDestroyed()) this.window.close();
    this.window = null;
  }
}
