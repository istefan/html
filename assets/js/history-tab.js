/**
 * SonicHistory – logica componentei comune „Istoric” (partials/history-tab.php): filtrare, căutare, detalii, fereastră pop-up.
 * Datele fiecărei instanțe: window.SONIC_HISTORY[prefix] (scrise de componentă). Încărcat de partials/header.php.
 *   SonicHistory.filter(prefix) / reset(prefix) / detail(prefix, index) / closeDetail(prefix) / open(prefix) / close(prefix)
 * React: <HistoryPanel /> cu state pentru filtre; <HistoryEventModal />.
 */
(function () {
    'use strict';

    var KINDS = { teren: 1 };
    function $(id) { return document.getElementById(id); }
    function esc(t) { var d = document.createElement('div'); d.textContent = t == null ? '' : String(t); return d.innerHTML; }
    function iso(el) { return el && window.SonicDatepicker ? (SonicDatepicker.getISO(el) || '') : ''; }
    function fmtDate(s) { var p = (s || '').split(' ')[0].split('-'); return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] + (s.length > 10 ? ' ' + s.substr(11, 5) : '') : ''; }

    function filter(prefix) {
        var root = $(prefix + 'Root');
        if (!root) return;
        var crit = {};
        root.querySelectorAll('[data-filter]').forEach(function (el) { crit[el.getAttribute('data-filter')] = el.value; });
        var from = iso($(prefix + 'From')), to = iso($(prefix + 'To'));
        var q = ($(prefix + 'Search').value || '').toLowerCase().trim();
        var n = 0;
        root.querySelectorAll('#' + prefix + 'Body tr[data-kind]').forEach(function (tr) {
            var d = tr.dataset, show = true;
            if (crit.equipment && (' ' + d.equipment + ' ').indexOf(' ' + crit.equipment + ' ') === -1) show = false;
            if (crit.kind && d.kind !== crit.kind) show = false;
            if (crit.subject && d.subject !== crit.subject) show = false;
            if (crit.open !== undefined && crit.open !== '' && d.open !== crit.open) show = false;
            if (crit.by && d.by !== crit.by) show = false;
            if (crit.level && d.level !== crit.level) show = false;
            if (crit.nod && d.nod !== crit.nod) show = false;
            if (crit.flat && (' ' + d.flat + ' ').indexOf(' ' + crit.flat + ' ') === -1) show = false;
            if (from && d.date < from) show = false;
            if (to && d.date > to) show = false;
            if (q && d.search.indexOf(q) === -1) show = false;
            tr.style.display = show ? '' : 'none';
            if (show) n++;
        });
        $(prefix + 'Count').textContent = n;
        var empty = root.querySelector('.js-history-empty');
        if (empty) empty.style.display = n ? 'none' : '';
    }

    function reset(prefix) {
        var root = $(prefix + 'Root');
        root.querySelectorAll('[data-filter]').forEach(function (el) { el.value = ''; });
        [$(prefix + 'From'), $(prefix + 'To')].forEach(function (el) { if (el && window.SonicDatepicker) SonicDatepicker.setValue(el, ''); });
        $(prefix + 'Search').value = '';
        filter(prefix);
    }

    function detail(prefix, i) {
        var r = (window.SONIC_HISTORY[prefix] || [])[i];
        if (!r) return;
        var html = '<div class="utility-context-strip"><div class="context-items">' +
            '<div class="context-item"><span class="context-label">Tip:</span><span class="context-value">' + esc(r.kind) + '</span></div><div class="context-sep"></div>' +
            '<div class="context-item"><span class="context-label">Data:</span><span class="context-value">' + fmtDate(r.date) + '</span></div>' +
            (r.ticket ? '<div class="context-sep"></div><div class="context-item"><span class="context-label">Ticket:</span><strong class="context-value context-code">' + esc(r.ticket) + '</strong></div>' : '') +
            '</div><div><span class="status-badge ' + (r.status === 'Rezolvat' ? 'status-offline' : 'status-warning') + '">' + esc(r.status) + '</span></div></div>' +
            '<div class="form-group"><span class="form-label">' + esc(r.title) + '</span><div class="form-static-value">' + esc(r.by || 'Neatribuit') + ' · ' + esc(r.role) + (r.source ? ' · ' + esc(r.source) : '') + '</div></div>';
        if (r.contact && r.contact !== ' · ') html += '<div class="form-group"><span class="form-label">Persoană de contact</span><div class="form-static-value">' + esc(r.contact) + '</div></div>';
        if (r.request) html += '<div class="form-group"><span class="form-label">Solicitarea</span><div class="calc-note">' + esc(r.request) + '</div></div>';
        if (r.ops && r.ops.length) {
            html += '<div class="form-group"><span class="form-label">Operațiuni efectuate</span><ul class="pro-feed">' + r.ops.map(function (o) {
                return '<li class="pro-feed-item"><div class="pro-feed-body"><div class="pro-feed-text">' + esc(o).replace(/\b(\d{8,9}|SG-\d+|GW-\d+)\b/g, '<span class="serial-value">$1</span>') + '</div></div></li>';
            }).join('') + '</ul></div>';
        } else if (r.resolution === 'teren' && r.summary) {
            html += '<div class="form-group"><span class="form-label">Observații pentru instalator</span><div class="form-static-value">' + esc(r.summary) + '</div></div>';
        }
        if (r.text) html += '<div class="form-group"><span class="form-label">Răspunsul trimis</span><div class="calc-note">' + esc(r.text) + '</div></div>';
        if (r.flats && r.flats.length > 1) html += '<div class="form-group"><span class="form-label">Apartamente</span><div class="form-static-value">' + r.flats.map(function (f) { return 'Ap. ' + esc(f.split('/')[1]); }).join(', ') + '</div></div>';
        if (r.note) html += '<div class="form-group" style="margin-bottom: 0;"><span class="form-label">Observații</span><div class="form-static-value">' + esc(r.note) + '</div></div>';
        $(prefix + 'DetailTitle').textContent = r.kind + (r.ticket ? ' · ' + r.ticket : '');
        $(prefix + 'DetailBody').innerHTML = html;
        var link = $(prefix + 'DetailOpen');
        link.style.display = r.ticket ? '' : 'none';
        link.href = 'pro-ticket.php?id=' + encodeURIComponent(r.ticket);
        $(prefix + 'Detail').style.display = 'flex';
    }

    function closeDetail(prefix) { $(prefix + 'Detail').style.display = 'none'; }
    function open(prefix) { var m = $(prefix + 'Modal'); if (m) m.style.display = 'flex'; }
    function close(prefix) { var m = $(prefix + 'Modal'); if (m) m.style.display = 'none'; }

    document.addEventListener('DOMContentLoaded', function () {
        Object.keys(window.SONIC_HISTORY || {}).forEach(function (prefix) {
            var root = $(prefix + 'Root');
            if (!root) return;
            root.querySelectorAll('[data-filter]').forEach(function (el) { el.addEventListener('change', function () { filter(prefix); }); });
            // Filtrul NOD (partener cu mai multe NOD-uri) restrânge lista de apartamente la NOD-ul ales
            var nodSel = $(prefix + 'Nod'), flatSel = $(prefix + 'Flat');
            if (nodSel && flatSel) nodSel.addEventListener('change', function () {
                Array.prototype.forEach.call(flatSel.options, function (o) { o.hidden = !!(nodSel.value && o.value && o.getAttribute('data-nod') !== nodSel.value); });
                if (flatSel.selectedOptions[0] && flatSel.selectedOptions[0].hidden) { flatSel.value = ''; filter(prefix); }
            });
            [$(prefix + 'From'), $(prefix + 'To')].forEach(function (el) { if (el) el.addEventListener('change', function () { filter(prefix); }); });
            $(prefix + 'Search').addEventListener('input', function () { filter(prefix); });
        });
        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            document.querySelectorAll('.modal-overlay[id$="Detail"], .modal-overlay[id$="Modal"]').forEach(function (m) {
                if (m.id && window.SONIC_HISTORY && window.SONIC_HISTORY[m.id.replace(/(Detail|Modal)$/, '')] !== undefined) m.style.display = 'none';
            });
        });
    });

    window.SonicHistory = { filter: filter, reset: reset, detail: detail, closeDetail: closeDetail, open: open, close: close };
})();
