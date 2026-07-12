import { BrowserWindow } from 'electron';

const SPLASH_TIMEOUT_MS = 10_000;

const splashPage = `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <style>
      * { box-sizing: border-box; }
      @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap');
      
      body {
        margin: 0;
        height: 100vh;
        overflow: hidden;
        display: flex;
        justify-content: center;
        align-items: center;
        color: #ffffff;
        font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background-color: transparent;
        position: relative;
        border-radius: 16px;
      }
      
      /* Animated Background Orbs */
      .bg-orb {
        position: absolute;
        width: 300px;
        height: 300px;
        border-radius: 50%;
        filter: blur(70px);
        opacity: 0.5;
        animation: orb-float 8s infinite alternate ease-in-out;
      }
      .orb-1 {
        background: linear-gradient(135deg, #FF3366, #FF9933);
        top: -100px;
        left: -100px;
      }
      .orb-2 {
        background: linear-gradient(135deg, #7C3AED, #3B82F6);
        bottom: -150px;
        right: -50px;
        animation-delay: -4s;
      }

      @keyframes orb-float {
        0% { transform: translate(0, 0) scale(1); }
        100% { transform: translate(30px, 40px) scale(1.1); }
      }

      /* Glassmorphism Container */
      .glass-container {
        position: relative;
        z-index: 10;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        background: rgba(15, 15, 18, 0.7);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.05);
      }

      /* Animated Logo Mark */
      .mark-wrapper {
        position: relative;
        margin-bottom: 28px;
      }
      .mark-glow {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 72px;
        height: 72px;
        background: linear-gradient(135deg, #FF3366, #7C3AED);
        filter: blur(15px);
        opacity: 0.6;
        border-radius: 20px;
        animation: glow-pulse 3s infinite alternate;
      }
      .mark {
        position: relative;
        width: 72px;
        height: 72px;
        display: flex;
        justify-content: center;
        align-items: center;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 20px;
        background: linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.02) 100%);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        font-size: 36px;
        font-weight: 700;
        color: #ffffff;
        text-shadow: 0 2px 4px rgba(0,0,0,0.5);
      }

      @keyframes glow-pulse {
        0% { opacity: 0.4; transform: translate(-50%, -50%) scale(0.95); }
        100% { opacity: 0.8; transform: translate(-50%, -50%) scale(1.05); }
      }

      /* Typography */
      .title-container {
        text-align: center;
      }
      h1 { 
        margin: 0 0 8px 0; 
        font-size: 26px; 
        font-weight: 600; 
        letter-spacing: -0.3px;
        background: linear-gradient(to bottom right, #ffffff, #a1a1aa);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
      p { 
        margin: 0; 
        color: #a1a1aa; 
        font-size: 13px; 
        font-weight: 300;
        letter-spacing: 0.2px;
      }

      /* Modern Progress Bar */
      .loader-container {
        margin-top: 32px;
        width: 160px;
        height: 3px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 3px;
        overflow: hidden;
        position: relative;
      }
      .loader-bar {
        position: absolute;
        top: 0;
        left: 0;
        height: 100%;
        width: 40%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent);
        border-radius: 3px;
        animation: progress-slide 1.5s infinite ease-in-out;
      }

      @keyframes progress-slide {
        0% { left: -40%; }
        100% { left: 100%; }
      }
    </style>
  </head>
  <body>
    <div class="bg-orb orb-1"></div>
    <div class="bg-orb orb-2"></div>
    
    <div class="glass-container">
      <div class="mark-wrapper">
        <div class="mark-glow"></div>
        <div class="mark">A</div>
      </div>
      <div class="title-container">
        <h1>AgentStudio</h1>
        <p>Đang chuẩn bị không gian làm việc</p>
      </div>
      <div class="loader-container" aria-label="Đang tải">
        <div class="loader-bar"></div>
      </div>
    </div>
  </body>
</html>`;

export class SplashWindow {
  private window: BrowserWindow | null = null;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private readonly getMainWindow: () => BrowserWindow | null;

  constructor(getMainWindow: () => BrowserWindow | null) {
    this.getMainWindow = getMainWindow;
  }

  show(): void {
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
    this.window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashPage)}`);
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
