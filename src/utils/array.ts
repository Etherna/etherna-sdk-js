/**
 * Splits an array into chunks of a specified size.
 *
 * @param array - The array to be split into chunks.
 * @param chunkSize - The size of each chunk.
 * @returns An array of chunks.
 */
export function splitArrayInChunks<T>(array: T[], chunkSize: number): T[][] {
  if (chunkSize < 2) return [array]

  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize))
  }
  return chunks
}
