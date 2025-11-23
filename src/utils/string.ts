/**
 * Slugify a string
 *
 * @param str String to slugify
 * @param connector Character to use as connector
 * @returns Slugified string
 */
export function slugify(str: string, connector = "-") {
  return str
    .toLowerCase()
    .replace(/ +/g, connector)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(new RegExp(`[^a-z0-9${connector}]`, "g"), "")
    .replace(new RegExp(`${connector}+`, "g"), connector)
    .replace(new RegExp(`^${connector}|${connector}$`, "g"), "")
}
