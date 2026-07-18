import { createHmac, randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import net from 'node:net';

const bootstrap = await readBootstrap();
const timestamp = Date.now();
const nonce = randomBytes(16).toString('base64url');
const unsigned = {
  version: 1, teamId: bootstrap.teamId, workerId: bootstrap.workerId,
  instanceId: bootstrap.instanceId, epoch: bootstrap.epoch, timestamp, nonce,
};
const signature = createHmac('sha256', Buffer.from(bootstrap.secret, 'base64url'))
  .update(JSON.stringify([unsigned.version, unsigned.teamId, unsigned.workerId, unsigned.instanceId, unsigned.epoch, unsigned.timestamp, unsigned.nonce]))
  .digest('base64url');
const socket = net.createConnection(bootstrap.endpoint);
await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('error', reject); });
socket.write(frame({ type: 'handshake', ...unsigned, signature }));
await readFrame(socket);
if (bootstrap.outbound) socket.write(frame({ type: 'message', ...bootstrap.outbound }));
await new Promise((resolve) => setTimeout(resolve, 20));
socket.end();
process.stdout.write(JSON.stringify({ connected: true, unsafeEnvPresent: Boolean(process.env.UNSAFE_AGENT_SECRET) }));

function readBootstrap() {
  return new Promise((resolve, reject) => {
    let raw = '';
    const stream = createReadStream('', { fd: Number(process.env.AGENTSTUDIO_BOOTSTRAP_FD || 3) });
    stream.on('data', (chunk) => { raw += chunk.toString('utf8'); });
    stream.once('end', () => resolve(JSON.parse(raw))); stream.once('error', reject);
  });
}
function frame(value) { const body = Buffer.from(JSON.stringify(value)); const output = Buffer.alloc(body.length + 4); output.writeUInt32BE(body.length); body.copy(output, 4); return output; }
function readFrame(socket) {
  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0);
    const onData = (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length < 4 || buffer.length < buffer.readUInt32BE(0) + 4) return;
      socket.off('data', onData); resolve(JSON.parse(buffer.subarray(4, buffer.readUInt32BE(0) + 4).toString('utf8')));
    };
    socket.on('data', onData); socket.once('error', reject);
  });
}
