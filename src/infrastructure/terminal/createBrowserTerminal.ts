import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';

export function createBrowserTerminal(container: HTMLDivElement) {
  const terminal = new Terminal({
    cursorBlink: true,
    cursorStyle: 'bar',
    fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: 13,
    lineHeight: 1.25,
    scrollback: 8000,
    convertEol: true,
    theme: {
      background: '#141312', foreground: '#f4f0ee', cursor: '#f4f0ee', selectionBackground: '#8f4a2d66',
      black: '#211f1e', red: '#ff6b5f', green: '#7bd88f', yellow: '#f7d774', blue: '#82aaff',
      magenta: '#c792ea', cyan: '#89ddff', white: '#f4f0ee', brightBlack: '#6f6a67',
      brightRed: '#ff8a80', brightGreen: '#a5e8b5', brightYellow: '#ffe59a', brightBlue: '#a6c8ff',
      brightMagenta: '#d7aefb', brightCyan: '#b2ebff', brightWhite: '#ffffff',
    },
  });
  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.open(container);
  return { terminal, fitAddon };
}
