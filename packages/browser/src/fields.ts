import { IDENTIFIER_MAX_LENGTH, isIdentifier } from "@firstmile/contract/meta";

type FieldAction = "focus" | "fill" | "blank" | "blur" | "error";

export interface FieldSignal {
  name: string;
  fieldType: string;
  action: FieldAction;
  attempt?: number;
}

const CAPTURED_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);
const SENSITIVE_TYPES = new Set(["password", "hidden"]);

/**
 * Auto-detects form-field interaction through event delegation. It records that a field
 * was focused, filled, left blank, blurred, or rejected, plus a per-field attempt count.
 * It never reads the field value: "filled" is derived from value length being non-zero,
 * a boolean, and password/hidden inputs are ignored entirely.
 */
export function observeFields(onSignal: (signal: FieldSignal) => void): () => void {
  const filled = new WeakSet<Element>();
  const attempts = new WeakMap<Element, number>();

  const describe = (element: Element): { name: string; fieldType: string } | null => {
    if (!CAPTURED_TAGS.has(element.tagName)) return null;
    const fieldType = fieldTypeOf(element);
    if (SENSITIVE_TYPES.has(fieldType)) return null;
    const name = fieldNameOf(element);
    return name === null ? null : { name, fieldType };
  };

  const onFocusIn = (event: Event): void => {
    const target = event.target as Element | null;
    if (target === null) return;
    const info = describe(target);
    if (info !== null) onSignal({ ...info, action: "focus" });
  };

  const onInput = (event: Event): void => {
    const target = event.target as (Element & { value?: string }) | null;
    if (target === null || filled.has(target)) return;
    const info = describe(target);
    if (info === null) return;
    if (typeof target.value === "string" && target.value.length > 0) {
      filled.add(target);
      onSignal({ ...info, action: "fill" });
    }
  };

  const onFocusOut = (event: Event): void => {
    const target = event.target as (Element & { value?: string }) | null;
    if (target === null) return;
    const info = describe(target);
    if (info === null) return;
    const empty = typeof target.value === "string" ? target.value.length === 0 : false;
    onSignal({ ...info, action: empty ? "blank" : "blur" });
  };

  const onInvalid = (event: Event): void => {
    const target = event.target as Element | null;
    if (target === null) return;
    const info = describe(target);
    if (info === null) return;
    const attempt = (attempts.get(target) ?? 0) + 1;
    attempts.set(target, attempt);
    onSignal({ ...info, action: "error", attempt });
  };

  document.addEventListener("focusin", onFocusIn, true);
  document.addEventListener("input", onInput, true);
  document.addEventListener("focusout", onFocusOut, true);
  document.addEventListener("invalid", onInvalid, true);

  return () => {
    document.removeEventListener("focusin", onFocusIn, true);
    document.removeEventListener("input", onInput, true);
    document.removeEventListener("focusout", onFocusOut, true);
    document.removeEventListener("invalid", onInvalid, true);
  };
}

function fieldTypeOf(element: Element): string {
  const explicit = element.getAttribute("type");
  if (explicit !== null && isIdentifier(explicit)) return explicit.toLowerCase();
  return element.tagName.toLowerCase();
}

/**
 * Derives a stable field name from `data-fm`, `name`, or `id`, in that order. These are
 * developer-authored identifiers, not user content. Anything that is not a clean
 * identifier is skipped rather than guessed, so labels and placeholders never leak.
 */
function fieldNameOf(element: Element): string | null {
  const candidates = [
    element.getAttribute("data-fm"),
    element.getAttribute("name"),
    element.getAttribute("id"),
  ];
  for (const candidate of candidates) {
    if (candidate !== null && isIdentifier(candidate, IDENTIFIER_MAX_LENGTH)) {
      return candidate;
    }
  }
  return null;
}
