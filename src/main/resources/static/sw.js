// The service worker: lets the game work offline.
//   - Installing it saves the page and every script and stylesheet it links to, so the whole site opens offline.
//   - The page itself, and the puzzles (dailies, the Daily Archive, the campaign, the Daily Boss), always come from
//     the network when there is one, and are kept: offline, the last copy is used, so every puzzle you've opened
//     still works. Nothing is ever made up: a puzzle you never opened just isn't there.
//   - Files named by their content (game-<hash>.js) never change, so a kept copy is used at once. Other files (music,
//     sounds, pictures, files loaded by their plain name) are used at once too, and refreshed in the background.
//   - Anything else (the leaderboard, reports, posting) goes straight to the network: it needs a connection.
const VERSION = "1";
const PAGES = "schmoll-pages-" + VERSION, FILES = "schmoll-files-" + VERSION, PUZZLES = "schmoll-puzzles-" + VERSION, MEDIA = "schmoll-media-" + VERSION;
const KEEP = [PAGES, FILES, PUZZLES, MEDIA];
const PUZZLE_API = /^\/api\/(daily|archive|campaign|boss)(\/|$|\?)/;
const HASHED = /-[0-9a-f]{32}\.[a-z0-9]+$/;

self.addEventListener("install", event => {
    event.waitUntil((async () => {
        try {
            const res = await fetch("/", { cache: "no-store" });
            if (!res.ok) return;
            const html = await res.clone().text();
            await (await caches.open(PAGES)).put("/", res);
            // everything the page links to: its scripts, stylesheets and fonts (one failure doesn't stop the rest)
            const links = [...new Set([...html.matchAll(/(?:src|href)="((?:js|css|vendor|fonts)\/[^"?#]+)"/g)].map(m => "/" + m[1]))];
            const files = await caches.open(FILES);
            await Promise.all(links.map(u => files.add(u).catch(() => {})));
        } catch (err) { /* offline while installing: it tries again next visit */ }
    })());
    self.skipWaiting();
});

self.addEventListener("activate", event => {
    event.waitUntil((async () => {
        for (const name of await caches.keys()) if (name.startsWith("schmoll-") && !KEEP.includes(name)) await caches.delete(name);
        await self.clients.claim();
    })());
});

// A new page links to new versions of the files: the kept old versions (by their content names) are let go
async function prune(html) {
    const linked = new Set([...html.matchAll(/(?:src|href)="((?:js|css|vendor|fonts)\/[^"?#]+)"/g)].map(m => "/" + m[1]));
    const files = await caches.open(FILES);
    for (const req of await files.keys()) {
        const path = new URL(req.url).pathname;
        if (HASHED.test(path) && !linked.has(path)) await files.delete(req);
    }
}
// the network, kept for later; the kept copy when there's no network
async function networkFirst(request, cacheName, key = request) {
    const cache = await caches.open(cacheName);
    try {
        const res = await fetch(request);
        if (res.ok) {
            cache.put(key, res.clone());
            if (cacheName === PAGES) res.clone().text().then(prune).catch(() => {});
        }
        return res;
    } catch (err) {
        const kept = await cache.match(key);
        if (kept) return kept;
        throw err;
    }
}
// the kept copy at once (refreshed in the background), else the network
async function keptFirst(request, cacheName, refresh) {
    const cache = await caches.open(cacheName);
    const kept = await cache.match(request);
    const fresh = fetch(request).then(res => { if (res.ok) cache.put(request, res.clone()); return res; });
    if (kept) { if (refresh) fresh.catch(() => {}); return kept; }
    return fresh;
}

self.addEventListener("fetch", event => {
    const req = event.request;
    if (req.method !== "GET") return;
    const url = new URL(req.url);
    if (url.origin !== location.origin) return;
    if (req.mode === "navigate" && (url.pathname === "/" || url.pathname === "/index.html")) {
        event.respondWith(networkFirst(req, PAGES, "/"));
        return;
    }
    if (url.pathname.startsWith("/api/")) {
        if (PUZZLE_API.test(url.pathname + url.search)) event.respondWith(networkFirst(req, PUZZLES));
        return;                                                   // (the rest of the API needs a connection)
    }
    if (url.pathname === "/sw.js" || url.pathname.startsWith("/admin") || url.pathname.startsWith("/demo")) return;
    // audio (including partial requests for music) is kept whole, the first time it's heard
    if (url.pathname.startsWith("/audio/")) {
        if (req.headers.has("range")) return;
        event.respondWith(keptFirst(req, MEDIA, false));
        return;
    }
    if (url.pathname.startsWith("/rive/") || /\.(png|jpe?g|webp|svg|gif|ico)$/.test(url.pathname)) { event.respondWith(keptFirst(req, MEDIA, true)); return; }
    event.respondWith(keptFirst(req, FILES, !HASHED.test(url.pathname)));
});
