const FNV_OFFSET_BASIS = 2_166_136_261;
const FNV_PRIME = 16_777_619;

export function hashStringToUint32(input: string): number {
  let hash = FNV_OFFSET_BASIS;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }

  return hash;
}

export function mixUint32(hash: number, value: number): number {
  let nextHash = hash ^ (value >>> 0);
  nextHash = Math.imul(nextHash, FNV_PRIME) >>> 0;
  return nextHash;
}

export function formatUint32Hex(value: number): string {
  return `0x${toFixedHex32(value)}`;
}

function toFixedHex32(value: number): string {
  const hex = (value >>> 0).toString(16);
  let padded = hex;

  while (padded.length < 8) {
    padded = `0${padded}`;
  }

  return padded;
}
