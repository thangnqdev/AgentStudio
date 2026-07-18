import { describe, expect, it } from 'vitest';
import { createStdioLspClient, encodeJsonRpcMessage, JsonRpcMessageDecoder } from './StdioLspClient.js';

describe('StdioLspClient', () => {
  it('decodes fragmented byte-counted JSON-RPC messages', () => {
    const decoder = new JsonRpcMessageDecoder();
    const encoded = encodeJsonRpcMessage({ jsonrpc: '2.0', id: 1, result: 'xin chào' });
    expect(decoder.push(encoded.subarray(0, 12))).toEqual([]);
    expect(decoder.push(encoded.subarray(12))).toEqual([{ jsonrpc: '2.0', id: 1, result: 'xin chào' }]);
  });

  it('spawns without a shell and exchanges JSON-RPC over stdio', async () => {
    const client = createStdioLspClient('fixture');
    await client.start(process.execPath, ['-e', SERVER_SCRIPT]);
    await expect(client.sendRequest('echo', { text: 'xin chào' })).resolves.toEqual({ text: 'xin chào' });
    await client.stop();
    expect(client.started).toBe(false);
  });
});

const SERVER_SCRIPT = String.raw`
let buffered = Buffer.alloc(0)
function send(message) {
  const body = Buffer.from(JSON.stringify(message), 'utf8')
  process.stdout.write(Buffer.concat([Buffer.from('Content-Length: ' + body.length + '\r\n\r\n'), body]))
}
process.stdin.on('data', chunk => {
  buffered = Buffer.concat([buffered, chunk])
  while (true) {
    const headerEnd = buffered.indexOf('\r\n\r\n')
    if (headerEnd < 0) return
    const header = buffered.subarray(0, headerEnd).toString('ascii')
    const match = /content-length:\s*(\d+)/i.exec(header)
    if (!match) process.exit(2)
    const length = Number(match[1])
    const start = headerEnd + 4
    if (buffered.length < start + length) return
    const message = JSON.parse(buffered.subarray(start, start + length).toString('utf8'))
    buffered = buffered.subarray(start + length)
    if (message.method === 'exit') process.exit(0)
    if (message.method === 'shutdown') send({ jsonrpc: '2.0', id: message.id, result: null })
    else if (message.id !== undefined) send({ jsonrpc: '2.0', id: message.id, result: message.params })
  }
})
`;
