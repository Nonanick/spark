import { container } from "#container";
import { asClass, asFunction, asValue, AwilixContainer, Lifetime } from "awilix";
import { isClass } from "#utils/is_class";
import { isFunction } from "#utils/is_function";
import { promises as fs } from "node:fs";
import { DependencyLifetime, DependencyName } from "./symbols.js";
import path from 'path';
import { pathToFileURL } from "node:url";

const isServiceFile = /(?<name>.+)\.service\.(m|c)?js$/;

export async function autoloadServices(
  into: AwilixContainer,
  from: string
) {

  const currentDir = await fs.readdir(from, { withFileTypes: true });
  const allServices: unknown[] = [];

  for (let entry of currentDir) {
    if (entry.isDirectory()) {
      await autoloadServices(
        into,
        `${from}${path.sep}${entry.name}`
      );
    }

    if (entry.isFile()) {
      const matchesWithService = entry.name.match(isServiceFile);
      if (matchesWithService != null) {
        let loadedServices = await defaultServiceLoader(
          `${from}${path.sep}${entry.name}`,
          matchesWithService.groups!.name
        );
        allServices.push(...loadedServices);
      }
    }
  }

  for (let service of allServices) {

    if (isClass(service)) {
      // check if it has a resolver name
      let name: string = Object.getOwnPropertySymbols(service).includes(DependencyName)
        ? (service as any)[DependencyName]
        : toCamelCase(service.name);

      let lifetime = Object.getOwnPropertySymbols(service).includes(DependencyLifetime)
        ? ['SINGLETON', 'TRANSIENT', 'SCOPED'].includes((service as any)[DependencyLifetime])
          ? (service as any)[DependencyLifetime]
          : Lifetime.SINGLETON
        : Lifetime.SINGLETON;

      container.register(name, asClass(service, { lifetime, }));
      continue;
    }

    if (isFunction(service)) {
      console.log("function was exported!", service.name, service.toString());
      container.register(toCamelCase(service.name), asFunction(service));
      continue;
    }

    if (
      service != null
      && typeof service === 'object'
      && "name" in service
      && typeof (service as any).name === 'string'
      && "value" in service
      && (service as any).value !== undefined
    ) {
      container.register(toCamelCase((service as any).name), asValue((service as any).value));
    }


  }
}
export const toCamelCase = (text: string): string => {
  return text
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (leftTrim: string, index: number) =>
      index === 0 ? leftTrim.toLowerCase() : leftTrim.toUpperCase(),
    )
    .replace(/\s+/g, "");
};

export async function defaultServiceLoader<T = unknown>(
  filepath: string,
  name : string = '',
) {

  //  convert path to url so we can import it!
  const fileUrl = pathToFileURL(filepath);

  // check if importing a directory
  const statFromFilepath = await fs.stat(filepath);
  if (statFromFilepath.isDirectory()) {
    filepath = `${filepath}${path.sep}'index.js`;
  }

  return import(fileUrl.toString())
    .then(exportedModules => {
      let allMatchedModules: unknown[] = [];
      for (let namedExport in exportedModules) {
        let exportedModule = exportedModules[namedExport];
        // Fix "default" import
        if (namedExport === 'default') exportedModule = exportedModule.default;
        // if it is a value (not a function nor a class) record it as { name, value }
        if (!isClass(exportedModule) && !isFunction(exportedModule)) {
          exportedModule = { name: namedExport, value: exportedModule };
        }

        allMatchedModules.push(exportedModule);
      }
      return allMatchedModules as T[];
    });
}
