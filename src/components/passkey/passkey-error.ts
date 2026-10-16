/** Vietnamese message for a passkey failure; null when the user simply cancelled. */
export function passkeyError(e: unknown): string | null {
  const name = (e as { name?: string })?.name;
  if (name === "NotAllowedError" || name === "AbortError") return null;
  if (name === "InvalidStateError") return "Passkey này đã được thêm trên thiết bị.";
  return e instanceof Error && e.message ? e.message : "Passkey không dùng được. Hãy thử lại.";
}
