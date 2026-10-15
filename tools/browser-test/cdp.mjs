// A small DevTools-protocol driver for headless (hidden) Edge, for automated browser tests.
//
// Why this file exists: old test scripts started Edge and only closed it on their last line.
// When a script crashed or was stopped, the hidden Edge kept running the game (canvases,
// boss fights, music) with nobody watching, and a few of them used ~80% of the CPU.
// This helper makes sure Edge always goes away:
//   1. close() and every way the script can end (error, Ctrl+C, process.exit) kill Edge's
//      whole process tree (taskkill /T), not just the main process;
//   2. a watchdog (watchdog.ps1, a separate program started outside this script's process tree)
//      kills Edge if this script is killed outright (then no exit handler runs) and when the
//      time limit is up, then deletes the profile and the lock;
//   3. a hard time limit (10 minutes by default);
//   4. only one test browser at a time (a lock file);
//   5. muted, no extensions, no update downloads, and a fresh profile folder that is deleted.
// If anything is ever left over: powershell -File tools/browser-test/kill-test-browsers.ps1
//
// Usage:
//   import { launch } from "<repo>/tools/browser-test/cdp.mjs";
//   const b = await launch(outDir, { maxMinutes: 5 });
//   await b.send("Page.navigate", { url: "http://localhost:8080" });
//   ...
//   b.close();
import { spawn, spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const HERE = dirname(fileURLToPath(import.meta.url));
export const MARK = "schmoll-edge-";                 // every test profile folder starts with this
const LOCK = join(tmpdir(), "schmoll-edge.lock");   // holds the PID of the script using the browser
const sleep = ms => new Promise(r => setTimeout(r, ms));

let active = null;                                  // the one open browser's kill function

// one cleanup for every way this script can end (registered once)
let hooked = false;
function hookExits() {
    if (hooked) return;
    hooked = true;
    process.on("exit", () => active && active());
    for (const sig of ["SIGINT", "SIGTERM", "SIGBREAK", "SIGHUP"]) {
        process.on(sig, () => { if (active) active(); process.exit(130); });
    }
    const crash = e => { console.error(e); if (active) active(); process.exit(1); };
    process.on("uncaughtException", crash);
    process.on("unhandledRejection", crash);
}

function alive(pid) {
    try { process.kill(pid, 0); return true; } catch { return false; }
}

function takeLock() {
    for (let i = 0; i < 2; i++) {
        try { writeFileSync(LOCK, String(process.pid), { flag: "wx" }); return; } catch {}
        let owner = 0;
        try { owner = parseInt(readFileSync(LOCK, "utf8"), 10); } catch {}
        if (owner && owner !== process.pid && alive(owner)) {
            throw new Error(`Another browser test is running (process ${owner}). Wait for it, or run tools/browser-test/kill-test-browsers.ps1`);
        }
        try { unlinkSync(LOCK); } catch {}           // left by a test that died: take it over
    }
    throw new Error("Couldn't take the browser-test lock " + LOCK);
}

function dropLock() {
    try { if (readFileSync(LOCK, "utf8").trim() === String(process.pid)) unlinkSync(LOCK); } catch {}
}

// Profile folders left by a test that was killed along with its watchdog. We hold the lock,
// so no other test is using them.
function clearOldProfiles() {
    let names = [];
    try { names = readdirSync(tmpdir()).filter(n => n.startsWith(MARK)); } catch {}
    for (const n of names) { try { rmSync(join(tmpdir(), n), { recursive: true, force: true }); } catch {} }
}

// The watchdog is started through Windows' process service (WMI), not as our child: something
// that kills this script's whole process tree (PowerShell does, and so may a tool's timeout)
// would otherwise kill the watchdog too, before it could clean up.
function startWatchdog(edgePid, profile, minutes) {
    const q = s => "'" + s.replace(/'/g, "''") + "'";      // a PowerShell string
    const cmd = `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "${join(HERE, "watchdog.ps1")}"`
        + ` -ParentPid ${process.pid} -EdgePid ${edgePid} -ProfileDir "${profile}" -LockFile "${LOCK}" -MaxMinutes ${minutes}`;
    const ps = `$si = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ ShowWindow = [uint16]0 }
$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = ${q(cmd)}; ProcessStartupInformation = $si }
exit $r.ReturnValue`;
    const r = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(ps, "utf16le").toString("base64")],
        { stdio: "ignore", windowsHide: true, timeout: 20000 });
    if (r.status !== 0) {
        // fall back to a child watchdog: it still covers a killed script, just not a tree kill
        spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden",
            "-File", join(HERE, "watchdog.ps1"), "-ParentPid", String(process.pid), "-EdgePid", String(edgePid),
            "-ProfileDir", profile, "-LockFile", LOCK, "-MaxMinutes", String(minutes)],
            { detached: true, stdio: "ignore", windowsHide: true }).unref();
    }
}

