import { PRODUCT_NAME } from "@firstmile/contract";

const FAVICON =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#111"/><path d="M9 22V10h11M9 16h8" stroke="#4ade80" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>`,
  );

/** The self-hosted dashboard. One file, no build step, polls the snapshot API. */
export const DASHBOARD_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${PRODUCT_NAME} dashboard</title>
<link rel="icon" href="${FAVICON}" />
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 15px/1.5 -apple-system, system-ui, sans-serif; background: #0a0a0a; color: #e7e7e7; }
  header { padding: 20px 28px; border-bottom: 1px solid #1e1e1e; display: flex; align-items: baseline; gap: 12px; }
  header h1 { font-size: 18px; margin: 0; }
  header .muted { color: #888; font-size: 13px; }
  main { padding: 24px 28px; max-width: 980px; margin: 0 auto; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; margin-bottom: 28px; }
  .card { background: #131313; border: 1px solid #1e1e1e; border-radius: 10px; padding: 14px 16px; }
  .card .n { font-size: 26px; font-weight: 650; }
  .card .l { color: #8a8a8a; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: .05em; color: #9a9a9a; margin: 28px 0 12px; }
  .row { display: flex; align-items: center; gap: 12px; margin: 6px 0; }
  .row .label { width: 210px; font-variant-numeric: tabular-nums; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bar { flex: 1; height: 22px; background: #161616; border-radius: 5px; overflow: hidden; }
  .bar > span { display: block; height: 100%; background: linear-gradient(90deg,#22c55e,#4ade80); }
  .row .pct { width: 92px; text-align: right; color: #9a9a9a; font-variant-numeric: tabular-nums; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #1a1a1a; font-variant-numeric: tabular-nums; }
  th { color: #8a8a8a; font-weight: 500; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
  td.err { color: #f87171; }
  .feed { list-style: none; padding: 0; margin: 0; }
  .feed li { padding: 6px 0; border-bottom: 1px solid #161616; color: #cfcfcf; }
  .empty { color: #6a6a6a; padding: 16px 0; }
</style>
</head>
<body>
<header>
  <h1>${PRODUCT_NAME}</h1>
  <span class="muted" id="status">loading…</span>
</header>
<main>
  <div class="cards" id="cards"></div>
  <h2>Funnel</h2>
  <div id="funnel"></div>
  <h2>Field friction</h2>
  <div id="fields"></div>
  <h2>Recent activity</h2>
  <ul class="feed" id="feed"></ul>
</main>
<script>
const fmt = (n) => new Intl.NumberFormat().format(n);
const pct = (r) => (r * 100).toFixed(0) + "%";
async function tick() {
  try {
    const res = await fetch("api/dashboard");
    if (!res.ok) throw new Error(res.status);
    render(await res.json());
    document.getElementById("status").textContent = "updated " + new Date().toLocaleTimeString();
  } catch (e) {
    document.getElementById("status").textContent = "collector unreachable";
  }
}
function render(s) {
  const t = s.totals;
  document.getElementById("cards").innerHTML = [
    ["Started", t.started], ["Shipped", t.shipped], ["Active now", t.activeNow],
    ["Backgrounded", t.backgrounded], ["Closed", t.closed], ["Bailed", t.bailed],
  ].map(([l, n]) => '<div class="card"><div class="n">' + fmt(n) + '</div><div class="l">' + l + '</div></div>').join("");

  const funnel = document.getElementById("funnel");
  funnel.innerHTML = s.funnel.length === 0
    ? '<div class="empty">No pages observed yet.</div>'
    : s.funnel.map((f) =>
        '<div class="row"><div class="label">' + f.route + '</div>' +
        '<div class="bar"><span style="width:' + pct(f.conversionFromStart) + '"></span></div>' +
        '<div class="pct">' + fmt(f.reached) + ' · ' + pct(f.conversionFromStart) + '</div></div>'
      ).join("");

  const fields = document.getElementById("fields");
  fields.innerHTML = s.fields.length === 0
    ? '<div class="empty">No field interactions yet.</div>'
    : '<table><thead><tr><th>Field</th><th>Focus</th><th>Fill</th><th>Blank</th><th>Errors</th></tr></thead><tbody>' +
      s.fields.map((f) =>
        '<tr><td>' + f.name + '</td><td>' + fmt(f.focus) + '</td><td>' + fmt(f.fill) +
        '</td><td>' + fmt(f.blank) + '</td><td class="' + (f.error ? 'err' : '') + '">' + fmt(f.error) + '</td></tr>'
      ).join("") + '</tbody></table>';

  const feed = document.getElementById("feed");
  feed.innerHTML = s.recentEvents.length === 0
    ? '<li class="empty">Nothing yet.</li>'
    : s.recentEvents.slice().reverse().map((m) => '<li>' + m + '</li>').join("");
}
tick();
setInterval(tick, 5000);
</script>
</body>
</html>`;
