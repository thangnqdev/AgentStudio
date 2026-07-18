import fs from 'node:fs/promises';
import path from 'node:path';
import { app, safeStorage } from 'electron';
import type { McpCredentials, McpServerRecord } from '../../domain/entities/mcp.js';
import type { IMcpServerRepository } from '../../domain/ports/IMcpServerRepository.js';
import { writePrivateFileAtomic } from '../storage/privateFile.js';

type StoredServer = Omit<McpServerRecord, 'credentials' | 'hasCredentials'> & {
  encryptedCredentials?: string;
  plainCredentials?: string;
};

let repositoryMutationQueue = Promise.resolve();

export class JsonMcpServerRepository implements IMcpServerRepository {
  async loadAll(): Promise<McpServerRecord[]> {
    try {
      const parsed = JSON.parse(await fs.readFile(this.getPath(), 'utf8')) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.flatMap((item) => isStoredServer(item) ? [this.toRecord(item)] : []);
    } catch {
      return [];
    }
  }

  async save(server: McpServerRecord) {
    await this.mutate((servers) => {
      const stored = this.toStored(server); const index = servers.findIndex((item) => item.id === server.id);
      if (index >= 0) servers[index] = stored; else servers.push(stored); return servers;
    });
  }

  async remove(serverId: string) {
    await this.mutate((servers) => servers.filter((server) => server.id !== serverId));
  }

  async updateCredentialsSecurely(serverId: string, update: (credentials: McpCredentials) => McpCredentials) {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Encrypted MCP credential storage is unavailable.');
    await this.mutate((servers) => {
      const index = servers.findIndex((server) => server.id === serverId);
      if (index < 0) throw new Error('MCP server does not exist.');
      const record = this.toRecord(servers[index]);
      servers[index] = this.toStored({ ...record, credentials: update(record.credentials), hasCredentials: true });
      return servers;
    });
  }

  private async loadStored(): Promise<StoredServer[]> {
    try {
      const parsed = JSON.parse(await fs.readFile(this.getPath(), 'utf8')) as unknown;
      return Array.isArray(parsed) ? parsed.filter(isStoredServer) : [];
    } catch {
      return [];
    }
  }

  private toStored(server: McpServerRecord): StoredServer {
    const serialized = JSON.stringify(server.credentials);
    const secret = serialized === '{}'
      ? {}
      : safeStorage.isEncryptionAvailable()
        ? { encryptedCredentials: safeStorage.encryptString(serialized).toString('base64') }
        : this.plaintextWarning(serialized);
    const { credentials: _credentials, hasCredentials: _hasCredentials, ...config } = server;
    return { ...config, ...secret };
  }

  private toRecord(server: StoredServer): McpServerRecord {
    let credentials: McpCredentials = {};
    try {
      const serialized = server.encryptedCredentials
        ? safeStorage.decryptString(Buffer.from(server.encryptedCredentials, 'base64'))
        : server.plainCredentials || '{}';
      credentials = JSON.parse(serialized) as McpCredentials;
    } catch {
      credentials = {};
    }
    const { encryptedCredentials: _encrypted, plainCredentials: _plain, ...config } = server;
    return { ...config, hasCredentials: Boolean(server.encryptedCredentials || server.plainCredentials), credentials };
  }

  private plaintextWarning(serialized: string) {
    console.warn('[SECURITY] safeStorage is unavailable — MCP credentials are stored as plaintext.');
    return { plainCredentials: serialized };
  }

  private async write(servers: StoredServer[]) {
    await writePrivateFileAtomic(this.getPath(), JSON.stringify(servers, null, 2));
  }

  private async mutate(mutation: (servers: StoredServer[]) => StoredServer[]) {
    const operation = repositoryMutationQueue.then(async () => this.write(mutation(await this.loadStored())));
    repositoryMutationQueue = operation.catch(() => undefined);
    await operation;
  }

  private getPath() {
    return path.join(app.getPath('userData'), 'mcp-servers.json');
  }
}

function isStoredServer(value: unknown): value is StoredServer {
  return typeof value === 'object' && value !== null && typeof (value as Record<string, unknown>).id === 'string';
}
