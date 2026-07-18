import { getLocalToolDefinition } from './infrastructure/tools/localToolDefinitions.js';
import { WorkspaceIdeSelectionContext } from './infrastructure/mcp/WorkspaceIdeSelectionContext.js';
import { toolPermissionPolicy } from './permissionRuntime.js';

const readTool = getLocalToolDefinition('read_file');
if (!readTool) throw new Error('The canonical read_file tool definition is unavailable.');

export const ideSelectionContext = new WorkspaceIdeSelectionContext(toolPermissionPolicy, readTool);
