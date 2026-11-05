/* COT Field Survey service worker
   - ไฟล์ของแอป: ลองโหลดจากเน็ตก่อน (รอไม่เกิน 3.5 วินาที) ถ้าสัญญาณอ่อนใช้ที่เก็บไว้
   - ไลบรารีจาก CDN/ฟอนต์: ใช้ที่เก็บไว้ก่อน เพื่อเปิดเร็วและประหยัดสัญญาณ
   - ไม่แตะ API (Apps Script) และไม่เก็บไทล์แผนที่ */
var V = 'cot-survey-v10';
var SHELL = ['./', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'favicon.png', 'logo.png', 'exifr.full.umd.js', 'piexif.js'];
var CDN = ['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(V).then(function (c) {
    return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== V; }).map(function (k) { return caches.delete(k); }));
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
  if (CDN.indexOf(u.hostname) > -1) { e.respondWith(cacheFirst(req)); }
});
