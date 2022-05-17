import { promises  as fs } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'path';

export async function defaultModuleLoader<T = unknown>(
  filepath: string,
  isOfExpectedType?: (m: unknown) => m is T
) {
  
  const fileURL = pathToFileURL(filepath);

  // check if importing a directory
  const statFromFilepath = await fs.stat(filepath);
  if (statFromFilepath.isDirectory()) {
    filepath = `${filepath}${path.sep}index.js`;
  }

  return import(fileURL.toString())
    .then(exportedModules => {
      let allMatchedModules: unknown[] = [];
      for (let namedExport in exportedModules) {
        let exportedModule = exportedModules[namedExport];
        // Fix "default" import
        if (namedExport === 'default' && exportedModule != null && exportedModule.default != null) exportedModule = exportedModule.default;

        if (isOfExpectedType == null ? true : isOfExpectedType(exportedModule)) {
          allMatchedModules.push(exportedModule);
        }
      }
      return allMatchedModules as T[];
    });
}
