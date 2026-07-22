const numberFormatter = new Intl.NumberFormat("en-US");

export function formatPercent(value) {
  if (!Number.isFinite(value)) return "No data";
  return `${Math.round(Math.max(0, value) * 100)}%`;
}

export function formatDuration(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "No data";
  if (value < 1000) return `${Math.round(value)}ms`;
  const seconds = value / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return `${minutes}m ${remainder}s`;
}

export function dashboardApiPath(pathname) {
  const normalized = pathname.replace(/\/+$/, "");
  const suffix = "/dashboard";
  const base = normalized.endsWith(suffix)
    ? normalized.slice(0, -suffix.length)
    : "";
  return `${base}/api/dashboard`;
}

export function readDashboardToken(hash) {
  return new URLSearchParams(hash.replace(/^#/, "")).get("token") ?? "";
}

export function deriveSummary(snapshot) {
  const started = Number(snapshot.totals.started ?? 0);
  const shipped = Number(snapshot.totals.shipped ?? 0);
  return [
    { label: "Started", value: numberFormatter.format(started), note: "Sessions entering the flow" },
    { label: "Shipped", value: numberFormatter.format(shipped), note: "Sessions completing the flow" },
    { label: "Conversion", value: started === 0 ? "No data" : formatPercent(shipped / started), note: "Shipped from started" },
    { label: "Active now", value: numberFormatter.format(snapshot.totals.activeNow ?? 0), note: "Active and recently idle" },
    { label: "Median ship", value: formatDuration(snapshot.medianShipMs), note: "Median completed journey" },
  ];
}

export function deriveStepRows(snapshot) {
  const steps = Array.isArray(snapshot.steps) ? snapshot.steps : [];
  const shipped = Number(snapshot.totals.shipped ?? 0);
  const rows = steps.map((step, index) => {
    const nextCount = index === steps.length - 1
      ? shipped
      : Number(steps[index + 1]?.count ?? 0);
    return {
      order: index,
      id: String(step.id),
      group: String(step.group),
      count: Number(step.count ?? 0),
      dropoff: Math.max(0, Number(step.count ?? 0) - nextCount),
      errorCount: Number(step.errorCount ?? 0),
      backtracksFrom: Number(step.backtracksFrom ?? 0),
      returnsTo: Number(step.returnsTo ?? 0),
      medianMsInStep: step.medianMsInStep === null ? null : Number(step.medianMsInStep),
      signals: [],
    };
  });
  const maxima = {
    dropoff: Math.max(0, ...rows.map(row => row.dropoff)),
    errors: Math.max(0, ...rows.map(row => row.errorCount)),
    backtracks: Math.max(0, ...rows.map(row => row.backtracksFrom)),
    duration: Math.max(0, ...rows.map(row => row.medianMsInStep ?? 0)),
  };
  return rows.map(row => ({
    ...row,
    signals: [
      ...(maxima.dropoff > 0 && row.dropoff === maxima.dropoff ? ["Largest drop-off"] : []),
      ...(maxima.errors > 0 && row.errorCount === maxima.errors ? ["Most errors"] : []),
      ...(maxima.backtracks > 0 && row.backtracksFrom === maxima.backtracks ? ["Most backtracks"] : []),
      ...(maxima.duration > 0 && row.medianMsInStep === maxima.duration ? ["Longest median"] : []),
    ],
  }));
}

export function sortStepRows(rows, sortBy) {
  const copy = [...rows];
  const descending = (key, fallback = 0) => copy.sort((left, right) => {
    const difference = Number(right[key] ?? fallback) - Number(left[key] ?? fallback);
    return difference === 0 ? left.order - right.order : difference;
  });
  if (sortBy === "dropoff") return descending("dropoff");
  if (sortBy === "errors") return descending("errorCount");
  if (sortBy === "backtracks") return descending("backtracksFrom");
  if (sortBy === "duration") return descending("medianMsInStep", -1);
  return copy.sort((left, right) => left.order - right.order);
}

function requiredElement(selector) {
  const element = document.querySelector(selector);
  if (element === null) throw new Error(`missing dashboard element ${selector}`);
  return element;
}

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className !== "") element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function renderMetrics(container, metrics) {
  container.replaceChildren(...metrics.map(metric => {
    const card = node("article", "metric");
    card.append(
      node("div", "metric-label", metric.label),
      node("div", "metric-value", metric.value),
      node("div", "metric-note", metric.note),
    );
    return card;
  }));
}

function renderFunnel(container, snapshot) {
  const maximum = Math.max(0, Number(snapshot.totals.started ?? 0), ...snapshot.groups.map(group => Number(group.count ?? 0)));
  const entries = [
    {
      label: "Started",
      count: Number(snapshot.totals.started ?? 0),
      fromPrevious: 1,
      fromStart: 1,
      median: null,
    },
    ...snapshot.groups.map(group => ({
      label: String(group.label || group.id),
      count: Number(group.count ?? 0),
      fromPrevious: Number(group.conversionFromPrev ?? 0),
      fromStart: Number(group.conversionFromStart ?? 0),
      median: group.medianMsInGroup,
    })),
  ];
  container.replaceChildren(...entries.map((entry, index) => {
    const row = node("div", "funnel-row");
    const track = node("div", "funnel-track");
    const fill = node("div", "funnel-fill");
    const width = maximum === 0 ? 0 : entry.count / maximum * 100;
    fill.style.width = `${width}%`;
    fill.setAttribute("aria-hidden", "true");
    track.append(fill);
    const meta = node("div", "funnel-meta");
    meta.append(
      node("span", "", index === 0 ? "Entry baseline" : `${formatPercent(entry.fromPrevious)} from previous`),
      node("span", "", `${formatPercent(entry.fromStart)} from start`),
      node("span", "", `Median ${formatDuration(entry.median)}`),
    );
    row.append(
      node("div", "funnel-name", entry.label),
      track,
      node("div", "funnel-count", numberFormatter.format(entry.count)),
      meta,
    );
    return row;
  }));
}

function renderLifecycle(container, totals) {
  const values = [
    ["Active now", totals.activeNow],
    ["Backgrounded", totals.backgrounded],
    ["Closed", totals.closed],
    ["Bailed", totals.bailed],
    ["Backtracks", totals.backtracksTotal],
  ];
  container.replaceChildren(...values.map(([label, value]) => {
    const card = node("div", "lifecycle-item");
    card.append(
      node("div", "lifecycle-value", numberFormatter.format(value ?? 0)),
      node("div", "lifecycle-label", label),
    );
    return card;
  }));
}

function renderStepTable(container, rows) {
  container.replaceChildren(...rows.map(row => {
    const tr = document.createElement("tr");
    const stepCell = document.createElement("td");
    stepCell.append(node("div", "step-name", row.id));
    if (row.signals.length > 0) {
      const list = node("div", "signal-list");
      list.append(...row.signals.map(signal => node("span", "signal", signal)));
      stepCell.append(list);
    }
    tr.append(
      stepCell,
      node("td", "group-name", row.group),
      node("td", "", numberFormatter.format(row.count)),
      node("td", "", numberFormatter.format(row.dropoff)),
      node("td", "", numberFormatter.format(row.errorCount)),
      node("td", "", numberFormatter.format(row.backtracksFrom)),
      node("td", "", numberFormatter.format(row.returnsTo)),
      node("td", "", formatDuration(row.medianMsInStep)),
    );
    return tr;
  }));
}

function renderRecent(container, events) {
  const values = events.length === 0 ? ["Waiting for activity"] : events;
  container.replaceChildren(...values.map(event => node("li", "", String(event))));
}

export function renderDashboard(snapshot, sortBy = "order") {
  requiredElement("#manifest-version").textContent = String(snapshot.manifestVersion);
  renderMetrics(requiredElement("#summary-grid"), deriveSummary(snapshot));
  renderFunnel(requiredElement("#funnel"), snapshot);
  renderLifecycle(requiredElement("#lifecycle"), snapshot.totals);
  renderStepTable(requiredElement("#step-rows"), sortStepRows(deriveStepRows(snapshot), sortBy));
  renderRecent(requiredElement("#recent-events"), snapshot.recentEvents ?? []);
  requiredElement("#empty-note").hidden = Number(snapshot.totals.started ?? 0) !== 0;
}

export function initializeDashboard() {
  const dashboard = requiredElement("#dashboard-content");
  const statePanel = requiredElement("#state-panel");
  const stateTitle = requiredElement("#state-title");
  const stateCopy = requiredElement("#state-copy");
  const connection = requiredElement("#connection");
  const connectionLabel = requiredElement("#connection-label");
  const freshness = requiredElement("#freshness");
  const pauseButton = requiredElement("#pause");
  const refreshButton = requiredElement("#refresh");
  const sortSelect = requiredElement("#step-sort");
  const token = readDashboardToken(window.location.hash);
  const state = {
    snapshot: null,
    lastSuccess: 0,
    failures: 0,
    paused: false,
    timer: 0,
    controller: null,
    unauthorized: false,
  };

  if (window.location.hash !== "") {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }

  const setConnection = (kind, label) => {
    connection.dataset.state = kind;
    connectionLabel.textContent = label;
  };

  const showBlockingState = (title, copy, kind) => {
    stateTitle.textContent = title;
    stateCopy.textContent = copy;
    statePanel.hidden = false;
    dashboard.hidden = true;
    setConnection(kind, title);
  };

  const schedule = delay => {
    window.clearTimeout(state.timer);
    if (!state.paused && !document.hidden && !state.unauthorized) {
      state.timer = window.setTimeout(() => void poll(), delay);
    }
  };

  const poll = async () => {
    if (token === "" || state.paused || document.hidden) return;
    state.controller?.abort();
    const controller = new AbortController();
    state.controller = controller;
    if (state.snapshot === null) setConnection("loading", "Connecting");
    try {
      const response = await fetch(dashboardApiPath(window.location.pathname), {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      if (response.status === 401) {
        state.unauthorized = true;
        showBlockingState(
          "Dashboard token rejected",
          "Check DASHBOARD_TOKEN and open this route again with #token=YOUR_DASHBOARD_TOKEN.",
          "unauthorized",
        );
        return;
      }
      if (!response.ok) throw new Error(`dashboard request failed with ${response.status}`);
      const snapshot = await response.json();
      state.snapshot = snapshot;
      state.lastSuccess = Date.now();
      state.failures = 0;
      renderDashboard(snapshot, sortSelect.value);
      statePanel.hidden = true;
      dashboard.hidden = false;
      freshness.textContent = "Updated just now";
      setConnection("live", "Live");
      schedule(2000);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      state.failures += 1;
      if (state.snapshot === null) {
        showBlockingState(
          "Dashboard unavailable",
          "The last request failed. Calibrate will retry automatically, or use Refresh to try now.",
          "error",
        );
      } else {
        setConnection("stale", "Showing stale data");
      }
      schedule(Math.min(30000, 2000 * 2 ** Math.min(state.failures, 4)));
    }
  };

  pauseButton.addEventListener("click", () => {
    state.paused = !state.paused;
    pauseButton.setAttribute("aria-pressed", String(state.paused));
    pauseButton.textContent = state.paused ? "Resume live" : "Pause live";
    if (state.paused) {
      window.clearTimeout(state.timer);
      state.controller?.abort();
      setConnection("stale", "Updates paused");
    } else {
      state.unauthorized = false;
      void poll();
    }
  });

  refreshButton.addEventListener("click", () => {
    state.unauthorized = false;
    void poll();
  });

  sortSelect.addEventListener("change", () => {
    if (state.snapshot !== null) renderDashboard(state.snapshot, sortSelect.value);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      window.clearTimeout(state.timer);
      state.controller?.abort();
    } else if (!state.paused) {
      void poll();
    }
  });

  window.setInterval(() => {
    if (state.lastSuccess === 0) return;
    const ageSeconds = Math.max(0, (Date.now() - state.lastSuccess) / 1000);
    freshness.textContent = `Updated ${ageSeconds.toFixed(ageSeconds < 10 ? 1 : 0)}s ago`;
    if (ageSeconds > 8 && !state.paused) setConnection("stale", "Showing stale data");
  }, 1000);

  if (token === "") {
    showBlockingState(
      "Dashboard token required",
      "Open this route with #token=YOUR_DASHBOARD_TOKEN. The token stays in browser memory and is removed from the visible address bar.",
      "unauthorized",
    );
    return;
  }
  void poll();
}

if (
  typeof window !== "undefined" &&
  typeof document !== "undefined" &&
  document.body?.hasAttribute("data-calibrate-dashboard")
) {
  initializeDashboard();
}
