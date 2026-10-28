/**
 * SONIC PRO – hărți Leaflet (dispecerat, programare, hartă live).
 *
 * Leaflet se încarcă doar pe paginile cu hartă, din header (`$page_styles` / `$page_scripts`).
 * Fundal: OpenStreetMap, afișat în tonuri de gri (filtru CSS pe `.leaflet-tile-pane`, stil monocrom). Dacă Leaflet nu e disponibil (offline), containerul afișează un mesaj.
 *
 *   var map = SonicProMap.create('dashMap', { center: [44.44, 26.1], zoom: 12 });
 *   SonicProMap.staff(map, [lat, lng], 'TM', 'Teodor Milian', 'În teren')     → marker persoană (inițiale)
 *   SonicProMap.job(map, [lat, lng], 'progress' | 'done' | 'failed' | '', html) → punct intervenție
 *   SonicProMap.alert(map, [lat, lng], html)                                  → problemă în rețea
 *   SonicProMap.target(map, [lat, lng], html)                                 → adresa căutată
 *   SonicProMap.route(map, [[lat, lng], …], dashed)                           → traseu
 *   SonicProMap.fit(map, [[lat, lng], …])
 *
 * React: <ProMap center zoom layers={[…]} /> cu react-leaflet; aceleași clase CSS pentru `divIcon`.
 */
(function (window) {
    'use strict';

    var TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    var TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

    function available() { return typeof window.L !== 'undefined'; }

    function create(id, opts) {
        var el = typeof id === 'string' ? document.getElementById(id) : id;
        if (!el) return null;
        opts = opts || {};
        if (!available()) {
            el.innerHTML = '<div class="pro-map-fallback">Harta nu poate fi încărcată (fără conexiune la internet). Datele rămân disponibile în listele de mai jos.</div>';
            return null;
        }
        var map = L.map(el, { zoomControl: true, scrollWheelZoom: opts.scrollWheelZoom !== false, attributionControl: true })
            .setView(opts.center || [44.4400, 26.1050], opts.zoom || 12);
        L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(map);
        // containerele ascunse (taburi, modale) trebuie recalculate când devin vizibile
        setTimeout(function () { map.invalidateSize(); }, 150);
        return map;
    }

    function icon(cls, html, size) {
        return L.divIcon({ className: '', html: '<div class="' + cls + '">' + (html || '') + '</div>', iconSize: size, iconAnchor: [size[0] / 2, size[1] / 2], popupAnchor: [0, -size[1] / 2] });
    }

    function popupHtml(title, meta, actions) {
        var h = '<div class="pro-map-popup-title">' + title + '</div>';
        if (meta) h += '<div class="pro-map-popup-meta">' + meta + '</div>';
        if (actions) h += '<div class="pro-map-popup-actions">' + actions + '</div>';
        return h;
    }

    function add(map, latlng, ic, popup, layer) {
        if (!map || !latlng) return null;
        var m = L.marker(latlng, { icon: ic }).addTo(layer || map);
        if (popup) m.bindPopup(popup);
        return m;
    }

    var api = {
        available: available,
        create: create,
        popup: popupHtml,
        staff: function (map, latlng, initials, popup, off, layer) {
            return add(map, latlng, icon('pro-pin' + (off ? ' pro-pin--staff-off' : ''), initials, [30, 30]), popup, layer);
        },
        job: function (map, latlng, state, popup, layer) {
            return add(map, latlng, icon('pro-pin--job' + (state ? ' is-' + state : ''), '', [14, 14]), popup, layer);
        },
        alert: function (map, latlng, popup, layer) {
            return add(map, latlng, icon('pro-pin--alert', '', [16, 16]), popup, layer);
        },
        nod: function (map, latlng, popup, layer) {
            return add(map, latlng, icon('pro-pin--nod', '', [10, 10]), popup, layer);
        },
        target: function (map, latlng, popup, layer) {
            if (!map || !latlng) return null;
            var ic = L.divIcon({ className: '', html: '<div class="pro-pin--target"></div>', iconSize: [22, 22], iconAnchor: [11, 26], popupAnchor: [0, -24] });
            var m = L.marker(latlng, { icon: ic, zIndexOffset: 1000 }).addTo(layer || map);
            if (popup) m.bindPopup(popup);
            return m;
        },
        route: function (map, pts, dashed, layer) {
            if (!map || !pts || pts.length < 2) return null;
            return L.polyline(pts, { color: '#2d3748', weight: 3, opacity: 0.75, dashArray: dashed ? '6 6' : null }).addTo(layer || map);
        },
        layer: function (map) { return available() && map ? L.layerGroup().addTo(map) : null; },
        fit: function (map, pts, maxZoom) {
            if (!map || !pts || !pts.length) return;
            if (pts.length === 1) { map.setView(pts[0], maxZoom || 15); return; }
            map.fitBounds(L.latLngBounds(pts), { padding: [30, 30], maxZoom: maxZoom || 15 });
        },
        refresh: function (map) { if (map) setTimeout(function () { map.invalidateSize(); }, 60); }
    };

    window.SonicProMap = api;
})(window);
