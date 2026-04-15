export function maskEmailAddress(email: string | null | undefined): string | null {
  if (!email) return null;

  const normalized = email.trim();
  const atIndex = normalized.indexOf("@");
  if (atIndex <= 0 || atIndex === normalized.length - 1) {
    return normalized;
  }

  const localPart = normalized.slice(0, atIndex);
  const domain = normalized.slice(atIndex + 1);
  const firstChar = localPart[0] ?? "";

  if (localPart.length === 1) {
    return `${firstChar}***@${domain}`;
  }

  return `${firstChar}${"*".repeat(Math.max(3, localPart.length - 1))}@${domain}`;
}
