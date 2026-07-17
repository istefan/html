/**
 * NodPicker – Modul JS reutilizabil pentru pop-up-ul de selecție NOD
 *
 * Utilizare în PHP (via partial):
 *   require_once 'partials/nod-picker.php';
 *   (parțialul apelează NodPicker.init() automat)
 *
 * Utilizare directă în JS (dacă e nevoie):
 *   NodPicker.init(config, data);
 *
 * config = {
 *   modalId:   'nodPickerModal',   // ID modal overlay
 *   inputId:   'txtNOD',           // ID input ce va fi populat
 *   btnOpenId: 'btnOpenNodModal',  // ID buton deschidere
 *   callback:  null | function(code) {}  // opțional – apelat după selecție
 * }
 *
 * data = array de obiecte:
 *   { id, code, address, association, city, street, ownerType }
 *
 * React echivalent: <NodPickerModal onSelect={handleSelect} data={nodsData} />
 */

var NodPicker = (function() {
    'use strict';

    /**
     * init – Inițializează o instanță a picker-ului NOD.
     * Poate fi apelat de mai multe ori pe aceeași pagină cu ID-uri diferite.
     */
    function init(cfg, data) {
        var modalId   = cfg.modalId   || 'nodPickerModal';
        var inputId   = cfg.inputId   || 'txtNOD';
        var btnOpenId = cfg.btnOpenId || 'btnOpenNodModal';
        var callbackName = cfg.callback || null;
        /* callback poate fi funcție directă sau string cu numele funcției globale */
        var onSelect = null;
        if (typeof callbackName === 'function') {
            onSelect = callbackName;
        } else if (typeof callbackName === 'string' && callbackName) {
            /* Lazy resolution – funcția poate fi definita dupa init() */
            onSelect = function(code) {
                if (typeof window[callbackName] === 'function') {
                    window[callbackName](code);
                }
            };
        }

        var modalEl   = document.getElementById(modalId);
        var inputEl   = document.getElementById(inputId);
        var btnOpenEl = document.getElementById(btnOpenId);
        var tbodyEl   = document.getElementById(modalId + '-tbody');
        var countEl   = document.getElementById(modalId + '-count');

        if (!modalEl) return; // modal-ul nu există în pagina curentă

        /* ── Deschidere / Închidere ────────────────────────────────── */
        function openModal() {
            modalEl.style.display = 'flex';
            render(data);
            // focus pe primul câmp de filtrare
            var firstInput = modalEl.querySelector('.input-control');
            if (firstInput) setTimeout(function() { firstInput.focus(); }, 80);
        }

        function closeModal() {
            modalEl.style.display = 'none';
        }

        if (btnOpenEl) {
            btnOpenEl.addEventListener('click', openModal);
        }

        // Buton X (close) din header modal
        var closeBtns = modalEl.querySelectorAll('.nod-picker-close');
        closeBtns.forEach(function(btn) {
            btn.addEventListener('click', closeModal);
        });

        // Clic pe overlay (în afara card-ului)
        modalEl.addEventListener('click', function(e) {
            if (e.target === modalEl) closeModal();
        });

        // Taste Escape
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && modalEl.style.display === 'flex') closeModal();
        });

        /* ── Render tabel NOD-uri ──────────────────────────────────── */
        function render(rows) {
            if (!tbodyEl) return;
            tbodyEl.innerHTML = '';

            if (!rows || rows.length === 0) {
                tbodyEl.innerHTML = '<tr><td colspan="4" class="nod-picker-empty">Niciun NOD găsit.</td></tr>';
                if (countEl) countEl.textContent = '0';
                return;
            }

            rows.forEach(function(nod) {
                var tr = document.createElement('tr');

                var tdCode = document.createElement('td');
                tdCode.className = 'nod-picker-td-code';
                tdCode.textContent = nod.code;

                var tdAddr = document.createElement('td');
                tdAddr.textContent = nod.address;

                var tdAssoc = document.createElement('td');
                tdAssoc.textContent = nod.association || '—';

                var tdSel = document.createElement('td');
                tdSel.className = 'nod-picker-td-sel';

                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'btn-action-icon nod-picker-select-btn';
                btn.title = 'Selectează acest NOD';
                btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polyline points="20 6 9 17 4 12"></polyline></svg>';

                (function(nodCode) {
                    btn.addEventListener('click', function() {
                        if (inputEl) inputEl.value = nodCode;
                        if (onSelect) onSelect(nodCode);
                        closeModal();
                    });
                })(nod.code);

                tdSel.appendChild(btn);
                tr.appendChild(tdCode);
                tr.appendChild(tdAddr);
                tr.appendChild(tdAssoc);
                tr.appendChild(tdSel);
                tbodyEl.appendChild(tr);
            });

            if (countEl) countEl.textContent = rows.length;
        }

        /* ── Filtrare ──────────────────────────────────────────────── */
        var searchBtn = modalEl.querySelector('.nod-picker-search');
        var resetBtn  = modalEl.querySelector('.nod-picker-reset');
        var form      = document.getElementById(modalId + '-form');

        function doFilter() {
            var cityEl   = document.getElementById(modalId + '-city');
            var streetEl = document.getElementById(modalId + '-street');
            var typeEl   = document.getElementById(modalId + '-type');
            var assocEl  = document.getElementById(modalId + '-assoc');
            var codeEl   = document.getElementById(modalId + '-code');

            var cityVal   = cityEl   ? cityEl.value.toLowerCase()             : '-1';
            var streetVal = streetEl ? streetEl.value.toLowerCase().trim()    : '';
            var typeVal   = typeEl   ? typeEl.value                           : '-1';
            var assocVal  = assocEl  ? assocEl.value.toLowerCase().trim()     : '';
            var codeVal   = codeEl   ? codeEl.value.toLowerCase().trim()      : '';

            var filtered = data.filter(function(nod) {
                if (cityVal  !== '-1' && (nod.city   || '').toLowerCase() !== cityVal)                           return false;
                if (streetVal !== ''  && (nod.street || '').toLowerCase().indexOf(streetVal) === -1)             return false;
                if (typeVal  !== '-1' && nod.ownerType !== typeVal)                                              return false;
                if (assocVal !== ''   && (nod.association || '').toLowerCase().indexOf(assocVal) === -1)         return false;
                if (codeVal  !== ''   && (nod.code   || '').toLowerCase().indexOf(codeVal) === -1)              return false;
                return true;
            });

            render(filtered);
        }

        if (searchBtn) searchBtn.addEventListener('click', doFilter);

        if (resetBtn) {
            resetBtn.addEventListener('click', function() {
                if (form) form.reset();
                render(data);
            });
        }
    }

    /* API public */
    return { init: init };
})();
