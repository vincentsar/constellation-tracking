import { z } from "zod";

export const stableIdSchema = z
  .string()
  .regex(/^[a-zA-Z0-9_-]{1,80}$/)
  .refine(
    (id) =>
      !/^(con|prn|aux|nul|com[1-9]|lpt[1-9]|__proto__|constructor|prototype)$/i.test(
        id,
      ),
    "Identifier is not a portable file or record name.",
  );

// getRandomValues is available on plain HTTP LAN origins, where the browser's
// secure-context-only randomUUID method is unavailable.
export function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
