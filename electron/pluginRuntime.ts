import { ManagePlugins } from './application/usecases/ManagePlugins.js';
import { FileSystemPluginCatalog } from './infrastructure/plugins/FileSystemPluginCatalog.js';
import { JsonPluginPreferencesRepository } from './infrastructure/plugins/JsonPluginPreferencesRepository.js';

export const pluginManager = new ManagePlugins(
  new FileSystemPluginCatalog(),
  new JsonPluginPreferencesRepository(),
);
