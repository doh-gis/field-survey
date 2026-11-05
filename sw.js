/* COT Field Survey service worker
   - ไฟล์ของแอป: ลองโหลดจากเน็ตก่อน (รอไม่เกิน 3.5 วินาที) ถ้าสัญญาณอ่อนใช้ที่เก็บไว้
   - ไลบรารีจาก CDN/ฟอนต์: ใช้ที่เก็บไว้ก่อน เพื่อเปิดเร็วและประหยัดสัญญาณ
   - ไม่แตะ API (Apps Script)
   - v13: เก็บกระเบื้องแผนที่เฉพาะที่ผู้ใช้เลื่อนดูจริง (ไม่โหลดล่วงหน้า ตามนโยบาย OSM) จำกัดจำนวน เก็บ 7 วันก่อนขอใหม่
   - v11: เก็บ Leaflet / heic2any / ฟอนต์ไว้ล่วงหน้า เพื่อเปิดแอปและบันทึกรายการได้ตอนออฟไลน์ */
var V = 'cot-survey-v15';
var SHELL = ['./', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'favicon.png', 'logo.png', 'exifr.full.umd.js', 'piexif.js', 'geometry-editor.js'];
/* ===== กระเบื้องแผนที่ =====
   เก็บเฉพาะกระเบื้องที่ผู้ใช้เลื่อนดูจริง (ไม่มีการโหลดล่วงหน้า) ตามนโยบายของ OSM: ใช้ซ้ำจากเครื่องได้ แต่ห้ามดึงเป็นกลุ่ม
   - เก็บแยกจากแคชแอป (ชื่อไม่เปลี่ยนตามเวอร์ชัน) เพื่อให้อัปเดตแอปแล้วแผนที่ที่เก็บไว้ไม่หาย
   - กระเบื้องที่เก็บไว้ไม่เกิน TILE_FRESH_MS ใช้ได้เลยไม่ต้องขอใหม่ เกินแล้วขอใหม่ ถ้าออฟไลน์ใช้ของเก่า
   - ดึงด้วย CORS แล้วสร้าง Response ใหม่เก็บ (ไม่เก็บ opaque เพราะกินโควตามาก) ถ้า CORS ใช้ไม่ได้ ให้ผ่านตามปกติและไม่เก็บ */
