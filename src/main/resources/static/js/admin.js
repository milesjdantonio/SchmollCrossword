/*
 * The developer's admin page. The key is kept in sessionStorage (gone when the tab closes) and sent in the
 * X-Admin-Key header. Everything from the server is shown with textContent, so a report can never run as code.
 */
(() => {
  "use strict";
  const KEY = "schmoll.adminKey";
  const $ = (id) => document.getElementById(id);
  const KINDS = { "wrong-answer": "Wrong Answer", "unclear-clue": "Unclear Clue", typo: "Typo", offensive: "Offensive", technical: "Technical", other: "Other" };
  const DAILY_DIGIT = { 1: "easy", 2: "medium", 3: "hard", 4: "challenge" };
  let reports = [];

  const key = () => { try { return sessionStorage.getItem(KEY) || ""; } catch { return ""; } };
  const setKey = (k) => { try { k ? sessionStorage.setItem(KEY, k) : sessionStorage.removeItem(KEY); } catch { /* private window */ } };

  async function api(path, body) {
    const opts = { headers: { "X-Admin-Key": key() } };
    if (body) {
      opts.method = "POST";
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(path, opts);
    if (res.status === 404) throw Object.assign(new Error("That key isn't right, or no key is set on the server."), { wrongKey: true });
    if (!res.ok) {
      let msg = "The server said " + res.status + ".";
      try { const j = await res.json(); if (j.message || j.error) msg = j.message || j.error; } catch { /* not JSON */ }
      throw new Error(msg);
    }
    return (res.headers.get("Content-Type") || "").includes("json") ? res.json() : res.text();
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // ---- signing in ----
  function showPanel(on) {
    $("sign-in").hidden = on;
    $("panel").hidden = !on;
    $("sign-out").hidden = !on;
  }

  $("sign-in").addEventListener("submit", async (e) => {
    e.preventDefault();
    setKey($("key").value.trim());
    $("sign-in-error").textContent = "";
    try {
      await load();
      $("key").value = "";
    } catch (err) {
      setKey("");
      $("sign-in-error").textContent = err.message;
    }
  });

  $("sign-out").addEventListener("click", () => {
    setKey("");
    showPanel(false);
    $("key").focus();
  });

  async function load() {
    const status = await api("/api/admin/status");
    showPanel(true);
    drawStatus(status);
    await loadReports();
  }

  // ---- status ----
  function tile(label, value, sub, bad) {
    const t = el("div", "tile");
    t.append(el("div", "k", label), el("div", "v" + (bad ? " bad" : ""), String(value)));
    if (sub) t.append(el("div", "s", sub));
    return t;
  }

  function ago(iso) {
    if (!iso) return "Not yet";
    const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return mins + " min ago";
    return Math.round(mins / 60) + " h ago";
  }

  function drawStatus(s) {
    const d = s.dailies || {}, c = s.claudeSinceStart || {};
    const tiles = $("tiles");
    tiles.replaceChildren(
      tile("Dailies Ready", d.daysInStock + (d.daysInStock === 1 ? " day" : " days"),
        d.makeAheadDays > 0 ? "Keeping " + d.makeAheadDays + " ahead" : "Making ahead is off", d.daysInStock < 2),
      tile("Last Run", ago(d.lastRun), d.lastRun ? d.lastMade + " made, " + d.lastFailed + " failed" : "", d.lastFailed > 0),
      tile("Claude Cost", "$" + (c.estimatedCostUsd ?? 0).toFixed(3), (c.calls ?? 0) + " calls since start"),
      tile("API Key", s.apiKeySet ? "Set" : "Missing", "", !s.apiKeySet),
      tile("Players Today", s.playersToday ?? "?", (s.playersYesterday ?? "?") + " yesterday"),
      tile("Reports", s.reports ?? "?", "All time"),
      tile("Up For", upFor(s.upMinutes), "Server date " + s.serverDate)
    );
    const notes = [];
    if (d.lastError) notes.push("Last error: " + d.lastError);
    if (s.error) notes.push(s.error);
    $("status-note").textContent = notes.join(" · ");
    $("status-note").className = "note" + (notes.length ? " bad" : "");
  }

  function upFor(mins) {
    if (mins == null) return "?";
    if (mins < 60) return mins + " min";
    if (mins < 60 * 48) return Math.floor(mins / 60) + " h";
    return Math.floor(mins / 1440) + " days";
  }

  $("refresh").addEventListener("click", () => load().catch(fail));

  // ---- reports ----
  async function loadReports() {
    const text = await api("/api/admin/reports");
    reports = String(text).split("\n").filter((l) => l.trim()).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).reverse();
    drawReports();
  }

  // A daily's seed is its date and a digit: 202611081 = Nov 8, 2026, Easy
  function dailyOf(r) {
    const s = String(r.seed || "");
    if (r.mode !== "daily" || !/^20\d{7}$/.test(s)) return null;
    const kind = DAILY_DIGIT[s[8]];
    if (!kind) return null;
    return { date: s.slice(0, 4) + "-" + s.slice(4, 6) + "-" + s.slice(6, 8), kind };
  }

  function drawReports() {
    const want = $("report-kind").value;
    const list = $("reports");
    const shown = reports.filter((r) => !want || r.category === want).slice(0, 200);
    list.replaceChildren(...shown.map((r) => {
      const li = el("li");
      const meta = el("div", "meta");
      meta.append(el("span", "kind" + (r.category === "offensive" ? " offensive" : ""), KINDS[r.category] || "Other"));
      const daily = dailyOf(r);
      meta.append(el("span", null, new Date(r.time).toLocaleString()));
      meta.append(el("span", null, daily ? daily.date + " " + cap(daily.kind) : cap(r.mode || "") + " " + cap(r.difficulty || "") + " · seed " + r.seed));
      if (r.world) meta.append(el("span", null, r.world));
      li.append(meta);
      if (r.clue) li.append(el("p", "clue", r.clue));
      if (r.message) li.append(el("p", "msg", r.message));
      if (daily) {
        const b = el("button", "small danger", "Switch Off This Daily");
        b.type = "button";
        b.addEventListener("click", () => { $("disable-date").value = daily.date; $("disable-kind").value = daily.kind; $("disable").scrollIntoView({ behavior: "smooth", block: "center" }); $("disable-kind").focus(); });
        li.append(b);
      }
      return li;
    }));
    $("reports-empty").hidden = shown.length > 0;
  }

  const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : "";

  $("report-kind").addEventListener("change", drawReports);

  // ---- moderation ----
  function result(id, text, good) {
    $(id).textContent = text;
    $(id).className = "note " + (good ? "good" : "bad");
  }

  $("disable").addEventListener("submit", async (e) => {
    e.preventDefault();
    const date = $("disable-date").value, kind = $("disable-kind").value;
    if (!confirm("Switch off the " + kind + " daily for " + date + "?")) return;
    try {
      const r = await api("/api/admin/daily/disable", { date, kind });
      result("disable-result", r.disabled ? "Switched off. The next request makes a new one." : "There was no daily to switch off.", r.disabled);
    } catch (err) { result("disable-result", err.message, false); }
  });

  $("hide").addEventListener("submit", async (e) => {
    e.preventDefault();
    const date = $("hide-date").value, name = $("hide-name").value.trim();
    try {
      const r = await api("/api/admin/leaderboard/hide", { date, name });
      result("hide-result", r.removed ? "Took off " + r.removed + (r.removed === 1 ? " entry." : " entries.") : "No entries under that name that day.", r.removed > 0);
    } catch (err) { result("hide-result", err.message, false); }
  });

  function fail(err) {
    if (err.wrongKey) { setKey(""); showPanel(false); $("sign-in-error").textContent = err.message; return; }
    $("status-note").textContent = err.message;
    $("status-note").className = "note bad";
  }

  // today in the date fields; sign straight in if this tab already has the key
  const today = new Date();
  const iso = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
  $("disable-date").value = iso;
  $("hide-date").value = iso;
  if (key()) load().catch(fail);
})();
