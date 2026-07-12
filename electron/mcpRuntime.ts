import { ManageMcpServers } from './application/usecases/ManageMcpServers.js';
import { JsonMcpServerRepository } from './infrastructure/mcp/JsonMcpServerRepository.js';
import { McpClientGateway } from './infrastructure/mcp/McpClientGateway.js';

export const mcpGateway = new McpClientGateway();
export const mcpServerManager = new ManageMcpServers(new JsonMcpServerRepository(), mcpGateway);
