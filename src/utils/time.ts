/**
 * Converts a timestamp in seconds to a date
 *
 * @param timestamp The timestamp in seconds
 * @returns The date
 */
export function timestampToDate(timestamp: number): Date {
  const date = new Date(timestamp * 1000)
  if (date.getFullYear() > 5000) {
    // most likely a timestamp already in milliseconds
    return new Date(timestamp)
  }
  return date
}

/**
 * Converts a date to a timestamp in seconds
 *
 * @param date The date to convert
 * @returns The timestamp in seconds
 */
export function dateToTimestamp(date: Date): number {
  const time = date.getTime()
  if (time < 0 || isNaN(time)) {
    return 0
  }
  return Math.floor(date.getTime() / 1000)
}
