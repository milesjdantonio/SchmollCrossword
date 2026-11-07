// Shows one demo option inside a phone-sized frame (390 x 844), scaled to fit the window.
(() => {
    const OPTIONS = { a: "World Stage", b: "The Everbook", c: "Journey Line" };
    const key = new URLSearchParams(location.search).get("o");
    const id = Object.hasOwn(OPTIONS, key) ? key : "a";          // only the demo pages, never another address
    const src = `campaign/${id}.html`;
    document.getElementById("dp-title").textContent = `${OPTIONS[id]} on a Phone`;
    document.getElementById("dp-open").href = src;
    document.getElementById("dp-frame").src = src;
    const phone = document.getElementById("dp-phone");
    const fit = () => { const k = Math.min(1, (innerHeight - 110) / 870, (innerWidth - 32) / 410); phone.style.scale = String(k); };
    addEventListener("resize", fit);
    fit();
})();
