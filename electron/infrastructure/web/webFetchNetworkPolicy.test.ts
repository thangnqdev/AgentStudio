import { describe, expect, it } from 'vitest';
import { isPublicNetworkAddress, resolvePublicWebAddress } from './webFetchNetworkPolicy.js';

describe('WebFetch network policy', () => {
  it('blocks private, loopback, link-local, documentation and multicast addresses', () => {
    for (const address of ['0.0.0.0', '10.0.0.1', '127.0.0.1', '169.254.169.254', '192.168.1.1', '198.51.100.1', '224.0.0.1']) {
      expect(isPublicNetworkAddress(address, 4), address).toBe(false);
    }
    for (const address of ['::1', 'fc00::1', 'fe80::1', '2001:db8::1', 'ff02::1']) {
      expect(isPublicNetworkAddress(address, 6), address).toBe(false);
    }
  });

  it('accepts globally routable IPv4 and IPv6 addresses', () => {
    expect(isPublicNetworkAddress('8.8.8.8', 4)).toBe(true);
    expect(isPublicNetworkAddress('2606:4700:4700::1111', 6)).toBe(true);
  });

  it('fails closed when any DNS answer is private to prevent rebinding', async () => {
    const mixed = async () => [{ address: '93.184.216.34', family: 4 as const }, { address: '127.0.0.1', family: 4 as const }];
    await expect(resolvePublicWebAddress('example.com', mixed)).rejects.toThrow('private or reserved');
    await expect(resolvePublicWebAddress('example.com', async () => [{ address: '93.184.216.34', family: 4 }]))
      .resolves.toEqual({ address: '93.184.216.34', family: 4 });
  });
});
