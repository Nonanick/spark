export function isMergeableObject(value: unknown): boolean {
  return isNonNullObject(value)
    && !isSpecial(value)
}

function isNonNullObject(value: unknown) {
  return !!value && typeof value === 'object'
}

function isSpecial(value: unknown) {
  var stringValue = Object.prototype.toString.call(value)

  return stringValue === '[object RegExp]'
    || stringValue === '[object Date]'
    || isReactElement(value)
}

// see https://github.com/facebook/react/blob/b5ac963fb791d1298e7f396236383bc955f916c1/src/isomorphic/classic/element/ReactElement.js#L21-L25
var canUseSymbol = typeof Symbol === 'function' && Symbol.for
var REACT_ELEMENT_TYPE = canUseSymbol ? Symbol.for('react.element') : 0xeac7

function isReactElement(value: any) {
  return value.$$typeof === REACT_ELEMENT_TYPE
}

function emptyTarget(val: unknown) {
  return Array.isArray(val) ? [] : {}
}

export interface Options {
  arrayMerge?(target: any[], source: any[], options?: Options): any[];
  clone?: boolean;
  customMerge?: (key: string | symbol, options?: Options) => ((x: any, y: any) => any) | undefined;
  isMergeableObject?(value: object): boolean;
  cloneUnlessOtherwiseSpecified: (value: object, options: Options) => unknown;
}

function cloneUnlessOtherwiseSpecified(value: object, options: Options): unknown {
  return (options.clone !== false && (options.isMergeableObject ?? isMergeableObject)(value))
    ? deepmerge(emptyTarget(value), value, options)
    : value
}

function defaultArrayMerge(target: object[], source: object[], options: Options) {
  return target.concat(source).map(function (element) {
    return cloneUnlessOtherwiseSpecified(element, options)
  })
}

function getMergeFunction(key: string | symbol, options: Options) {
  if (!options.customMerge) {
    return deepmerge
  }
  var customMerge = options.customMerge(key)
  return typeof customMerge === 'function' ? customMerge : deepmerge
}

function getEnumerableOwnPropertySymbols(target: object) {
  return Object.getOwnPropertySymbols
    ? Object.getOwnPropertySymbols(target).filter(function (symbol) {
      return target.propertyIsEnumerable(symbol)
    })
    : []
}

function getKeys(target: object) {
  return ([] as (string | symbol)[]).concat(Object.keys(target)).concat(getEnumerableOwnPropertySymbols(target));
}

function propertyIsOnObject(object: object, property: string | symbol) {
  try {
    return property in object
  } catch (_) {
    return false
  }
}

// Protects from prototype poisoning and unexpected merging up the prototype chain.
function propertyIsUnsafe(target: object, key: string | symbol) {
  return propertyIsOnObject(target, key) // Properties are safe to merge if they don't exist in the target yet,
    && !(Object.hasOwnProperty.call(target, key) // unsafe if they exist up the prototype chain,
      && Object.propertyIsEnumerable.call(target, key)) // and also unsafe if they're nonenumerable.
}

function mergeObject(target: any, source: any, options: Options) {
  var destination: Record<string | symbol, unknown> = {};

  if ((options.isMergeableObject ?? isMergeableObject)(target)) {
    getKeys(target).forEach(function (key) {
      destination[key] = cloneUnlessOtherwiseSpecified((target as any)[key], options)
    })
  }
  getKeys(source).forEach(function (key) {
    if (propertyIsUnsafe(target, key)) {
      return
    }

    if (propertyIsOnObject(target, key) && (options.isMergeableObject ?? isMergeableObject)((source as any)[key])) {
      destination[key] = getMergeFunction(key, options)(target[key], source[key], options)
    } else {
      destination[key] = cloneUnlessOtherwiseSpecified(source[key], options)
    }
  })
  return destination
}

export function deepmerge<T>(x: Partial<T>, y: Partial<T>, options?: Options): T;
export function deepmerge<T1, T2>(x: Partial<T1>, y: Partial<T2>, options?: Options): T1 & T2;
export function deepmerge<T1, T2>(target: Partial<T1>, source: Partial<T2>, options?: any) {
  options = options || {}
  options.arrayMerge = options.arrayMerge || defaultArrayMerge
  options.isMergeableObject = options.isMergeableObject || isMergeableObject
  // cloneUnlessOtherwiseSpecified is added to `options` so that custom arrayMerge()
  // implementations can use it. The caller may not replace it.
  options.cloneUnlessOtherwiseSpecified = cloneUnlessOtherwiseSpecified

  var sourceIsArray = Array.isArray(source)
  var targetIsArray = Array.isArray(target)
  var sourceAndTargetTypesMatch = sourceIsArray === targetIsArray

  if (!sourceAndTargetTypesMatch) {
    return cloneUnlessOtherwiseSpecified(source, options)
  } else if (sourceIsArray) {
    return options.arrayMerge(target, source, options)
  } else {
    return mergeObject(target, source, options)
  }
}

export function deepmergeAll(objects: object[], options?: Options): object;
export function deepmergeAll<T>(objects: Partial<T>[], options?: Options): T;
export function deepmergeAll<T>(array: Partial<T>, options?: Options) {
  if (!Array.isArray(array)) {
    throw new Error('first argument should be an array')
  }

  return array.reduce(function (prev, next) {
    return deepmerge(prev, next, options)
  }, {})
}
