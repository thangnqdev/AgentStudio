import type { McpAuthOutput } from '../../domain/entities/mcpAuth.js';
import type { IExternalNavigator } from '../../domain/ports/IExternalNavigator.js';
import type { IMcpAuthenticationGateway } from '../../domain/ports/IMcpAuthenticationGateway.js';

export class AuthenticateMcpFromSettings {
  private readonly authentication: IMcpAuthenticationGateway;
  private readonly navigator: IExternalNavigator;

  constructor(authentication: IMcpAuthenticationGateway, navigator: IExternalNavigator) {
    this.authentication = authentication; this.navigator = navigator;
  }

  async execute(serverId: string, workspaceRoot: string): Promise<McpAuthOutput> {
    const output = await this.authentication.authenticate(serverId, workspaceRoot);
    if (output.authUrl) await this.navigator.open(output.authUrl);
    return output;
  }
}
