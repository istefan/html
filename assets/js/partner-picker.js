/**
 * PartnerPicker – fereastra comună de alegere a unui Partener (markup: partials/partner-picker.php).
 *   PartnerPicker.init({ modalId, inputId, btnOpenId, callback }, data)  – callback(code, item): funcție sau nume de funcție globală
 *   PartnerPicker.open(modalId)                                          – deschide fereastra din cod (ex. click pe câmp)
 * Aceeași logică și aceleași clase ca NodPicker (assets/js/nod-picker.js). React: <PartnerPickerModal onSelect />.
 */
var PartnerPicker = (function () {
    'use strict';
    var instances = {};
    var ICON_OK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

    function init(cfg, data) {
        var modal = document.getElementById(cfg.modalId);
        if (!modal) return;
        var $ = function (suffix) { return document.getElementById(cfg.modalId + '-' + suffix); };
        var input = document.getElementById(cfg.inputId), btn = document.getElementById(cfg.btnOpenId);

        function select(item) {
            if (input) input.value = item.name;
            var cb = typeof cfg.callback === 'function' ? cfg.callback : window[cfg.callback];
            if (typeof cb === 'function') cb(item.code, item);
            close();
        }
        function render(rows) {
            var tb = $('tbody');
            tb.innerHTML = rows.length ? rows.map(function (p, i) {
                return '<tr><td class="nod-picker-td-code">' + esc(p.code) + '</td><td>' + esc(p.name) + '<br><span class="list-sublabel">' + esc(p.address) + '</span></td><td>' + esc(p.cui) + '</td>'
                    + '<td>' + p.nods.length + (p.nods.length ? '<span class="list-sublabel">' + esc(p.nods.join(', ')) + '</span>' : '') + '</td>'
                    + '<td class="nod-picker-td-sel"><button type="button" class="btn-action-icon nod-picker-select-btn" title="Selectează acest partener" data-i="' + i + '">' + ICON_OK + '</button></td></tr>';
            }).join('') : '<tr><td colspan="5" class="nod-picker-empty">Niciun partener găsit.</td></tr>';
            tb.querySelectorAll('[data-i]').forEach(function (b) { b.addEventListener('click', function () { select(rows[+b.getAttribute('data-i')]); }); });
            $('count').textContent = rows.length;
        }
        function filter() {
            var name = norm($('name').value), code = norm($('code').value), cui = norm($('cui').value), contact = norm($('contact').value);
            render(data.filter(function (p) {
                return (!name || norm(p.name + ' ' + p.address).indexOf(name) !== -1) && (!code || norm(p.code + ' ' + p.nods.join(' ')).indexOf(code) !== -1)
                    && (!cui || norm(p.cui).indexOf(cui) !== -1) && (!contact || norm(p.contact).indexOf(contact) !== -1);
            }));
        }
        function open() { modal.style.display = 'flex'; filter(); setTimeout(function () { $('name').focus(); }, 80); }
        function close() { modal.style.display = 'none'; }

        if (btn) btn.addEventListener('click', open);
        $('form').addEventListener('submit', function (e) { e.preventDefault(); filter(); });
        ['name', 'code', 'cui', 'contact'].forEach(function (k) { $(k).addEventListener('input', filter); });
        modal.querySelector('[data-pp-reset]').addEventListener('click', function () { ['name', 'code', 'cui', 'contact'].forEach(function (k) { $(k).value = ''; }); filter(); });
        modal.querySelector('[data-pp-close]').addEventListener('click', close);
        modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal.style.display === 'flex') close(); });
        instances[cfg.modalId] = { open: open, close: close };
    }

    return { init: init, open: function (id) { if (instances[id]) instances[id].open(); } };
})();
