import { ManageMcpServers } from './application/usecases/ManageMcpServers.js';
import { JsonMcpServerRepository } from './infrastructure/mcp/JsonMcpServerRepository.js';
import { McpClientGateway } from './infrastructure/mcp/McpClientGateway.js';
import { AuthenticateMcpFromSettings } from './application/usecases/AuthenticateMcpFromSettings.js';
import { ElectronExternalNavigator } from './infrastructure/ElectronExternalNavigator.js';
import { ideSelectionContext } from './ideRuntime.js';

export const mcpGateway = new McpClientGateway(undefined, undefined, undefined, ideSelectionContext);
export const mcpServerManager = new ManageMcpServers(new JsonMcpServerRepository(), mcpGateway);
export const mcpSettingsAuthentication = new AuthenticateMcpFromSettings(mcpGateway, new ElectronExternalNavigator());
