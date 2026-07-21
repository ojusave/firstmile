import { IDENTIFIER_MAX_LENGTH } from "@usecalibrate/contract/meta";

const DYNAMIC_SEGMENT = /^(?:\d+|[0-9a-f]{8,}|[0-9a-f-]{16,})$/i;

/**
 * Turns a pathname into a stable, bounded route id. Query strings and hashes are dropped
 * and dynamic-looking segments (numeric ids, hashes, uuids) collapse to ":id" so a real
 * user id or token never becomes part of the recorded route. The result is always a
 * valid identifier, so it passes the contract's privacy floor.
 */
export function routeId(pathname: string): string {
  const clean = pathname.split("?")[0]?.split("#")[0] ?? "/";
  const segments = clean.split("/").filter((segment) => segment.length > 0);
  if (segments.length === 0) return "/";
  const mapped = segments.map((segment) =>
    DYNAMIC_SEGMENT.test(segment) ? ":id" : segment.replace(/[^A-Za-z0-9._:-]/g, "-"),
  );
  const joined = `/${mapped.join("/")}`;
  return joined.slice(0, IDENTIFIER_MAX_LENGTH);
}

/**
 * Watches SPA and full-page navigation and reports the current route id. Hooks
 * pushState/replaceState/popstate, dedupes repeats, and returns a teardown function.
 */
export function observeRoutes(onRoute: (route: string) => void): () => void {
  let current: string | undefined;
  let active = true;

  const visit = (): void => {
    if (!active) return;
    const route = routeId(window.location.pathname);
    if (route === current) return;
    current = route;
    onRoute(route);
  };

  const originalPush = history.pushState;
  const originalReplace = history.replaceState;
  const push: History["pushState"] = function (this: History, ...args) {
    const result = originalPush.apply(this, args);
    visit();
    return result;
  };
  const replace: History["replaceState"] = function (this: History, ...args) {
    const result = originalReplace.apply(this, args);
    visit();
    return result;
  };
  const pop = (): void => visit();

  history.pushState = push;
  history.replaceState = replace;
  window.addEventListener("popstate", pop);
  visit();

  return () => {
    active = false;
    window.removeEventListener("popstate", pop);
    if (history.pushState === push) history.pushState = originalPush;
    if (history.replaceState === replace) history.replaceState = originalReplace;
  };
}
