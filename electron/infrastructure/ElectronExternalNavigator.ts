import { shell } from 'electron';
import type { IExternalNavigator } from '../domain/ports/IExternalNavigator.js';

export class ElectronExternalNavigator implements IExternalNavigator {
  async open(rawUrl: string) {
    const url = new URL(rawUrl);
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
      throw new Error('External authorization URL must use HTTPS or loopback HTTP.');
    }
    if (url.username || url.password) throw new Error('External authorization URL must not contain userinfo.');
    await shell.openExternal(url.toString());
  }
}
