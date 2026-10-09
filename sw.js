// Service worker: guarda las pantallas de la app en el celular para que abran sin internet.
// Los datos (ventas, mesas, inventario) los maneja Firestore con su propia copia local;
// este archivo solo guarda los archivos de la app (HTML, JS, estilos, logo y la librería de Firebase).
const CACHE = "caja-restaurante-v11";
const APP = [
  "./", "index.html", "ventas.html", "caja.html", "mesas.html", "cocina.html", "admin.html", "clientes.html",
  "backend.js", "comun.js", "config.js", "estilo.css", "logo-quinta-josaid.png"
];
const LIBS = [
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(async c => {
    await Promise.all(APP.map(u => c.add(new Request(u, { cache: "reload" })).catch(() => {})));
    await Promise.all(LIBS.map(u => fetch(u, { mode: "cors" }).then(r => r.ok && c.put(u, r)).catch(() => {})));
  }).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("caja-restaurante-") && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const sinParam = u => { const x = new URL(u); x.search = ""; return x.href; };
const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error("lento")), ms));

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Archivos de la app: primero internet (para recibir actualizaciones), si no hay o tarda, la copia guardada.
  if (url.origin === self.location.origin) {
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      try {
        const r = await Promise.race([fetch(req), timeout(4000)]);
        if (r && r.ok) c.put(sinParam(req.url), r.clone());
        return r;
      } catch {
        const hit = await c.match(sinParam(req.url)) || await c.match(req, { ignoreSearch: true })
          || (req.mode === "navigate" ? await c.match(new URL("index.html", self.location).href) : null);
        return hit || new Response("Sin conexión", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      }
    })());
    return;
  }

  // Librerías (Firebase, jsPDF) y tipos de letra: versión fija, se usa la copia guardada.
  if (["www.gstatic.com", "cdnjs.cloudflare.com", "fonts.googleapis.com", "fonts.gstatic.com"].includes(url.hostname)) {
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      const hit = await c.match(req.url);
      if (hit) return hit;
      const r = await fetch(req);
      if (r && (r.ok || r.type === "opaque")) c.put(req.url, r.clone());
      return r;
    })());
  }
  // Todo lo demás (Firestore, inicio de sesión, Drive) pasa directo: Firestore maneja su propia cola sin internet.
});
