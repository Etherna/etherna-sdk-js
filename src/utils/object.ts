/**
 * `structuredClone` 'clone' that works with proxies also
 *
 * @param obj The object to clone
 * @returns The cloned object
 */
export function structuredClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T
}
