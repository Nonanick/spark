import type { FunctionReturning } from "awilix";

export function isFunction(m : unknown) : m is FunctionReturning<unknown> {
  return (
    typeof m === 'function'
    && m != null
    && typeof (m as any)?.__proto__ === "function"
    && typeof m.toString === 'function'
    && m.toString().match(/^function (.*?)/) != null
  );
}