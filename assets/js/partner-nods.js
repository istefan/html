/**
 * Partner NOD Management – assets/js/partner-nods.js
 *
 * Gestionează CRUD NOD-uri din pagina parteneri-edit.php (Tab 2 – NOD-uri).
 * Include: deschidere/închidere modal creare NOD, pre-populare adresă partener,
 * toggle adresă diferită, adăugare/editare rând NOD, generare apartamente.
 *
 * React conversion:
 *   Modulul devine hook-uri + state în <PartnerNodsTab />:
 *   - usePartnerNods() → state NOD-uri, CRUD handlers
 *   - useGenerateFlats() → state modal generare, handler confirmare
 */
var PartnerNods = (function () {
    'use strict';

    /** @type {Array<{id: number, code: string, city: string, street: string, no: string, block: string, entrance: string, floor: string, flat: string, zip: string, sector: string, utility: string, utilityLabel: string, observatii: string, codSaga: string, gps: string, esteMagazin: boolean, flatsCount: number}>} */
    var _nods = [];
    var _nextId = 1;
    var _editingId = null;
    var _generatingForNod = null;

    // ── Helper: generat cod NOD auto-incrementat ─────────────────────────────
    function _generateNodCode() {
        var prefix = '81-001-';
        var num = String(1000 + _nextId).slice(1); // 001, 002 ...
        return prefix + num.padStart(4, '0');
    }

    // ── Utility label mapping ────────────────────────────────────────────────
    function _utilityLabel(val) {
        var map = { 'apa': 'Apă', 'et': 'Energie Termică', 'gaz': 'Gaz' };
        return map[val] || '-';
    }

    function _utilityCssClass(val) {
        var map = { 'apa': 'utility-apa', 'et': 'utility-et', 'gaz': 'utility-gaz' };
        return map[val] || '';
    }

    // ── Partner address (citit din DOM la init) ──────────────────────────────
    var _partnerAddress = {};

    function _readPartnerAddress() {
        _partnerAddress = {
            city:     (document.getElementById('txtCity') || {}).value || '',
            street:   (document.getElementById('txtStreet') || {}).value || '',
            no:       (document.getElementById('txtNo') || {}).value || '',
            block:    (document.getElementById('txtBlock') || {}).value || '',
            entrance: (document.getElementById('txtEntrance') || {}).value || '',
            floor:    (document.getElementById('txtFloor') || {}).value || '',
            flat:     (document.getElementById('txtFlat') || {}).value || '',
            zip:      (document.getElementById('txtZip') || {}).value || '',
            sector:   (document.getElementById('txtSector') || {}).value || '',
        };
    }

    // ── Pre-fill address fields from partner ─────────────────────────────────
    function _fillAddressFromPartner() {
        var fields = ['Street', 'No', 'Block', 'Entrance', 'Floor', 'Flat', 'Zip', 'Sector'];
        fields.forEach(function (f) {
            var el = document.getElementById('nfm' + f);
            if (el) {
                el.value = _partnerAddress[f.toLowerCase()] || '';
            }
        });
        // City dropdown
        var cityEl = document.getElementById('nfmCity');
        if (cityEl) {
            var opts = cityEl.options;
            for (var i = 0; i < opts.length; i++) {
                if (opts[i].value === _partnerAddress.city) {
                    cityEl.selectedIndex = i;
                    break;
                }
            }
        }
    }

    // ── Toggle address readonly ──────────────────────────────────────────────
    function _setAddressEditable(editable) {
        var fields = ['nfmStreet', 'nfmNo', 'nfmBlock', 'nfmEntrance', 'nfmFloor', 'nfmFlat', 'nfmZip', 'nfmSector'];
        var cityEl = document.getElementById('nfmCity');

        fields.forEach(function (id) {
            var el = document.getElementById(id);
            if (el) {
                if (editable) {
                    el.removeAttribute('readonly');
                } else {
                    el.setAttribute('readonly', 'readonly');
                }
            }
        });

        if (cityEl) {
            cityEl.disabled = !editable;
        }
    }

    // ── Render tabel NOD-uri ─────────────────────────────────────────────────
    function _renderNodTable() {
        var tbody = document.getElementById('partnerNodsTableBody');
        if (!tbody) return;

        var emptyRow = document.getElementById('partnerNodsEmptyRow');

        if (_nods.length === 0) {
            tbody.innerHTML = '';
            if (emptyRow) {
                emptyRow.style.display = '';
                tbody.appendChild(emptyRow);
            }
            _updateNodCount();
            return;
        }

        if (emptyRow) emptyRow.style.display = 'none';

        var partnerCode = (document.getElementById('txtPartnerCode') || {}).value || '';
        var html = '';
        _nods.forEach(function (nod) {
            var addr = [nod.street, nod.no ? 'Nr. ' + nod.no : '', nod.block ? 'Bl. ' + nod.block : '', nod.entrance ? 'Sc. ' + nod.entrance : '', nod.city].filter(Boolean).join(', ');
            var editNodUrl = 'gestiune-nod-edit.php?nod=' + encodeURIComponent(nod.code) + '&return_to=' + encodeURIComponent('parteneri-edit.php?code=' + encodeURIComponent(partnerCode) + '&tab=nod');

            html += '<tr data-nod-id="' + nod.id + '">';
            html += '<td style="font-weight:600; font-family:monospace;">' + _escHtml(nod.code) + '</td>';
            html += '<td>' + _escHtml(addr) + '</td>';
            html += '<td><span style="font-family:monospace; font-weight:600; color:var(--accent);">' + _escHtml(nod.contract || 'CTR-2026-001') + '</span></td>';
            html += '<td style="text-align:center; font-weight:600;">' + (nod.flatsCount > 0 ? '<a href="javascript:void(0)" onclick="switchToFlatTabWithNod(\'' + _escHtml(nod.code) + '\')" style="color:var(--accent); text-decoration:underline;" title="Vezi apartamente">' + nod.flatsCount + '</a>' : '0') + '</td>';
            html += '<td style="text-align:center;">';
            // Generare Apartamente
            html += '<button type="button" class="btn-action-icon" title="Generează apartamente" onclick="PartnerNods.openGenerateFlats(' + nod.id + ')">';
            html += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>';
            html += '</button>';
            // Editare -> navigare la gestiune-nod-edit.php
            html += ' <a href="' + editNodUrl + '" class="btn-action-icon" title="Editează NOD">';
            html += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';
            html += '</a>';
            // Notă: Butonul Șterge NOD a fost eliminat
            html += '</td>';
            html += '</tr>';
        });

        tbody.innerHTML = html;
        _updateNodCount();
    }

    function _updateNodCount() {
        var el = document.getElementById('partnerNodsCount');
        if (el) el.textContent = _nods.length;
    }

    function _escHtml(str) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str || ''));
        return div.innerHTML;
    }

    function _populateContractsDropdown(selectedVal) {
        var sel = document.getElementById('nfmContract');
        if (!sel) return;
        sel.innerHTML = '<option value="-1">- Selectează contract -</option>';

        var contracts = [];
        if (window.PartnerContracts && PartnerContracts.getContracts) {
            contracts = PartnerContracts.getContracts();
        }
        if (!contracts || contracts.length === 0) {
            contracts = [{ contractNo: 'CTR-2026-001' }];
        }

        contracts.forEach(function (c) {
            var opt = document.createElement('option');
            opt.value = c.contractNo;
            opt.textContent = c.contractNo + (c.date ? ' (' + c.date + ')' : '');
            if (selectedVal && selectedVal === c.contractNo) {
                opt.selected = true;
            }
            sel.appendChild(opt);
        });
    }

    // ── Reset form ───────────────────────────────────────────────────────────
    function _resetNodForm() {
        var form = document.getElementById('nodFormInner');
        if (form) form.reset();

        var contractEl = document.getElementById('nfmContract');
        if (contractEl) contractEl.value = '-1';
        document.getElementById('nfmDifferentAddress').checked = false;
        document.getElementById('nfmEsteMagazin').checked = false;
        document.getElementById('nfmObservatii').value = '';
        document.getElementById('nfmCodSaga').value = '';
        document.getElementById('nfmGps').value = '';

        _setAddressEditable(false);
        _fillAddressFromPartner();
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PUBLIC API
    // ══════════════════════════════════════════════════════════════════════════

    function init(existingNods) {
        // Citesc adresa partenerului din form
        _readPartnerAddress();

        // Incarc NOD-uri existente (ex: din mock data la editare)
        if (existingNods && existingNods.length) {
            existingNods.forEach(function (n) {
                n.id = _nextId++;
                _nods.push(n);
            });
        }

        _renderNodTable();

        // Bind toggle adresă diferită
        var toggleEl = document.getElementById('nfmDifferentAddress');
        if (toggleEl) {
            toggleEl.addEventListener('change', function () {
                _setAddressEditable(this.checked);
                if (!this.checked) {
                    _fillAddressFromPartner();
                }
            });
        }

        // Bind close modal
        var closeBtn = document.getElementById('btnCloseNodForm');
        if (closeBtn) {
            closeBtn.addEventListener('click', closeNodForm);
        }

        var closeGfBtn = document.getElementById('btnCloseGenerateFlats');
        if (closeGfBtn) {
            closeGfBtn.addEventListener('click', closeGenerateFlats);
        }

        // Generate flats preview
        ['gfmApartmentCount', 'gfmCommercialCount', 'gfmFirstNumber'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.addEventListener('input', _updateGeneratePreview);
        });
    }

    function openNodForm() {
        _editingId = null;
        _readPartnerAddress();
        _resetNodForm();
        _populateContractsDropdown();

        var title = document.getElementById('nodFormModal-title');
        if (title) title.textContent = 'Adaugă NOD';

        var modal = document.getElementById('nodFormModal');
        if (modal) modal.style.display = 'flex';
    }

    function closeNodForm() {
        var modal = document.getElementById('nodFormModal');
        if (modal) modal.style.display = 'none';
        _editingId = null;
    }

    function editNod(id) {
        var nod = _nods.find(function (n) { return n.id === id; });
        if (!nod) return;

        _editingId = id;

        // Populare form
        document.getElementById('nfmUtility').value = nod.utility || '-1';
        document.getElementById('nfmObservatii').value = nod.observatii || '';
        document.getElementById('nfmCodSaga').value = nod.codSaga || '';
        document.getElementById('nfmGps').value = nod.gps || '';
        document.getElementById('nfmEsteMagazin').checked = !!nod.esteMagazin;

        // Adresă
        var isDifferent = nod.street !== _partnerAddress.street ||
                          nod.block !== _partnerAddress.block ||
                          nod.entrance !== _partnerAddress.entrance;

        document.getElementById('nfmDifferentAddress').checked = isDifferent;
        _setAddressEditable(isDifferent);

        // Populare câmpuri adresă
        document.getElementById('nfmStreet').value = nod.street || '';
        document.getElementById('nfmNo').value = nod.no || '';
        document.getElementById('nfmBlock').value = nod.block || '';
        document.getElementById('nfmEntrance').value = nod.entrance || '';
        document.getElementById('nfmFloor').value = nod.floor || '';
        document.getElementById('nfmFlat').value = nod.flat || '';
        document.getElementById('nfmZip').value = nod.zip || '';
        document.getElementById('nfmSector').value = nod.sector || '';

        // City
        var cityEl = document.getElementById('nfmCity');
        if (cityEl) {
            for (var i = 0; i < cityEl.options.length; i++) {
                if (cityEl.options[i].value === nod.city) {
                    cityEl.selectedIndex = i;
                    break;
                }
            }
        }

        var title = document.getElementById('nodFormModal-title');
        if (title) title.textContent = 'Editează NOD – ' + nod.code;

        var modal = document.getElementById('nodFormModal');
        if (modal) modal.style.display = 'flex';
    }

    function saveNodForm() {
        // Validare Contract
        var contractEl = document.getElementById('nfmContract');
        var contract = contractEl ? contractEl.value : '-1';
        if (contract === '-1' || !contract) {
            alert('Selectați un contract asociat.');
            if (contractEl) contractEl.focus();
            return;
        }

        var street = document.getElementById('nfmStreet').value.trim();
        var entrance = document.getElementById('nfmEntrance').value.trim();
        if (!street) {
            alert('Câmpul Stradă este obligatoriu.');
            document.getElementById('nfmStreet').focus();
            return;
        }
        if (!entrance) {
            alert('Câmpul Scară este obligatoriu.');
            document.getElementById('nfmEntrance').focus();
            return;
        }

        var cityEl = document.getElementById('nfmCity');
        var cityVal = cityEl ? cityEl.options[cityEl.selectedIndex].value : '';

        var data = {
            city:         cityVal,
            street:       street,
            no:           document.getElementById('nfmNo').value.trim(),
            block:        document.getElementById('nfmBlock').value.trim(),
            entrance:     entrance,
            floor:        document.getElementById('nfmFloor').value.trim(),
            flat:         document.getElementById('nfmFlat').value.trim(),
            zip:          document.getElementById('nfmZip').value.trim(),
            sector:       document.getElementById('nfmSector').value.trim(),
            contract:     contract,
            observatii:   document.getElementById('nfmObservatii').value.trim(),
            codSaga:      document.getElementById('nfmCodSaga').value.trim(),
            gps:          document.getElementById('nfmGps').value.trim(),
            esteMagazin:  document.getElementById('nfmEsteMagazin').checked,
        };

        if (_editingId !== null) {
            // Editare
            var nod = _nods.find(function (n) { return n.id === _editingId; });
            if (nod) {
                Object.assign(nod, data);
            }
        } else {
            // Creare
            data.id = _nextId++;
            data.code = _generateNodCode();
            data.flatsCount = 0;
            _nods.push(data);
        }

        _renderNodTable();
        closeNodForm();

        // Notify contracts tab (refresh checklist)
        if (window.PartnerContracts && PartnerContracts.refreshNodChecklist) {
            PartnerContracts.refreshNodChecklist();
        }
    }

    function deleteNod(id) {
        if (!confirm('Confirmați ștergerea NOD-ului?')) return;
        _nods = _nods.filter(function (n) { return n.id !== id; });
        _renderNodTable();

        if (window.PartnerContracts && PartnerContracts.refreshNodChecklist) {
            PartnerContracts.refreshNodChecklist();
        }
    }

    // ── Generate Flats ───────────────────────────────────────────────────────
    function openGenerateFlats(nodId) {
        var nod = _nods.find(function (n) { return n.id === nodId; });
        if (!nod) return;

        _generatingForNod = nodId;

        var codeEl = document.getElementById('gfmNodCode');
        if (codeEl) codeEl.textContent = nod.code;

        document.getElementById('gfmApartmentCount').value = 1;
        document.getElementById('gfmCommercialCount').value = 0;
        document.getElementById('gfmFirstNumber').value = 1;
        _updateGeneratePreview();

        var modal = document.getElementById('generateFlatsModal');
        if (modal) modal.style.display = 'flex';
    }

    function closeGenerateFlats() {
        var modal = document.getElementById('generateFlatsModal');
        if (modal) modal.style.display = 'none';
        _generatingForNod = null;
    }

    function _updateGeneratePreview() {
        var apCount = parseInt(document.getElementById('gfmApartmentCount').value) || 0;
        var comCount = parseInt(document.getElementById('gfmCommercialCount').value) || 0;
        var firstNum = parseInt(document.getElementById('gfmFirstNumber').value) || 1;

        var preview = document.getElementById('gfmPreview');
        if (preview) {
            var total = apCount + comCount;
            var lastNum = firstNum + total - 1;
            preview.innerHTML = 'Se vor genera <strong>' + apCount + '</strong> apartament(e) + <strong>' + comCount + '</strong> spații altă destinație, numerotate de la <strong>' + firstNum + '</strong>' + (total > 0 ? ' până la <strong>' + lastNum + '</strong>' : '') + '.';
        }
    }

    function confirmGenerateFlats() {
        var apCount = parseInt(document.getElementById('gfmApartmentCount').value) || 0;
        var comCount = parseInt(document.getElementById('gfmCommercialCount').value) || 0;
        var firstNum = parseInt(document.getElementById('gfmFirstNumber').value) || 1;

        if (apCount < 1) {
            alert('Introduceți cel puțin 1 apartament.');
            return;
        }

        var nod = _nods.find(function (n) { return n.id === _generatingForNod; });
        if (!nod) return;

        // Generez rânduri apartamente în tabelul din Tab Apartamente
        var tbody = document.getElementById('flatTableBody');
        if (!tbody) return;

        // Ascund mesajul gol
        var emptyRow = document.getElementById('flatEmptyRow');
        if (emptyRow) emptyRow.style.display = 'none';

        var total = apCount + comCount;
        for (var i = 0; i < total; i++) {
            var apNum = firstNum + i;
            var isCommercial = i >= apCount;
            var tipValue = isCommercial ? '2' : '1';
            var tipLabel = isCommercial ? 'Agent economic' : 'Locatar';

            var tr = document.createElement('tr');
            tr.className = 'flat-row';
            tr.setAttribute('data-nod', nod.code);

            tr.innerHTML = '' +
                '<td style="font-size:12px; font-weight:600; white-space:nowrap;">' + _escHtml(nod.code) + '</td>' +
                '<td style="font-weight:600;">' + String(apNum).padStart(4, '0') + '</td>' +
                '<td></td>' +
                '<td style="padding:6px 4px; text-align:center;"><input type="text" class="input-control flat-cell-input" maxlength="60" value="' + _escHtml(nod.block) + '" style="width:38px; text-align:center; padding:4px 4px; font-size:12px;"></td>' +
                '<td style="padding:6px 4px; text-align:center;"><input type="text" class="input-control flat-cell-input" maxlength="100" value="' + _escHtml(nod.entrance) + '" style="width:30px; text-align:center; padding:4px 4px; font-size:12px;"></td>' +
                '<td style="padding:6px 4px; text-align:center;"><input type="text" class="input-control flat-cell-input" maxlength="4" value="" style="width:30px; text-align:center; padding:4px 4px; font-size:12px;"></td>' +
                '<td style="padding:6px 4px; text-align:center;"><input type="text" class="input-control flat-cell-input" maxlength="30" value="' + apNum + '" style="width:38px; text-align:center; padding:4px 4px; font-size:12px;"></td>' +
                '<td style="padding:6px 4px; text-align:center;"><input type="text" class="input-control flat-cell-input" maxlength="100" value="" style="width:38px; text-align:center; padding:4px 4px; font-size:12px;"></td>' +
                '<td style="padding:6px 4px; text-align:center;"><input type="text" class="input-control flat-cell-input" maxlength="5" value="" placeholder="0.00" style="width:50px; text-align:center; padding:4px 4px; font-size:12px;"></td>' +
                '<td style="padding:6px 4px;"><select class="input-control flat-cell-input" style="font-size:12px; padding:4px 5px; width:118px;"><option value="-1">-</option><option value="2"' + (tipValue === '2' ? ' selected' : '') + '>Agent economic</option><option value="1"' + (tipValue === '1' ? ' selected' : '') + '>Locatar</option></select></td>' +
                '<td style="padding:6px 4px; text-align:center;"><select class="input-control flat-cell-input" style="font-size:12px; padding:4px 5px; width:58px;"><option value="-1">-</option><option value="1">Da</option><option value="0" selected>Nu</option></select></td>' +
                '<td style="text-align:center; padding:6px 3px;"><button type="button" class="btn-action-icon" title="Salvează" style="color:var(--green);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg></button></td>' +
                '<td style="text-align:center; padding:6px 3px;"><button type="button" class="btn-action-icon" title="Șterge" style="color:var(--red);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4h6v2"></path></svg></button></td>' +
                '<td style="text-align:center; padding:6px 3px;"><button type="button" class="btn-action-icon" title="Editează"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button></td>';

            tbody.appendChild(tr);
        }

        // Actualizez contorul de apartamente pe NOD
        nod.flatsCount = (nod.flatsCount || 0) + total;
        _renderNodTable();

        // Actualizez contorul de vizualizare
        var countEl = document.getElementById('flatVisibleCount');
        if (countEl) {
            countEl.textContent = tbody.querySelectorAll('.flat-row').length;
        }

        closeGenerateFlats();
        alert('Au fost generate ' + total + ' apartamente/spații pentru NOD-ul ' + nod.code + '.');
    }

    // ── Public: obține lista NOD-uri (pentru contracte) ──────────────────────
    function getNods() {
        return _nods.slice();
    }

    return {
        init:                 init,
        openNodForm:          openNodForm,
        closeNodForm:         closeNodForm,
        editNod:              editNod,
        saveNodForm:          saveNodForm,
        deleteNod:            deleteNod,
        openGenerateFlats:    openGenerateFlats,
        closeGenerateFlats:   closeGenerateFlats,
        confirmGenerateFlats: confirmGenerateFlats,
        getNods:              getNods,
    };
})();
