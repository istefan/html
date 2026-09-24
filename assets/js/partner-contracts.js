/**
 * Partner Contract Management – assets/js/partner-contracts.js
 *
 * Gestionează CRUD contracte din pagina parteneri-edit.php (Tab 3 – Contracte).
 * Include: deschidere/închidere modal creare contract, checklist NOD-uri,
 * picker servicii, adăugare/editare rând contract.
 *
 * React conversion:
 *   Modulul devine hook-uri + state în <PartnerContractsTab />:
 *   - usePartnerContracts() → state contracte, CRUD handlers
 *   - useServicePicker() → state picker servicii, handler selecție
 */
var PartnerContracts = (function () {
    'use strict';

    /** @type {Array<{id: number, contractNo: string, date: string, duration: string, installDate: string, comments: string, nods: string[], services: Array<{code: string, name: string, utility: string}>}>} */
    var _contracts = [];
    var _nextId = 1;
    var _editingId = null;

    /** @type {Array<{code: string, name: string, utility: string}>} */
    var _currentServices = [];

    // ── Helper: escape HTML ──────────────────────────────────────────────────
    function _escHtml(str) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str || ''));
        return div.innerHTML;
    }

    // ── Render tabel contracte ───────────────────────────────────────────────
    function _renderContractTable() {
        var tbody = document.getElementById('partnerContractsBody');
        if (!tbody) return;

        var emptyRow = document.getElementById('partnerContractsEmpty');

        if (_contracts.length === 0) {
            tbody.innerHTML = '';
            if (emptyRow) {
                emptyRow.style.display = '';
                tbody.appendChild(emptyRow);
            }
            _updateContractCount();
            return;
        }

        if (emptyRow) emptyRow.style.display = 'none';

        var partnerCode = (document.getElementById('txtPartnerCode') || {}).value || '';
        var html = '';
        _contracts.forEach(function (ctr) {
            var nodsStr = ctr.nods && ctr.nods.length ? ctr.nods.join(', ') : '–';
            var srvCount = ctr.services ? ctr.services.length : 0;
            var editCtrUrl = 'contracte-edit.php?id=' + encodeURIComponent(ctr.contractNo || ctr.id || 'CTR-2026-001') + '&partner_code=' + encodeURIComponent(partnerCode) + '&return_to=' + encodeURIComponent('parteneri-edit.php?code=' + encodeURIComponent(partnerCode) + '&tab=contract');

            html += '<tr data-contract-id="' + ctr.id + '">';
            html += '<td style="font-weight:600;">' + _escHtml(ctr.contractNo) + '</td>';
            html += '<td>' + _escHtml(ctr.date) + '</td>';
            html += '<td style="text-align:center;">' + _escHtml(ctr.duration) + '</td>';
            html += '<td>' + _escHtml(ctr.installDate || '–') + '</td>';
            html += '<td style="font-size:12px; font-family:monospace;">' + _escHtml(nodsStr) + '</td>';
            html += '<td style="text-align:center; font-weight:600;">' + srvCount + '</td>';
            html += '<td style="text-align:center;">';
            // Editare -> navigare la contracte-edit.php
            html += '<a href="' + editCtrUrl + '" class="btn-action-icon" title="Editează contract">';
            html += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';
            html += '</a>';
            // Notă: Butonul Șterge Contract a fost eliminat
            html += '</td>';
            html += '</tr>';
        });

        tbody.innerHTML = html;
        _updateContractCount();
    }

    function _updateContractCount() {
        var el = document.getElementById('partnerContractsCount');
        if (el) el.textContent = _contracts.length;
    }

    // ── Refresh NOD checklist în modal contract ──────────────────────────────
    function refreshNodChecklist() {
        var container = document.getElementById('cfmNodsChecklist');
        if (!container) return;

        var nods = (window.PartnerNods && PartnerNods.getNods) ? PartnerNods.getNods() : [];

        if (nods.length === 0) {
            container.innerHTML = '<div class="checklist-nods-empty">Adăugați mai întâi NOD-uri la tab-ul NOD-uri.</div>';
            return;
        }

        var html = '';
        nods.forEach(function (nod) {
            var addr = [nod.street, nod.no ? 'Nr. ' + nod.no : '', nod.block ? 'Bl. ' + nod.block : '', nod.entrance ? 'Sc. ' + nod.entrance : ''].filter(Boolean).join(', ');
            var checked = _editingId !== null ? _isNodInContract(_editingId, nod.code) : false;

            html += '<label class="checklist-nod-item">';
            html += '<input type="checkbox" name="cfm_nods[]" value="' + _escHtml(nod.code) + '"' + (checked ? ' checked' : '') + '>';
            html += '<span class="nod-code">' + _escHtml(nod.code) + '</span>';
            html += '<span class="nod-addr">' + _escHtml(addr) + '</span>';
            html += '</label>';
        });

        container.innerHTML = html;
    }

    function _isNodInContract(contractId, nodCode) {
        var ctr = _contracts.find(function (c) { return c.id === contractId; });
        return ctr && ctr.nods && ctr.nods.indexOf(nodCode) !== -1;
    }

    // ── Render services mini table ───────────────────────────────────────────
    function _renderServicesTable() {
        var tbody = document.getElementById('cfmServicesBody');
        if (!tbody) return;

        if (_currentServices.length === 0) {
            tbody.innerHTML = '<tr id="cfmServicesEmpty"><td colspan="4" class="services-mini-empty">Niciun serviciu adăugat.</td></tr>';
            return;
        }

        var html = '';
        _currentServices.forEach(function (srv, idx) {
            html += '<tr>';
            html += '<td style="font-weight:600; font-family:monospace;">' + _escHtml(srv.code) + '</td>';
            html += '<td>' + _escHtml(srv.name) + '</td>';
            html += '<td>' + _escHtml(srv.utility) + '</td>';
            html += '<td style="text-align:center;">';
            html += '<button type="button" class="btn-action-icon" title="Elimină serviciu" style="color:var(--red);" onclick="PartnerContracts.removeService(' + idx + ')">';
            html += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
            html += '</button>';
            html += '</td>';
            html += '</tr>';
        });

        tbody.innerHTML = html;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PUBLIC API
    // ══════════════════════════════════════════════════════════════════════════

    function init(existingContracts) {
        if (existingContracts && existingContracts.length) {
            existingContracts.forEach(function (c) {
                c.id = _nextId++;
                _contracts.push(c);
            });
        }
        _renderContractTable();

        // Close modal bindings
        var closeBtn = document.getElementById('btnCloseContractForm');
        if (closeBtn) {
            closeBtn.addEventListener('click', closeContractForm);
        }
    }

    function openContractForm() {
        _editingId = null;
        _currentServices = [];

        // Reset form
        document.getElementById('cfmContractNo').value = '';
        document.getElementById('cfmContractDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('cfmDuration').value = '5';
        document.getElementById('cfmInstallDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('cfmComments').value = '';

        refreshNodChecklist();
        _renderServicesTable();

        var title = document.getElementById('contractFormModal-title');
        if (title) title.textContent = 'Adaugă Contract';

        var modal = document.getElementById('contractFormModal');
        if (modal) modal.style.display = 'flex';
    }

    function closeContractForm() {
        var modal = document.getElementById('contractFormModal');
        if (modal) modal.style.display = 'none';
        _editingId = null;
    }

    function editContract(id) {
        var ctr = _contracts.find(function (c) { return c.id === id; });
        if (!ctr) return;

        _editingId = id;
        _currentServices = (ctr.services || []).slice();

        document.getElementById('cfmContractNo').value = ctr.contractNo || '';
        document.getElementById('cfmContractDate').value = ctr.date || '';
        document.getElementById('cfmDuration').value = ctr.duration || '5';
        document.getElementById('cfmInstallDate').value = ctr.installDate || '';
        document.getElementById('cfmComments').value = ctr.comments || '';

        refreshNodChecklist();
        _renderServicesTable();

        var title = document.getElementById('contractFormModal-title');
        if (title) title.textContent = 'Editează Contract – ' + ctr.contractNo;

        var modal = document.getElementById('contractFormModal');
        if (modal) modal.style.display = 'flex';
    }

    function saveContractForm() {
        var contractNo = document.getElementById('cfmContractNo').value.trim();
        var contractDate = document.getElementById('cfmContractDate').value;
        var duration = document.getElementById('cfmDuration').value;

        if (!contractNo) {
            alert('Introduceți numărul contractului.');
            document.getElementById('cfmContractNo').focus();
            return;
        }
        if (!contractDate) {
            alert('Selectați data contractului.');
            return;
        }

        var dVal = parseFloat(duration);
        if (isNaN(dVal) || dVal <= 0 || dVal > 10) {
            alert('Durata trebuie să fie o valoare pozitivă de maximum 10 ani.');
            document.getElementById('cfmDuration').focus();
            return;
        }

        // Colectez NOD-uri selectate
        var selectedNods = [];
        var checkboxes = document.querySelectorAll('#cfmNodsChecklist input[type="checkbox"]:checked');
        checkboxes.forEach(function (cb) {
            selectedNods.push(cb.value);
        });

        var data = {
            contractNo: contractNo,
            date:       contractDate,
            duration:   duration,
            installDate: document.getElementById('cfmInstallDate').value,
            comments:   document.getElementById('cfmComments').value.trim(),
            nods:       selectedNods,
            services:   _currentServices.slice(),
        };

        if (_editingId !== null) {
            var ctr = _contracts.find(function (c) { return c.id === _editingId; });
            if (ctr) Object.assign(ctr, data);
        } else {
            data.id = _nextId++;
            _contracts.push(data);
        }

        _renderContractTable();
        closeContractForm();
    }

    function deleteContract(id) {
        if (!confirm('Confirmați ștergerea contractului?')) return;
        _contracts = _contracts.filter(function (c) { return c.id !== id; });
        _renderContractTable();
    }

    // ── Service Picker ───────────────────────────────────────────────────────
    function openServicePicker() {
        var search = document.getElementById('servicePickerSearch');
        if (search) { search.value = ''; filterServices(); }

        var modal = document.getElementById('servicePickerModal');
        if (modal) modal.style.display = 'flex';
    }

    function closeServicePicker() {
        var modal = document.getElementById('servicePickerModal');
        if (modal) modal.style.display = 'none';
    }

    function filterServices() {
        var q = (document.getElementById('servicePickerSearch').value || '').toLowerCase().trim();
        var rows = document.querySelectorAll('#servicePickerBody tr');
        rows.forEach(function (r) {
            var text = r.getAttribute('data-search') || '';
            r.style.display = (!q || text.indexOf(q) !== -1) ? '' : 'none';
        });
    }

    function selectService(code, name, utility) {
        // Verifică dacă deja există
        var exists = _currentServices.some(function (s) { return s.code === code; });
        if (exists) {
            alert('Serviciul ' + code + ' este deja adăugat.');
            return;
        }

        _currentServices.push({ code: code, name: name, utility: utility });
        _renderServicesTable();
        closeServicePicker();
    }

    function removeService(idx) {
        _currentServices.splice(idx, 1);
        _renderServicesTable();
    }

    return {
        init:                init,
        openContractForm:    openContractForm,
        closeContractForm:   closeContractForm,
        editContract:        editContract,
        saveContractForm:    saveContractForm,
        deleteContract:      deleteContract,
        openServicePicker:   openServicePicker,
        closeServicePicker:  closeServicePicker,
        filterServices:      filterServices,
        selectService:       selectService,
        removeService:       removeService,
        refreshNodChecklist: refreshNodChecklist,
        getContracts:        function () { return _contracts.slice(); },
    };
})();
