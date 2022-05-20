import type { Resolver } from "awilix";

export function isResolver(m : unknown) : m is Resolver<unknown> {
  return (
    typeof m === 'object'
    && m != null
    && "resolve" in m
    && typeof (m as any).resolve === 'function'
  )
}