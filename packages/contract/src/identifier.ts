import { z } from "zod";
import {
  IDENTIFIER_MAX_LENGTH,
  IDENTIFIER_PATTERN,
} from "./identifier-core.js";

/** A validated identifier of at most `max` characters. */
export function identifier(max: number = IDENTIFIER_MAX_LENGTH) {
  return z
    .string()
    .min(1)
    .max(max)
    .regex(
      IDENTIFIER_PATTERN,
      `must be a 1-${max} character identifier using letters, numbers, ".", "_", ":", "/", or "-"`,
    );
}

export {
  IDENTIFIER_MAX_LENGTH,
  CODE_MAX_LENGTH,
  isIdentifier,
} from "./identifier-core.js";
