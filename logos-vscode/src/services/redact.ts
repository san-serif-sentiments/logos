const GENERIC_SECRET_REGEX = /(api[_-]?key|secret|token|password|passwd|authorization)\s*[:=]\s*['\"]?([A-Za-z0-9\-_]{12,})['\"]?/gi;
const HEX_SECRET_REGEX = /\b[A-Fa-f0-9]{32,}\b/g;
const BASE64_SECRET_REGEX = /\b[A-Za-z0-9+/]{32,}={0,2}\b/g;

export function redactSecrets(input: string): string {
  if (!input) {
    return input;
  }
  let redacted = input.replace(GENERIC_SECRET_REGEX, (_match, key) => `${key}: ***redacted***`);
  redacted = redacted.replace(HEX_SECRET_REGEX, '***redacted***');
  redacted = redacted.replace(BASE64_SECRET_REGEX, (match) => {
    if (match.length > 40) {
      return '***redacted***';
    }
    return match;
  });
  return redacted;
}
