import type {
  McpInteractiveOAuthCredentials,
  McpOAuthClientInformation,
  McpOAuthTokens,
} from '../../domain/entities/mcp.js';
import type { IMcpOAuthCredentialStore } from '../../domain/ports/IMcpOAuthCredentialStore.js';
import type { JsonMcpServerRepository } from './JsonMcpServerRepository.js';

export class EncryptedMcpOAuthCredentialStore implements IMcpOAuthCredentialStore {
  private readonly repository: JsonMcpServerRepository;

  constructor(repository: JsonMcpServerRepository) { this.repository = repository; }

  async load(serverId: string) {
    return (await this.repository.loadAll()).find((server) => server.id === serverId)?.credentials.interactiveOAuth;
  }

  saveClientInformation(serverId: string, redirectUrl: string, information: McpOAuthClientInformation) {
    return this.update(serverId, (current) => ({ ...current, redirectUrl, clientInformation: information }));
  }

  saveTokens(serverId: string, redirectUrl: string, tokens: McpOAuthTokens) {
    return this.update(serverId, (current) => ({ ...current, redirectUrl, tokens }));
  }

  clear(serverId: string, scope: 'all' | 'client' | 'tokens') {
    return this.repository.updateCredentialsSecurely(serverId, (credentials) => {
      const current = credentials.interactiveOAuth;
      if (!current || scope === 'all') return { ...credentials, interactiveOAuth: undefined };
      if (scope === 'client') return { ...credentials, interactiveOAuth: { redirectUrl: current.redirectUrl, tokens: current.tokens } };
      return { ...credentials, interactiveOAuth: { redirectUrl: current.redirectUrl, clientInformation: current.clientInformation } };
    });
  }

  private update(serverId: string, update: (current: McpInteractiveOAuthCredentials) => McpInteractiveOAuthCredentials) {
    return this.repository.updateCredentialsSecurely(serverId, (credentials) => ({
      ...credentials,
      bearerToken: undefined,
      oauthClientId: undefined,
      oauthClientSecret: undefined,
      interactiveOAuth: update(credentials.interactiveOAuth ?? { redirectUrl: '' }),
    }));
  }
}
