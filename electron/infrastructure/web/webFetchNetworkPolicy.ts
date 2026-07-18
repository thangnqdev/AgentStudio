import dns from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

export type PublicWebAddress = { address: string; family: 4 | 6 };
export type WebHostResolver = (hostname: string) => Promise<PublicWebAddress[]>;

const PRIVATE_IPV4 = new BlockList();
const PRIVATE_IPV6 = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) PRIVATE_IPV4.addSubnet(address, prefix, 'ipv4');

for (const [address, prefix] of [
  ['::', 128], ['::1', 128], ['::ffff:0:0', 96], ['64:ff9b::', 96], ['64:ff9b:1::', 48], ['100::', 64],
  ['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8],
] as const) PRIVATE_IPV6.addSubnet(address, prefix, 'ipv6');

export async function resolvePublicWebAddress(
  hostname: string,
  resolver: WebHostResolver = lookupAll,
  signal?: AbortSignal,
): Promise<PublicWebAddress> {
  const normalized = hostname.replace(/^\[|\]$/g, '');
  const literalFamily = isIP(normalized);
  const addresses = literalFamily
    ? [{ address: normalized, family: literalFamily as 4 | 6 }]
    : await abortable(resolver(normalized), signal);
  if (addresses.length === 0) throw new Error(`WebFetch could not resolve ${hostname}.`);
  if (addresses.some((entry) => !isPublicNetworkAddress(entry.address, entry.family))) {
    throw new Error(`WebFetch blocked private or reserved network address for ${hostname}.`);
  }
  return addresses[0];
}

export function isPublicNetworkAddress(address: string, family: 4 | 6) {
  if (isIP(address) !== family) return false;
  return family === 4
    ? !PRIVATE_IPV4.check(address, 'ipv4')
    : !PRIVATE_IPV6.check(address, 'ipv6');
}

async function lookupAll(hostname: string): Promise<PublicWebAddress[]> {
  const results = await dns.lookup(hostname, { all: true, verbatim: true });
  return results.flatMap((entry) => entry.family === 4 || entry.family === 6
    ? [{ address: entry.address, family: entry.family }]
    : []);
}

function abortable<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(new Error('Agent session stopped.'));
  return new Promise<T>((resolve, reject) => {
    const stop = () => reject(new Error('Agent session stopped.'));
    signal.addEventListener('abort', stop, { once: true });
    promise.then(
      (value) => { signal.removeEventListener('abort', stop); resolve(value); },
      (error) => { signal.removeEventListener('abort', stop); reject(error); },
    );
  });
}
