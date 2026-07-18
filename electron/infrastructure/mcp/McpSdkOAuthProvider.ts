import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
import type { OAuthClientInformationMixed, OAuthClientMetadata, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js';
import type { IMcpOAuthCredentialStore } from '../../domain/ports/IMcpOAuthCredentialStore.js';

const MAX_TOKEN_CHARACTERS = 32_768;

export class McpInteractiveAuthorizationRequiredError extends Error {
  constructor() { super('Interactive MCP authorization is required.'); this.name = 'McpInteractiveAuthorizationRequiredError'; }
}

type ProviderOptions = {
  serverId: string;
  redirectUrl: string;
  state: string;
  scope?: string;
  store: IMcpOAuthCredentialStore;
  onRedirect: (url: URL) => void | Promise<void>;
};

export class McpSdkOAuthProvider implements OAuthClientProvider {
  private readonly options: ProviderOptions;
  private verifier?: string;

  constructor(options: ProviderOptions) { this.options = options; }

  get redirectUrl() { return this.options.redirectUrl; }

  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: 'AgentStudio',
      redirect_uris: [this.options.redirectUrl],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      ...(this.options.scope ? { scope: this.options.scope } : {}),
    };
  }

  state() { return this.options.state; }

  async clientInformation(): Promise<OAuthClientInformationMixed | undefined> {
    return await this.options.store.load(this.options.serverId).then((value) => value?.clientInformation);
  }

  async saveClientInformation(information: OAuthClientInformationMixed) {
    const clientId = boundedSecret(information.client_id, 'OAuth client id');
    const clientSecret = information.client_secret === undefined
      ? undefined : boundedSecret(information.client_secret, 'OAuth client secret');
    await this.options.store.saveClientInformation(this.options.serverId, this.options.redirectUrl, {
      client_id: clientId, client_secret: clientSecret,
      client_id_issued_at: boundedNumber(information.client_id_issued_at),
      client_secret_expires_at: boundedNumber(information.client_secret_expires_at),
    });
  }

  async tokens(): Promise<OAuthTokens | undefined> {
    return await this.options.store.load(this.options.serverId).then((value) => value?.tokens);
  }

  async saveTokens(tokens: OAuthTokens) {
    await this.options.store.saveTokens(this.options.serverId, this.options.redirectUrl, {
      access_token: boundedSecret(tokens.access_token, 'OAuth access token'),
      token_type: boundedSecret(tokens.token_type, 'OAuth token type'),
      expires_in: boundedNumber(tokens.expires_in),
      refresh_token: boundedOptional(tokens.refresh_token),
      scope: boundedOptional(tokens.scope, 2_048),
    });
  }

  redirectToAuthorization(url: URL) {
    validateAuthorizationUrl(url);
    return this.options.onRedirect(url);
  }

  saveCodeVerifier(verifier: string) {
    if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) throw new Error('Invalid OAuth PKCE verifier.');
    this.verifier = verifier;
  }

  codeVerifier() {
    if (!this.verifier) throw new Error('OAuth PKCE verifier is unavailable.');
    return this.verifier;
  }

  async invalidateCredentials(scope: 'all' | 'client' | 'tokens' | 'verifier' | 'discovery') {
    if (scope === 'verifier') { this.verifier = undefined; return; }
    if (scope === 'discovery') return;
    this.verifier = undefined;
    await this.options.store.clear(this.options.serverId, scope);
  }
}

function boundedSecret(value: string, label: string) {
  if (!value || value.length > MAX_TOKEN_CHARACTERS) throw new Error(`${label} is missing or too large.`);
  return value;
}

function boundedOptional(value: string | undefined, maximum = MAX_TOKEN_CHARACTERS) {
  if (value === undefined) return undefined;
  if (value.length > maximum) throw new Error('OAuth response field is too large.');
  return value;
}

function boundedNumber(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function validateAuthorizationUrl(url: URL) {
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
    throw new Error('MCP authorization URL must use HTTPS or loopback HTTP.');
  }
  if (url.username || url.password) throw new Error('MCP authorization URL must not contain userinfo.');
}
