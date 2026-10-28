/**
 * SONIC – Taburi pentru paginile de editare (standard unic, RULES §1.6)
 * Model de referință: parteneri-edit.php
 *
 * Markup obligatoriu:
 *   <div class="edit-tabs-wrapper">
 *     <div class="edit-tabs-nav" role="tablist" aria-label="Secțiuni …">
 *       <button type="button" class="edit-tab-btn active" role="tab" aria-selected="true"
 *               aria-controls="tab-general" id="tabBtn-general" onclick="switchTab('general', this)">
 *         <svg … width="15" height="15">…</svg>
 *         Date Generale
 *       </button>
 *       …
 *     </div>
 *   </div>
 *   <div id="tab-general" class="tab-pane active" role="tabpanel" aria-labelledby="tabBtn-general">…</div>
 *   <div id="tab-xyz" class="tab-pane" role="tabpanel" aria-labelledby="tabBtn-xyz" style="display:none;">…</div>
 *
 * Comportament:
 *   - switchTab(tabId, btn) activează tabul, actualizează aria-selected și parametrul ?tab= din URL
 *     (fără reîncărcare; ceilalți parametri – ex. nod, return_to – se păstrează).
 *   - Un buton de tab cu atributul `disabled` nu poate fi activat (ex. tab indisponibil la adăugare).
 *   - La încărcare, dacă URL-ul conține ?tab=xyz și există #tabBtn-xyz, tabul se activează automat.
 *
 * React conversion:
 *   <Tabs activeTab={tab} onChange={setTab} /> – tabul activ ține în state și se sincronizează cu ?tab=.
 */
(function () {
    'use strict';

    function switchTab(tabId, btn) {
        btn = btn || document.getElementById('tabBtn-' + tabId);
        if (btn && btn.hasAttribute('disabled')) return;

        document.querySelectorAll('.edit-tab-btn').forEach(function (b) {
            b.classList.remove('active');
            b.setAttribute('aria-selected', 'false');
        });
        document.querySelectorAll('.tab-pane').forEach(function (p) {
            p.classList.remove('active');
            p.style.display = 'none';
        });

        var pane = document.getElementById('tab-' + tabId);
        if (pane) {
            pane.classList.add('active');
            pane.style.display = 'block';
        }
        if (btn) {
            btn.classList.add('active');
            btn.setAttribute('aria-selected', 'true');
        }

        try {
            var url = new URL(window.location.href);
            url.searchParams.set('tab', tabId);
            window.history.replaceState(null, '', url);
        } catch (e) { /* URL indisponibil (ex. file://) – ignorăm */ }
    }

    window.switchTab = switchTab;

    document.addEventListener('DOMContentLoaded', function () {
        var tabId = new URLSearchParams(window.location.search).get('tab');
        if (!tabId) return;
        var btn = document.getElementById('tabBtn-' + tabId);
        if (btn && !btn.classList.contains('active')) switchTab(tabId, btn);
    });
})();
