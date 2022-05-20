import { asClass, asFunction, asValue, Lifetime, LifetimeType, Resolver } from "awilix";
import type { Class, JsonValue } from "type-fest";
import { isClass } from "./is_class.js";
import { isFunction } from "./is_function.js";
import { isResolver } from "./is_resolver.js";

export function toResolver(
  toBeRegistered: Class<any> | ((...args: any[]) => any) | JsonValue | Resolver<any>,
  lifetime: LifetimeType = Lifetime.SCOPED
) {
  
  if(isResolver(toBeRegistered)) return toBeRegistered;

  if (isClass(toBeRegistered)) {
    return asClass(toBeRegistered, { lifetime });
  }
  if (isFunction(toBeRegistered)) {
    return asFunction(toBeRegistered, { lifetime });
  }

  return asValue(toBeRegistered);
}