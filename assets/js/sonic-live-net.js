/**
 * SONIC – rețea live pe hartă (simulare pentru dashboard-uri).
 *
 * Desenează pe o hartă Leaflet întunecată (monocromă) gateway-urile / locațiile și pachetele de date care pleacă
 * spre serverul SONIC (HQ) sau dinspre el (livrări, notificări). Pachetele, legăturile și undele se desenează pe un
 * canvas peste hartă, recalculat la fiecare cadru (merge la pan / zoom). Fără Leaflet (offline) se folosește o
 * proiecție simplă pe canvas, cu același efect.
 *
 *   var net = SonicLiveNet.create('gridHeroMap', {
 *       hq: { gps: [44.3836, 26.1166], label: 'SONIC HQ' },
 *       nodes: [{ id: 'GW-40211', gps: [44.43, 26.10], label: '…', off: false }],
 *       rate: 6,              // pachete / secundă
 *       outbound: 0.15,       // fracțiunea pachetelor HQ → nod (0 = doar spre HQ)
 *       links: true,          // legături discrete nod – HQ
 *       fit: 'nodes' | 'all', maxZoom: 13, padding: 40,
 *       hero: true,           // încadrează punctele în dreapta (desktop) / sus (mobil), lângă textul din .live-hero
 *       onPacket: function (node, dir) { … }   // la sosire (dir = 'in' | 'out')
 *   });
 *   net.setRate(10); net.burst(nodeId, n); net.map (instanța Leaflet sau null)
 *   SonicLiveNet.ticker(listEl, html, max)   → adaugă un eveniment în lista „live”
 *   SonicLiveNet.counter(el, value, decimals) → afișează un număr în format ro-RO
 *
 * În producție pachetele vin din WebSocket /api/network/live; se apelează net.packet(nodeId, 'in').
 * React: <LiveNetworkMap hq nodes events /> (react-leaflet + canvas overlay în useEffect).
 */
