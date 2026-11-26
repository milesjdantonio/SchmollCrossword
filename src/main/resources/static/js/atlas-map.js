// The Atlas's map: where every world is, and the painted map itself (drawn by atlas-paint.js, in a worker so it never
// stalls the page; where a worker can't draw, in the page). The Notebook's ruled lowlands are in the south-west, the
// Garden's fields, Acorn Woods (the Great Hollow deep in it), Candy Hills on the east coast, Coral Reef on the shore
// (Atlantis under the water off it), Snow Day's peaks in the north-east, Rainy City on the river, the Sky Kingdom over
// the central mountains, the Desert in the west (the Sunken Dunes deeper in), the Carnival, the Arcade, the Library and
// the Factory along the north, Volcano Island in the northern sea (the Lava Cave in it), and at the very top the edge
// of the world, where the sea meets the stars and Deep Space (and the Celestial Rift) hang.
//   AtlasMap.W, AtlasMap.H       the map's size in units (the Atlas's plane)
//   AtlasMap.SPOT[world]         where a world is, [x, y]
//   AtlasMap.texture(regions)    the painted map, or null while it's being painted (regions: [{ world, ground, hill }])
//   AtlasMap.onReady(fn)         called once the painted map is there
const AtlasMap = (() => {
    const W = 2700, H = 2800;
    const SPOT = {
        paper: [430, 2470], garden: [990, 2520], squirrel: [1560, 2420], candy: [2150, 2290], ocean: [2370, 1880],
        snow: [2140, 1330], rain: [1640, 1620], sky: [1160, 1190], desert: [580, 1740], carnival: [430, 1170],
        arcade: [770, 770], library: [1260, 580], robot: [1790, 780], volcano: [2270, 520], space: [1460, 190],
        hollow: [1900, 2610], atlantis: [2610, 2180], dunes: [250, 2060], cave: [2460, 400], rift: [800, 200]
    };
    let picture = null, painting = false;
    const waiting = [];
    function done(p) { picture = p; painting = false; waiting.splice(0).forEach(fn => { try { fn(); } catch (err) { console.error(err); } }); }
    function inPage(regions) { try { done(AtlasPaint.paint({ W, H, SPOT, regions, scale: 1 })); } catch (err) { console.error("atlas map", err); painting = false; } }
    function start(regions) {
        if (picture || painting) return;
        painting = true;
        if (typeof Worker !== "function" || typeof OffscreenCanvas !== "function") return inPage(regions);
        try {
            const w = new Worker("js/atlas-paint.js");
            w.onmessage = e => { w.terminate(); if (e.data && e.data.error) { console.error("atlas map", e.data.error); inPage(regions); } else done(e.data); };
            w.onerror = () => { w.terminate(); inPage(regions); };
            w.postMessage({ W, H, SPOT, regions, scale: 1 });
        } catch (err) { inPage(regions); }
    }
    return {
        W, H, SPOT,
        texture(regions) { if (!picture) start(regions); return picture; },
        ready: () => !!picture,
        onReady(fn) { if (picture) fn(); else waiting.push(fn); }
    };
})();