var TILES = 'cot-tiles-v1';
var TILE_MAX = 4000;
var TILE_FRESH_MS = 7 * 864e5;
var TILE_HOSTS = ['tile.openstreetmap.org', 'server.arcgisonline.com', 'tile.opentopomap.org'];
var BLANK = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='), function (c) { return c.charCodeAt(0); });
var puts = 0;
function isTile(u) {
  var h = u.hostname;
  return TILE_HOSTS.some(function (t) { return h === t || h.slice(-t.length - 1) === '.' + t; });
}
// OpenTopoMap มีโดเมนย่อย a/b/c ให้นับเป็นกระเบื้องเดียวกัน
function tkey(u) { return u.replace(/^https:\/\/[abc]\.tile\.opentopomap\.org/, 'https://a.tile.opentopomap.org'); }
function blank() { return new Response(BLANK, { status: 200, headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' } }); }
function trimTiles(c) {
  return c.keys().then(function (ks) {
    if (ks.length <= TILE_MAX) return;
    return c.matchAll().then(function (all) {
      var a = all.map(function (r, i) { return { k: ks[i], t: Number(r.headers.get('x-cached-at')) || 0 }; });
      a.sort(function (x, y) { return x.t - y.t; });
      return Promise.all(a.slice(0, ks.length - TILE_MAX + 200).map(function (x) { return c.delete(x.k); }));
    });
  });
}
function tileFetch(e) {
  var req = e.request, url = req.url, key = tkey(url);
  return caches.open(TILES).then(function (c) {
    return c.match(key).then(function (hit) {
      var age = hit ? Date.now() - (Number(hit.headers.get('x-cached-at')) || 0) : Infinity;
      if (hit && age < TILE_FRESH_MS) return hit;
      return fetch(url, { mode: 'cors', credentials: 'omit' }).then(function (res) {
        if (!res.ok) throw new Error('bad');
        return res.blob().then(function (b) {
          var h = new Headers({ 'Content-Type': res.headers.get('Content-Type') || b.type || 'image/png', 'x-cached-at': String(Date.now()), 'x-size': String(b.size) });
          var keep = new Response(b, { status: 200, headers: h });
          c.put(key, keep.clone()).then(function () { if (++puts % 100 === 0) trimTiles(c); }).catch(function () {});
          return keep;
        });
      }).catch(function () {
        // CORS ใช้ไม่ได้หรือเน็ตหลุด: ลองแบบปกติ (ไม่เก็บ) ถ้าไม่ได้อีก ใช้ของเก่า หรือกระเบื้องว่าง
        return fetch(req).catch(function () { return hit || blank(); });
      });
    });
  }).catch(function () { return fetch(req).catch(function () { return blank(); }); });
}
function tileStats() {
  return caches.open(TILES).then(function (c) {
    return c.matchAll().then(function (all) {
      var bytes = 0; all.forEach(function (r) { bytes += Number(r.headers.get('x-size')) || 0; });
      return { count: all.length, bytes: bytes, max: TILE_MAX };
    });
  });
}
self.addEventListener('message', function (e) {
  var d = e.data || {}, port = e.ports && e.ports[0];
  var reply = function (o) { if (port) port.postMessage(o); };
  if (d.type === 'tileStats') e.waitUntil(tileStats().then(reply).catch(function () { reply({ count: 0, bytes: 0, max: TILE_MAX }); }));
  if (d.type === 'tileClear') e.waitUntil(caches.delete(TILES).then(function () { reply({ ok: true }); }).catch(function () { reply({ ok: false }); }));
});

var CDN = ['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
/* ไลบรารีจาก CDN ที่ต้องมีให้แอปเปิดและบันทึกได้ตอนออฟไลน์ (ต้องตรงกับ URL ใน index.html เป๊ะ) */
var LIBS = [
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/leaflet.markercluster.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/MarkerCluster.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/MarkerCluster.Default.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/heic2any/0.0.4/heic2any.min.js',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;600;700&display=swap'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(V).then(function (c) {
    return Promise.all(SHELL.concat(LIBS).map(function (u) { return c.add(u).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== V && k !== TILES; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function fallback(req) {
  return caches.match(req, { ignoreSearch: true }).then(function (r) {
    return r || (req.mode === 'navigate' ? caches.match('index.html') : null);
  });
}

function networkFirst(req) {
  return new Promise(function (ok) {
    var done = false;
    var t = setTimeout(function () {
      fallback(req).then(function (r) { if (r && !done) { done = true; ok(r); } });
    }, 3500);
    fetch(req).then(function (res) {
      clearTimeout(t);
      if (res && res.ok) {
        var cp = res.clone();
        caches.open(V).then(function (c) { c.put(req, cp); });
      }
      if (!done) { done = true; ok(res); }
    }).catch(function () {
      clearTimeout(t);
      fallback(req).then(function (r) { if (!done) { done = true; ok(r || Response.error()); } });
    });
  });
}

function cacheFirst(req) {
  return caches.match(req).then(function (hit) {
    if (hit) return hit;
    return fetch(req).then(function (res) {
      if (res && (res.ok || res.type === 'opaque')) {
        var cp = res.clone();
        caches.open(V).then(function (c) { c.put(req, cp); });
      }
      return res;
    });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var u = new URL(req.url);
  if (u.origin === location.origin) { e.respondWith(networkFirst(req)); return; }
  if (isTile(u)) { e.respondWith(tileFetch(e)); return; }
  if (CDN.indexOf(u.hostname) > -1) { e.respondWith(cacheFirst(req)); }
});
