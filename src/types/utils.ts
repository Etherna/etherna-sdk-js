export type HexString<Length = number> = string & {
  readonly length: Length
}

export interface Bytes<Length extends number> extends Uint8Array {
  readonly length: Length
}
