export const SPAN_SIZE = 8
export const MAX_SPAN_LENGTH = 2 ** 32 - 1
export const SECTION_SIZE = 32
export const BRANCHES = 128
export const CHUNK_SIZE = SECTION_SIZE * BRANCHES

export const MAX_CHUNK_PAYLOAD_SIZE = 4096
export const SEGMENT_SIZE = 32
export const SEGMENT_PAIR_SIZE = 2 * SEGMENT_SIZE
export const HASH_SIZE = 32

export const MIN_PAYLOAD_SIZE = 1
export const MAX_PAYLOAD_SIZE = 4096
export const CAC_SPAN_OFFSET = 0
export const CAC_PAYLOAD_OFFSET = CAC_SPAN_OFFSET + SPAN_SIZE

export const IDENTIFIER_SIZE = 32
export const SIGNATURE_SIZE = 65
export const SOC_IDENTIFIER_OFFSET = 0
export const SOC_SIGNATURE_OFFSET = SOC_IDENTIFIER_OFFSET + IDENTIFIER_SIZE
export const SOC_SPAN_OFFSET = SOC_SIGNATURE_OFFSET + SIGNATURE_SIZE
export const SOC_PAYLOAD_OFFSET = SOC_SPAN_OFFSET + SPAN_SIZE

export const ADDRESS_HEX_LENGTH = 64
export const PSS_TARGET_HEX_LENGTH_MAX = 6
export const PUBKEY_HEX_LENGTH = 66
export const BATCH_ID_HEX_LENGTH = 64
export const REFERENCE_HEX_LENGTH = 64
export const ENCRYPTED_REFERENCE_HEX_LENGTH = 128
export const REFERENCE_BYTES_LENGTH = 32
export const ENCRYPTED_REFERENCE_BYTES_LENGTH = 64

export const BUCKET_DEPTH = 16
export const STAMPS_DEPTH_MIN = 17
export const STAMPS_DEPTH_MAX = 255

export const TAGS_LIMIT_MIN = 1
export const TAGS_LIMIT_MAX = 1000

export const FEED_INDEX_HEX_LENGTH = 16
