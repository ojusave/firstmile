export const IDENTIFIER_MAX_LENGTH = 128;
export const CODE_MAX_LENGTH = 64;

/**
 * Bounded machine identifiers only, never free-form prose. This is the privacy floor:
 * anything that reaches the wire must match this shape, so user text and PII cannot ride
 * along in a field the schema would otherwise accept. Kept dependency-free so browser
 * clients can validate without pulling in the schema library.
 */
export const IDENTIFIER_PATTERN = /^[A-Za-z0-9:/][A-Za-z0-9._:/-]*$/;

/** Reports whether a value is a bounded machine identifier. */
export function isIdentifier(
  value: unknown,
  max: number = IDENTIFIER_MAX_LENGTH,
): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= max &&
    IDENTIFIER_PATTERN.test(value)
  );
}