(function (window) {
    'use strict';

    var TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    var TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
    var fmt = new Intl.NumberFormat('ro-RO');

    function create(id, o) {
        var el = typeof id === 'string' ? document.getElementById(id) : id;
        if (!el) return null;
        o = o || {};
        var rate = o.rate || 5, outbound = o.outbound || 0, nodes = (o.nodes || []).slice();
        var hq = o.hq ? o.hq.gps : null;
        var online = nodes.filter(function (n) { return !n.off; });
        var byId = {}; nodes.forEach(function (n) { byId[n.id] = n; });
        var map = null;

        el.classList.add('live-net');
        if (window.L) {
            map = L.map(el, { zoomControl: !!o.zoomControl, attributionControl: true, scrollWheelZoom: !!o.scrollWheelZoom, zoomSnap: 0.25 });
            L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(map);
            var pts = (o.fit === 'all' && hq ? [hq] : []).concat(nodes.map(function (n) { return n.gps; }));
            if (!pts.length && hq) pts = [hq];
            var pad = o.padding || 40, r0 = el.getBoundingClientRect(), mob = r0.width < 700;
            // în hero, punctele se încadrează în zona liberă (dreapta pe desktop, sus pe mobil), nu sub text
            var fitOpt = o.hero
                ? { paddingTopLeft: [mob ? pad : Math.round(r0.width * 0.42), pad], paddingBottomRight: [pad, mob ? Math.round(r0.height * 0.55) : pad], maxZoom: o.maxZoom || 13 }
                : { padding: [pad, pad], maxZoom: o.maxZoom || 13 };
            if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), fitOpt);
            else map.setView(pts[0] || [44.43, 26.10], o.maxZoom || 13);
            nodes.forEach(function (n) {
                var m = L.circleMarker(n.gps, { radius: n.off ? 4 : 3, weight: n.off ? 2 : 1, color: n.off ? '#f87171' : '#ffffff', fillColor: n.off ? '#7f1d1d' : '#ffffff', fillOpacity: n.off ? 0.9 : 0.85, opacity: n.off ? 1 : 0.7 }).addTo(map);
                if (n.label) m.bindTooltip(n.label + (n.off ? ' · nu transmite' : ''), { direction: 'top', className: 'live-net-tip' });
            });
            if (hq) {
                L.marker(hq, { icon: L.divIcon({ className: '', html: '<div class="live-hq"><span></span><span></span><b></b></div>', iconSize: [18, 18], iconAnchor: [9, 9] }), zIndexOffset: 1000 })
                    .addTo(map).bindTooltip((o.hq.label || 'SONIC HQ') + (o.hq.address ? ' · ' + o.hq.address : ''), { direction: 'top', className: 'live-net-tip' });
            }
        } else {
            el.classList.add('live-net--offline');
        }

        // canvas peste hartă
        var canvas = document.createElement('canvas');
        canvas.className = 'live-net-canvas';
        el.appendChild(canvas);
        var ctx = canvas.getContext('2d'), dpr = Math.min(window.devicePixelRatio || 1, 2), W = 0, H = 0;

        // proiecție fără hartă: încadrează toate punctele
        var bounds = null;
        if (!map) {
            var all = nodes.map(function (n) { return n.gps; }).concat(hq ? [hq] : []);
            bounds = all.reduce(function (b, p) { return [Math.min(b[0], p[0]), Math.max(b[1], p[0]), Math.min(b[2], p[1]), Math.max(b[3], p[1])]; }, [90, -90, 180, -180]);
        }
        function project(ll) {
            if (map) { var p = map.latLngToContainerPoint(ll); return [p.x, p.y]; }
            var pad = 40, sx = (W - pad * 2) / Math.max(0.0001, bounds[3] - bounds[2]), sy = (H - pad * 2) / Math.max(0.0001, bounds[1] - bounds[0]), s = Math.min(sx, sy);
            return [pad + (ll[1] - bounds[2]) * s + (W - pad * 2 - (bounds[3] - bounds[2]) * s) / 2, pad + (bounds[1] - ll[0]) * s + (H - pad * 2 - (bounds[1] - bounds[0]) * s) / 2];
        }
        function resize() {
            var r = el.getBoundingClientRect();
            if (r.width === W && r.height === H) return;
            W = r.width; H = r.height;
            canvas.width = W * dpr; canvas.height = H * dpr;
            canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            if (map) map.invalidateSize();
        }

        var packets = [], rings = [], acc = 0, last = performance.now(), running = true;
        function ctrl(a, b) { // punct de control pentru curbă
            var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1];
            return [mx - dy * 0.18, my + dx * 0.18];
        }
        function bez(a, c, b, t) { var u = 1 - t; return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]; }

        function spawn(node, dir) {
            if (!node || !hq || packets.length > 140) return;
            packets.push({ node: node, dir: dir, t: 0, dur: 1100 + Math.random() * 900 });
            if (dir === 'in') rings.push({ ll: node.gps, t: 0, max: 14 });
        }

        function frame(now) {
            if (!running) return;
            var dt = Math.min(64, now - last); last = now;
            resize();
            ctx.clearRect(0, 0, W, H);
            if (!map) { // fundal + puncte în modul fără hartă
                nodes.forEach(function (n) { var p = project(n.gps); ctx.beginPath(); ctx.arc(p[0], p[1], n.off ? 3.5 : 2.5, 0, 6.283); ctx.fillStyle = n.off ? '#f87171' : 'rgba(255,255,255,.8)'; ctx.fill(); });
                if (hq) { var h0 = project(hq); ctx.beginPath(); ctx.arc(h0[0], h0[1], 6, 0, 6.283); ctx.fillStyle = '#fff'; ctx.fill(); }
            }
            var H0 = hq ? project(hq) : null;
            // legături discrete
            if (o.links !== false && H0 && online.length <= 160) {
                ctx.lineWidth = 0.6; ctx.strokeStyle = 'rgba(255,255,255,0.07)';
                online.forEach(function (n) { var p = project(n.gps), c = ctrl(p, H0); ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.quadraticCurveTo(c[0], c[1], H0[0], H0[1]); ctx.stroke(); });
            }
            // pachete noi
            if (document.visibilityState !== 'hidden' && online.length) {
                acc += rate * dt / 1000;
                while (acc >= 1) { acc -= 1; spawn(online[Math.floor(Math.random() * online.length)], Math.random() < outbound ? 'out' : 'in'); }
            }
            // pachete în zbor
            for (var i = packets.length - 1; i >= 0; i--) {
                var k = packets[i]; k.t += dt / k.dur;
                var a = project(k.node.gps);
                var s = k.dir === 'in' ? a : H0, e = k.dir === 'in' ? H0 : a, c = ctrl(s, e);
                if (k.t >= 1) {
                    packets.splice(i, 1);
                    rings.push({ ll: k.dir === 'in' ? hq : k.node.gps, t: 0, max: k.dir === 'in' ? 22 : 12 });
                    if (o.onPacket) o.onPacket(k.node, k.dir);
                    continue;
                }
                var ease = k.t < 0.5 ? 2 * k.t * k.t : 1 - Math.pow(-2 * k.t + 2, 2) / 2;
                for (var j = 6; j >= 0; j--) { // urmă
                    var tt = Math.max(0, ease - j * 0.018), p = bez(s, c, e, tt);
                    ctx.beginPath(); ctx.arc(p[0], p[1], j === 0 ? 2.4 : 1.8 - j * 0.2, 0, 6.283);
                    ctx.fillStyle = k.dir === 'in' ? 'rgba(255,255,255,' + (j === 0 ? 0.95 : 0.35 - j * 0.045) + ')' : 'rgba(167,243,208,' + (j === 0 ? 0.95 : 0.35 - j * 0.045) + ')';
                    ctx.fill();
                }
                var head = bez(s, c, e, ease);
                var g = ctx.createRadialGradient(head[0], head[1], 0, head[0], head[1], 9);
                g.addColorStop(0, k.dir === 'in' ? 'rgba(255,255,255,0.45)' : 'rgba(167,243,208,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = g; ctx.beginPath(); ctx.arc(head[0], head[1], 9, 0, 6.283); ctx.fill();
            }
            // unde (transmisie / recepție)
            for (var r = rings.length - 1; r >= 0; r--) {
                var q = rings[r]; q.t += dt / 900;
                if (q.t >= 1) { rings.splice(r, 1); continue; }
                var pp = project(q.ll);
                ctx.beginPath(); ctx.arc(pp[0], pp[1], 3 + q.max * q.t, 0, 6.283);
                ctx.strokeStyle = 'rgba(255,255,255,' + (0.55 * (1 - q.t)) + ')'; ctx.lineWidth = 1.2; ctx.stroke();
            }
            requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);

        return {
            map: map,
            setRate: function (r) { rate = r; },
            packet: function (nodeId, dir) { spawn(byId[nodeId], dir || 'in'); },
            burst: function (nodeId, n) { for (var i = 0; i < (n || 5); i++) setTimeout(function () { spawn(byId[nodeId], 'in'); }, i * 120); },
            stop: function () { running = false; }
        };
    }

    window.SonicLiveNet = {
        create: create,
        ticker: function (list, html, max) {
            if (!list) return;
            var li = document.createElement('li');
            li.className = 'live-ticker-item';
            li.innerHTML = html;
            list.insertBefore(li, list.firstChild);
            while (list.children.length > (max || 5)) list.removeChild(list.lastChild);
        },
        counter: function (el, v, dec) {
            if (el) el.textContent = dec ? v.toLocaleString('ro-RO', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : fmt.format(Math.round(v));
        },
        clock: function (el) {
            if (!el) return;
            function t() { var d = new Date(); el.textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0'); }
            t(); setInterval(t, 1000);
        }
    };
})(window);
