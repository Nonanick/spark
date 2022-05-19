import { asClass, asFunction, asValue, Lifetime, LifetimeType } from "awilix";
import type { Class, JsonValue } from "type-fest";
import { isClass } from "./is_class.js";
import { isFunction } from "./is_function.js";

export function toResolver(
  toBeRegistered: Class<any> | ((...args: any[]) => any) | JsonValue,
  lifetime: LifetimeType = Lifetime.SCOPED
) {
  if (isClass(toBeRegistered)) {
    return asClass(toBeRegistered, { lifetime });
  }
  if (isFunction(toBeRegistered)) {
    return asFunction(toBeRegistered, { lifetime });
  }

  return asValue(toBeRegistered);
}