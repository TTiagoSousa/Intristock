import { BlockList, isIP } from 'node:net';
import { lookup } from 'node:dns/promises';

// Para onde o servidor nunca vai: ele próprio (loopback), o link-local (169.254/16, onde estão os
// metadados das clouds, e fe80::/10), o «qualquer» (0.0.0.0, ::) e o multicast. A LAN fica: o
// solidtime costuma estar lá.
const BLOCKED = new BlockList();
BLOCKED.addSubnet('0.0.0.0', 8, 'ipv4');
BLOCKED.addSubnet('127.0.0.0', 8, 'ipv4');
BLOCKED.addSubnet('169.254.0.0', 16, 'ipv4');
BLOCKED.addSubnet('224.0.0.0', 4, 'ipv4');
BLOCKED.addAddress('255.255.255.255', 'ipv4');
BLOCKED.addAddress('::', 'ipv6');
BLOCKED.addAddress('::1', 'ipv6');
BLOCKED.addSubnet('fe80::', 10, 'ipv6');
BLOCKED.addSubnet('ff00::', 8, 'ipv6');

// O mesmo host não se resolve a cada pedido de uma sincronização
const CACHE_MS = 60 * 1000;
const cache = new Map<string, { ok: boolean; at: number }>();

const blocked = (address: string): boolean => {
  const family = isIP(address);
  if (family === 4) return BLOCKED.check(address, 'ipv4');
  if (family === 6) {
    // ::ffff:127.0.0.1 é o 127.0.0.1
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
    if (mapped) return BLOCKED.check(mapped[1], 'ipv4');
    return BLOCKED.check(address, 'ipv6');
  }
  return true;
};

/**
 * Se o host de um endereço é um a que o servidor pode ir: resolve-o (todos os endereços) e recusa
 * se algum for loopback, link-local, 0.0.0.0/:: ou multicast. Um host que não resolve também não.
 */
export async function isPublicHost(hostname: string): Promise<boolean> {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const cached = cache.get(host);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.ok;
  let ok: boolean;
  if (host === 'localhost' || host.endsWith('.localhost')) ok = false;
  else if (isIP(host)) ok = !blocked(host);
  else {
    try {
      const addresses = await lookup(host, { all: true, verbatim: true });
      ok = addresses.length > 0 && addresses.every(({ address }) => !blocked(address));
    } catch {
      ok = false;
    }
  }
  cache.set(host, { ok, at: Date.now() });
  return ok;
}
