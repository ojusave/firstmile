/**
 * Single source of truth for the product name. The name is a placeholder and will
 * change; everything user-visible or wire-visible derives from here so a rename is a
 * one-line edit, never a find-and-replace.
 */
export const PRODUCT_NAME = "Firstmile";

/** Lowercase slug used for storage keys, the CLI, and default paths. */
export const PRODUCT_SLUG = "firstmile";

/** Default same-origin path where the browser client posts events. */
export const DEFAULT_ENDPOINT_PATH = `/__${PRODUCT_SLUG}`;

/** Prefix for browser storage keys, namespaced so hosts never collide. */
export const STORAGE_PREFIX = `${PRODUCT_SLUG}:`;
