interface VideoMeta {
  duration: number
  width: number
  height: number
}

/**
 * Get the video metadata
 *
 * @param url The video url
 * @param data The video bytes
 * @returns The video metadata
 */
export function getVideoMeta(url: string): Promise<VideoMeta>
export function getVideoMeta(data: Uint8Array): Promise<VideoMeta>
export function getVideoMeta(input: string | Uint8Array): Promise<VideoMeta> {
  return new Promise<VideoMeta>((resolve, reject) => {
    const video = document.createElement("video")
    video.preload = "metadata"
    video.onerror = (error) => {
      reject(error)
    }
    video.onloadedmetadata = () => {
      try {
        window.URL.revokeObjectURL(video.src)
      } catch {}

      resolve({
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
      })
    }
    video.src =
      input instanceof Uint8Array
        ? URL.createObjectURL(new Blob([input as BlobPart], { type: "video/mp4" }))
        : input
  })
}

/**
 * Get the video bitrate
 *
 * @param size Video size in bytes
 * @param duration Video duration in seconds
 * @returns The video bitrate
 */
export function getBitrate(size: number, duration: number): number {
  return Math.round((size * 8) / duration)
}

export enum BitrateCompressionRate {
  none = 1,
  low = 2,
  normal = 4,
  high = 8,
}

/**
 * Get the HLS video bitrate from resolution
 *
 * @param width Video resolution width
 * @param height Video resolution height
 * @returns The video bitrate
 */
export function getHlsBitrate(
  width: number,
  height: number,
  compressionRate: BitrateCompressionRate = 4,
): number {
  const area = width * height
  const bitrateMap = Object.fromEntries(
    [
      [0, 145] as const,
      [234, 145] as const,
      [360, 365] as const,
      [432, 915] as const,
      [540, 2000] as const,
      [720, 3750] as const,
      [1080, 6900] as const,
    ].map(([key, value]) => [(key * key * 16) / 9, value]),
  )

  if (bitrateMap[area]) {
    return bitrateMap[area]
  }

  const mapAreas = Object.keys(bitrateMap)
    .map(Number)
    .sort((a, b) => b - a)

  // if area is bigger than any in table, extend bitrate proportionally with last value
  const maxArea = mapAreas[0] as number
  if (maxArea < area) {
    const maxAreaValue = bitrateMap[maxArea] as number
    return (area * maxAreaValue) / maxArea
  }

  // else, create linear interpolation between prev and next value
  const floorKey = mapAreas.find((k) => k < area) as number
  const ceilingKey = mapAreas.sort((a, b) => a - b).find((k) => k > area) as number

  const ceilingValue = bitrateMap[ceilingKey] as number
  const floorValue = bitrateMap[floorKey] as number

  const bitrate =
    ((ceilingValue - floorValue) * (area - floorKey)) / (ceilingKey - floorKey) + floorValue
  return Math.round(bitrate / compressionRate)
}
