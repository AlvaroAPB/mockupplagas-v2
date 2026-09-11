/**
 * Service Worker para Sacudidas v24h.2
 * Estrategia: cache-first para app shell + librerías, network-first para Supabase
 *
 * Al desplegar nueva versión:
 *   1. Incrementar CACHE_VERSION (ej: "v24h2-1" -> "v24h2-2").
 *   2. Al abrir la app con wifi, el navegador detectará el sw.js modificado.
 *   3. Instalará el nuevo cache y activará al recargar.
 *   4. Elimina automáticamente cachés antiguas.
 */

const CACHE_VERSION = "monitoreo-v25c-3";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  // Librerías externas críticas (CDN)
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css",
  "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
  "https://unpkg.com/@tmcw/togeojson@5.8.1/dist/togeojson.umd.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"
];

self.addEventListener("install", (event) => {
  console.log("[SW] Install", CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return Promise.all(
        APP_SHELL.map((url) =>
          cache.add(url).catch((err) => {
            console.warn("[SW] No se pudo cachear:", url, err.message);
          })
        )
      );
    })
  );
});

self.addEventListener("activate", (event) => {
  console.log("[SW] Activate", CACHE_VERSION);
  event.waitUntil(
    caches.keys().then((nombres) => {
      return Promise.all(
        nombres
          .filter((n) => n !== CACHE_VERSION)
          .map((n) => {
            console.log("[SW] Borrando cache viejo:", n);
            return caches.delete(n);
          })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (url.hostname.includes("supabase.co")) return;

  if (
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("googleusercontent.com") ||
    url.hostname.includes("tile.openstreetmap") ||
    url.hostname.includes("gstatic.com") ||
    url.hostname.includes("ggpht.com") ||
    url.hostname.includes("google.com")
  ) return;

  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        fetch(event.request)
          .then((resp) => {
            if (resp && resp.ok) {
              caches.open(CACHE_VERSION).then((cache) => {
                cache.put(event.request, resp.clone()).catch(() => {});
              });
            }
          })
          .catch(() => {});
        return cached;
      }
      return fetch(event.request)
        .then((resp) => {
          if (resp && resp.ok && (resp.type === "basic" || resp.type === "cors")) {
            const clon = resp.clone();
            caches.open(CACHE_VERSION).then((cache) => {
              cache.put(event.request, clon).catch(() => {});
            });
          }
          return resp;
        })
        .catch(() => {
          if (event.request.mode === "navigate") {
            return caches.match("./index.html");
          }
          return new Response("", { status: 503, statusText: "Sin conexion y sin cache" });
        });
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
