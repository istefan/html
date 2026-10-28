/**
 * SONIC – Note de calcul: modalul de adăugare / editare (partials/calc-note-modal.php).
 *
 * Utilizare:
 *   SonicCalcNotes.open({
 *       note:   { id, type, utility, title, text, recurrence, until } | null,   // null = notă nouă
 *       onSave: function (note) { ... }                                        // primește nota validată
 *   });
 *
 * Recurență: once = doar la următorul calcul, monthly = la fiecare calcul până la închidere,
 *            until = la fiecare calcul până la data „Până la”.
 *
 * React conversion: <CalcNoteModal isOpen note={note} onSave={save} onClose={close} />
 */
(function () {
    'use strict';

    var current = null;

    function el(id) { return document.getElementById(id); }

    function toggleUntil() {
        el('calcNoteUntilGroup').style.display = el('calcNoteRecurrence').value === 'until' ? '' : 'none';
    }

    function close() {
        el('calcNoteModal').style.display = 'none';
        current = null;
    }

    function showErrors(list) {
        var box = el('calcNoteModalErrors');
        if (!list.length) { box.style.display = 'none'; box.innerHTML = ''; return; }
        box.className = 'calc-alert calc-alert--danger';
        box.innerHTML = list.map(function (m) { return '<div>' + m + '</div>'; }).join('');
        box.style.display = '';
    }

    function open(opts) {
        opts = opts || {};
        var n = opts.note || {};
        current = opts;
        el('calcNoteModal-title').textContent = n.id ? 'Editează nota de calcul' : 'Adaugă notă de calcul';
        el('calcNoteType').value = n.type || 'Regularizare';
        el('calcNoteUtility').value = n.utility || 'Apă';
        el('calcNoteTitle').value = n.title || '';
        el('calcNoteText').value = n.text || '';
        el('calcNoteRecurrence').value = n.recurrence || 'once';
        if (window.SonicDatepicker) SonicDatepicker.setValue(el('calcNoteUntil'), n.until || '');
        toggleUntil();
        showErrors([]);
        el('calcNoteModal').style.display = 'flex';
        setTimeout(function () { el('calcNoteTitle').focus(); }, 50);
    }

    function save() {
        var errors = [];
        var note = {
            id:         current && current.note ? current.note.id : null,
            type:       el('calcNoteType').value,
            utility:    el('calcNoteUtility').value,
            title:      el('calcNoteTitle').value.trim(),
            text:       el('calcNoteText').value.trim(),
            recurrence: el('calcNoteRecurrence').value,
            until:      el('calcNoteUntil').value.trim()
        };
        if (!note.title) errors.push('Titlul notei este obligatoriu.');
        if (!note.text) errors.push('Textul notei este obligatoriu.');
        if (note.recurrence === 'until' && !(window.SonicDatepicker && SonicDatepicker.getISO(el('calcNoteUntil')))) {
            errors.push('Alegeți data până la care apare nota.');
        }
        if (note.recurrence !== 'until') note.until = '';
        showErrors(errors);
        if (errors.length) return;
        var cb = current && current.onSave;
        close();
        if (typeof cb === 'function') cb(note);
    }

    document.addEventListener('DOMContentLoaded', function () {
        var modal = el('calcNoteModal');
        if (!modal) return;
        el('calcNoteRecurrence').addEventListener('change', toggleUntil);
        el('calcNoteSave').addEventListener('click', save);
        modal.querySelectorAll('[data-calc-note-close]').forEach(function (b) { b.addEventListener('click', close); });
        modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && modal.style.display === 'flex') close();
        });
    });

    window.SonicCalcNotes = { open: open, close: close };
})();