// The second argument used to be a port number; a number is still accepted and ignored
// (Edge now picks a free port itself, so two tests can never collide on one).
export async function launch(out, opts = {}) {
    if (typeof opts !== "object" || opts === null) opts = {};
    const { maxMinutes = 10, sound = false, width = 1366, height = 860, timeoutMs = 120000 } = opts;
    hookExits();
    if (active) throw new Error("This script already has a browser open; close() it first.");
    takeLock();
    clearOldProfiles();
    mkdirSync(out, { recursive: true });
    const profile = mkdtempSync(join(tmpdir(), MARK));
    const args = [
        "--headless=new", "--remote-debugging-port=0", "--user-data-dir=" + profile,
        `--window-size=${width},${height}`,
        "--no-first-run", "--no-default-browser-check", "--disable-extensions",
        "--disable-component-update", "--disable-background-networking", "--disable-sync",
        "--disable-default-apps", "--autoplay-policy=no-user-gesture-required",
    ];
    if (!sound) args.push("--mute-audio");
    args.push("about:blank");
    const edge = spawn(EDGE, args, { stdio: "ignore", windowsHide: true });

    let ws = null, closed = false, limit = null;
    const pending = new Map();
    const kill = () => {
        if (closed) return;
        closed = true;
        active = null;
        clearTimeout(limit);
        try { ws && ws.close(); } catch {}
        for (const [, p] of pending) p.reject(new Error("browser closed"));
        pending.clear();
        if (edge.pid) spawnSync("taskkill", ["/PID", String(edge.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
        // Edge can hold its files for a moment after it's killed; the watchdog retries if this fails
        try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch {}
        dropLock();
    };
    active = kill;

    if (edge.pid) startWatchdog(edge.pid, profile, maxMinutes + 1);
    limit = setTimeout(() => {
        console.error(`Browser test hit its ${maxMinutes} minute limit; closing Edge.`);
        kill();
        process.exit(1);
    }, maxMinutes * 60000);
    limit.unref();
    edge.on("error", e => { console.error("Edge failed to start:", e.message); kill(); });
    edge.on("exit", () => { for (const [, p] of pending) p.reject(new Error("Edge exited")); pending.clear(); });

    try {
        // Edge writes the port it picked into DevToolsActivePort in the profile folder
        let port = 0;
        for (let i = 0; i < 120 && !port && !closed; i++) {
            try { port = parseInt(readFileSync(join(profile, "DevToolsActivePort"), "utf8").split("\n")[0], 10) || 0; } catch {}
            if (!port) await sleep(250);
        }
        if (!port) throw new Error("Edge didn't start within 30 s");
        let page = null;
        for (let i = 0; i < 80 && !page; i++) {
            try { page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === "page"); } catch {}
            if (!page) await sleep(250);
        }
        if (!page) throw new Error("Edge has no page to drive");
        ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = () => fail(new Error("Couldn't connect to Edge")); });
    } catch (e) {
        kill();
        throw e;
    }
    ws.onclose = () => { for (const [, p] of pending) p.reject(new Error("connection to Edge closed")); pending.clear(); };

    let id = 0;
    const errors = [], listeners = {};
    const on = (method, fn) => { (listeners[method] = listeners[method] || []).push(fn); };
    ws.onmessage = m => {
        const msg = JSON.parse(m.data);
        if (msg.method && listeners[msg.method]) listeners[msg.method].forEach(fn => fn(msg.params));
        if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); clearTimeout(p.timer); p.resolve(msg); }
        if (msg.method === "Runtime.exceptionThrown") errors.push("EXC " + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text));
        if (msg.method === "Runtime.consoleAPICalled" && (msg.params.type === "error" || msg.params.type === "warning")) errors.push(msg.params.type + " " + msg.params.args.map(a => a.value || a.description).join(" "));
        if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") errors.push("LOG " + msg.params.entry.text + " " + (msg.params.entry.url || ""));
    };
    // every command gives up after timeoutMs instead of waiting forever
    const send = (method, params = {}) => new Promise((resolve, reject) => {
        if (closed) return reject(new Error("browser closed"));
        const i = ++id;
        const timer = setTimeout(() => { pending.delete(i); reject(new Error(`${method} took over ${timeoutMs / 1000} s`)); }, timeoutMs);
        pending.set(i, { resolve, reject, timer });
        ws.send(JSON.stringify({ id: i, method, params }));
    });
    const ev = async expr => {
        const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
        if (r.result?.exceptionDetails) errors.push("EVAL " + (r.result.exceptionDetails.exception?.description || JSON.stringify(r.result.exceptionDetails)) + " IN: " + expr.slice(0, 90));
        return r.result?.result?.value;
    };
    const shot = async (name, clip) => {
        const r = await send("Page.captureScreenshot", clip ? { format: "png", clip: { ...clip, scale: 1 } } : { format: "png" });
        writeFileSync(out + "/" + name + ".png", Buffer.from(r.result.data, "base64"));
    };
    const viewport = (w, h, mobile = false) => send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile });
    const key = async k => {
        await send("Input.dispatchKeyEvent", { type: "keyDown", key: k, text: k.length === 1 ? k : undefined, code: k.length === 1 ? "Key" + k.toUpperCase() : k });
        await send("Input.dispatchKeyEvent", { type: "keyUp", key: k });
    };
    const click = async (x, y) => {
        await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
        await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
    };
    await send("Runtime.enable");
    await send("Page.enable");
    await send("Log.enable");
    return { on, send, ev, shot, viewport, key, click, sleep, errors, close: kill };
}
