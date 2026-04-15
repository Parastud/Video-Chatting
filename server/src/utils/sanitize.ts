export const sanitize = (value: unknown, maxLen = 100): string =>
  String(value ?? "").trim().slice(0, maxLen);
