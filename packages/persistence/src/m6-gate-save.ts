const GATE_SAVE_MAGIC = "WTM6GATE";
const GATE_SAVE_VERSION = 1;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export interface M6GateSaveEnvelope {
  readonly authoringNote: string;
  readonly fixtureId: string;
  readonly format: "wm-m6-gate-save";
  readonly formatVersion: 1;
  readonly lastInputLabel: string;
  readonly readModelHash: string;
  readonly releaseGateTitle: string;
  readonly runtimeBrowser: string;
  readonly savedAtUnixMs: number;
  readonly selectedEntityId: string | null;
}

export interface DecodedM6GateSaveEnvelope {
  readonly checksumSha256Hex: string;
  readonly data: M6GateSaveEnvelope;
  readonly sizeBytes: number;
}

export function buildM6GateSaveEnvelope(input: {
  readonly fixtureId: string;
  readonly lastInputLabel: string;
  readonly readModelHash: string;
  readonly releaseGateTitle: string;
  readonly runtimeBrowser: string;
  readonly savedAtUnixMs: number;
  readonly selectedEntityId: string | undefined;
}): M6GateSaveEnvelope {
  return Object.freeze({
    authoringNote:
      "M6 gate evidence envelope only. Not a public save compatibility promise beyond the Web/Windows product gate.",
    fixtureId: input.fixtureId,
    format: "wm-m6-gate-save",
    formatVersion: GATE_SAVE_VERSION,
    lastInputLabel: input.lastInputLabel,
    readModelHash: input.readModelHash,
    releaseGateTitle: input.releaseGateTitle,
    runtimeBrowser: input.runtimeBrowser,
    savedAtUnixMs: input.savedAtUnixMs,
    selectedEntityId: input.selectedEntityId ?? null,
  });
}

export async function decodeM6GateSaveEnvelope(
  bytes: Uint8Array,
): Promise<DecodedM6GateSaveEnvelope> {
  const parsed = parseJson(bytes);
  if (!isRecord(parsed)) {
    throw new Error("The imported save envelope is not a JSON object.");
  }

  if (parsed["magic"] !== GATE_SAVE_MAGIC) {
    throw new Error("The imported save envelope magic is not recognized.");
  }

  if (parsed["formatVersion"] !== GATE_SAVE_VERSION) {
    throw new Error("The imported save envelope version is unsupported.");
  }

  const payload = parsed["payload"];
  if (!isEnvelope(payload)) {
    throw new Error("The imported save envelope payload is invalid.");
  }

  return {
    checksumSha256Hex: await computeSha256Hex(bytes),
    data: payload,
    sizeBytes: bytes.byteLength,
  };
}

export function encodeM6GateSaveEnvelope(envelope: M6GateSaveEnvelope): Promise<Uint8Array> {
  const serialized = JSON.stringify(
    {
      formatVersion: GATE_SAVE_VERSION,
      magic: GATE_SAVE_MAGIC,
      payload: envelope,
    },
    null,
    2,
  );
  return Promise.resolve(textEncoder.encode(serialized));
}

export async function computeSha256Hex(bytes: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", cloneBytes(bytes));
  const hashBytes = new Uint8Array(hashBuffer);
  let output = "";
  for (const hashByte of hashBytes) {
    output += hashByte.toString(16).padStart(2, "0");
  }

  return output;
}

function isEnvelope(value: unknown): value is M6GateSaveEnvelope {
  return (
    isRecord(value) &&
    value["format"] === "wm-m6-gate-save" &&
    value["formatVersion"] === GATE_SAVE_VERSION &&
    typeof value["authoringNote"] === "string" &&
    typeof value["fixtureId"] === "string" &&
    typeof value["lastInputLabel"] === "string" &&
    typeof value["readModelHash"] === "string" &&
    typeof value["releaseGateTitle"] === "string" &&
    typeof value["runtimeBrowser"] === "string" &&
    typeof value["savedAtUnixMs"] === "number" &&
    (typeof value["selectedEntityId"] === "string" || value["selectedEntityId"] === null)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseJson(bytes: Uint8Array): unknown {
  const text = textDecoder.decode(bytes);
  return JSON.parse(text);
}

function cloneBytes(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}
