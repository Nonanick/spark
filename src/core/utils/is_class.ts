import type { Class } from 'type-fest';

export function isClass(m : unknown) : m is Class<unknown> {
  return (
    typeof m === 'function'
    && m != null
    && typeof (m as any)?.__proto__ === "function"
    && typeof m.toString === 'function'
    && m.toString().match(/^class (.*? )/) != null
  );
}