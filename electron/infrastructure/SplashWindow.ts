import { BrowserWindow } from 'electron';

const SPLASH_TIMEOUT_MS = 10_000;

const splashPage = `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        color: #fff7f4;
        font-family: Inter, Arial, sans-serif;
        background: radial-gradient(circle at 18% 12%, #6b3d4d 0%, #241817 42%, #15100f 100%);
      }
      .content { display: grid; justify-items: center; gap: 16px; text-align: center; }
      .mark {
        width: 64px;
        height: 64px;
        display: grid;
        place-items: center;
        border: 1px solid rgba(255, 223, 211, .35);
        border-radius: 20px;
        background: rgba(255, 255, 255, .08);
        box-shadow: 0 14px 36px rgba(0, 0, 0, .26);
        font-size: 28px;
        font-weight: 700;
      }
      h1 { margin: 0; font-size: 23px; letter-spacing: -.4px; }
      p { margin: 0; color: #dec8c1; font-size: 13px; }
      .loader { display: flex; gap: 6px; margin-top: 5px; }
      .dot { width: 7px; height: 7px; border-radius: 50%; background: #e7a8b0; animation: pulse 1.1s infinite ease-in-out; }
      .dot:nth-child(2) { animation-delay: .15s; }
      .dot:nth-child(3) { animation-delay: .3s; }
      @keyframes pulse { 0%, 100% { opacity: .3; transform: scale(.8); } 50% { opacity: 1; transform: scale(1); } }
    </style>
  </head>
  <body>
    <main class="content">
      <div class="mark">A</div>
      <div><h1>AgentStudio</h1><p>Đang chuẩn bị không gian làm việc</p></div>
      <div class="loader" aria-label="Đang tải"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>
    </main>
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
      transparent: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      show: false,
      backgroundColor: '#15100f',
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
