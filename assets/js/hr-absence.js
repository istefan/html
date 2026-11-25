/**
 * SonicAbsence – fereastra comună „Adaugă absență” (SONIC → Personal) și regulile HR în pagină.
 * Markup: partials/absence-modal.php; date: window.SONIC_HR (partials/personal-data.php → hr_js_payload()).
 *
 *   SonicAbsence.open({ staff, date, type, lockStaff, onSaved })   – deschide fereastra (onSaved(record) la salvare)
 *   SonicAbsence.balance(staffId[, year])                          – soldul concediului de odihnă (aceleași reguli ca PHP)
 *   SonicAbsence.medical(staffId)                                  – zile CM în anul curent / ultimele 12 luni
 *   SonicAbsence.workdays(from, to[, skip])                        – zile lucrătoare (fără weekend și sărbători legale)
 *   SonicAbsence.detail(record)                                    – textul detaliului (certificat CM, eveniment, paternal)
 *   SonicAbsence.setStatus(id, status)                             – actualizează starea în datele din pagină (Aprobat / Anulat)
 *
 * React: hook useHrRules() + <AbsenceModal /> – aceleași calcule rulează și pe server la POST /api/staff/absences.
 */
(function () {
    'use strict';
    const HR = window.SONIC_HR;
    if (!HR) return;
    const $ = id => document.getElementById(id);
    const esc = s => (s == null ? '' : String(s)).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const fmt = iso => iso ? iso.split('-').reverse().join('.') : '';
    const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return iso2(d); };
    const iso2 = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
    let nextId = 900, opts = {};

    /* ── Calcule ─────────────────────────────────────────── */
    function isWorkday(iso) { const d = new Date(iso + 'T00:00:00').getDay(); return d !== 0 && d !== 6 && !HR.holidays[iso]; }
    function workdays(from, to, skip) {
        let n = 0;
        for (let d = from; d <= to; d = addDays(d, 1)) if (isWorkday(d) && !(skip && skip[d])) n++;
        return n;
    }
    function calDays(from, to) { return Math.round((new Date(to + 'T00:00:00') - new Date(from + 'T00:00:00')) / 86400000) + 1; }
    function holidaysIn(from, to) {
        const out = [];
        for (let d = from; d <= to; d = addDays(d, 1)) { const w = new Date(d + 'T00:00:00').getDay(); if (HR.holidays[d] && w !== 0 && w !== 6) out.push(fmt(d).slice(0, 5) + ' ' + HR.holidays[d]); }
        return out;
    }
    function cmDays(sid) {
        const days = {};
        HR.absences.forEach(a => { if (a.staff === sid && a.type === 'Concediu medical' && a.status !== 'Anulat') for (let d = a.from; d <= a.to; d = addDays(d, 1)) days[d] = true; });
        return days;
    }
    function balance(sid, year) {
        year = year || HR.year;
        const s = HR.staff[sid]; if (!s) return null;
        const y0 = year + '-01-01', y1 = year + '-12-31';
        const start = s.hired > y0 ? s.hired : y0, end = s.terminated && s.terminated < y1 ? s.terminated : y1;
        let months = start > end ? 0 : (+end.slice(5, 7)) - (+start.slice(5, 7)) + 1 - (+start.slice(8, 10) > 15 ? 1 : 0);
        months = Math.max(0, Math.min(12, months));
        const base = months === 12 ? s.co_base : Math.round(s.co_base * months / 12);
        const extra = months === 12 ? s.co_extra : Math.round(s.co_extra * months / 12);
        const carry = year === HR.year ? s.co_carry : 0;
        const skip = cmDays(sid), tomorrow = addDays(HR.today, 1);
        let taken = 0, planned = 0, pending = 0;
        HR.absences.forEach(a => {
            if (a.staff !== sid || a.type !== 'Concediu de odihnă' || a.status === 'Anulat' || a.to < y0 || a.from > y1) return;
            const f = a.from > y0 ? a.from : y0, t = a.to < y1 ? a.to : y1;
            if (a.status === 'În așteptare') { pending += workdays(f, t, skip); return; }
            if (f <= HR.today) taken += workdays(f, t < HR.today ? t : HR.today, skip);
            if (t > HR.today) planned += workdays(f > tomorrow ? f : tomorrow, t, skip);
        });
        const total = base + extra + carry, used = taken + planned;
        return { year, months, base, extra, carry, carryLeft: Math.max(0, carry - used), total, taken, planned, pending, remaining: total - used, available: total - used - pending };
    }
    function medical(sid) {
        const y0 = HR.year + '-01-01', from12 = addDays(addDays(HR.today, 1), -365);
        const r = { work: 0, cal: 0, employer: 0, fnuass: 0, last12: 0, certs: 0 };
        HR.absences.forEach(a => {
            if (a.staff !== sid || a.type !== 'Concediu medical' || a.status === 'Anulat') return;
            if (a.to >= from12 && a.from <= HR.today) r.last12 += calDays(a.from > from12 ? a.from : from12, a.to < HR.today ? a.to : HR.today);
            if (a.to < y0) return;
            const f = a.from > y0 ? a.from : y0, wd = workdays(f, a.to), d = a.detail || {};
            const emp = ((HR.cmCodes[d.code] || {}).employer5 !== false && (d.kind || 'initial') === 'initial') ? Math.min(5, wd) : 0;
            r.certs++; r.work += wd; r.cal += calDays(f, a.to); r.employer += emp; r.fnuass += wd - emp;
        });
        return r;
    }
    function typeUsed(sid, type, year) {
        year = year || HR.year; let n = 0;
        HR.absences.forEach(a => {
            if (a.staff !== sid || a.type !== type || a.status === 'Anulat' || a.to < year + '-01-01' || a.from > year + '-12-31') return;
            n += workdays(a.from > year + '-01-01' ? a.from : year + '-01-01', a.to < year + '-12-31' ? a.to : year + '-12-31');
        });
        return n;
    }
    function detail(a) {
        const d = a.detail || {};
        if (a.type === 'Concediu medical' && d.series) return 'Certificat ' + d.series + ' ' + d.number + ' · cod ' + d.code + ' – ' + ((HR.cmCodes[d.code] || {}).name || '') + (d.kind === 'continuare' ? ' · în continuare (' + d.initial + ')' : ' · inițial');
        if (a.type === 'Eveniment familial' && d.event) return d.event;
        if (a.type === 'Concediu paternal' && d.child_birth) return 'Naștere copil ' + fmt(d.child_birth) + (d.course ? ' · cu curs de puericultură' : '');
        return '';
    }

    /* ── Fereastra ───────────────────────────────────────── */
    const modal = $('hrAbsenceModal');
    const val = id => $(id).value.trim();
    const iso = id => SonicDatepicker.getISO($(id));
    const show = (id, on) => { $(id).style.display = on ? '' : 'none'; };

    function refresh() {
        const sid = $('ddlAbsStaff').value, type = $('ddlAbsType').value;
        const from = iso('dtpAbsFrom'), to = iso('dtpAbsTo') || from;
        const code = (HR.types[type] || {}).code;
        show('absPanelCM', code === 'CM'); show('absPanelEV', code === 'EV'); show('absPanelCP', code === 'CP');
        $('txtCmInitial').disabled = $('ddlCmKind').value !== 'continuare';
        show('cmInitialStar', $('ddlCmKind').value === 'continuare');
        $('txtAbsApprover').disabled = $('ddlAbsStatus').value !== 'Aprobat';
        show('absApproverStar', $('ddlAbsStatus').value === 'Aprobat');

        // sold CO
        const b = sid ? balance(sid) : null;
        show('absBalance', !!b);
        if (b) {
            document.querySelectorAll('[data-abs-year]').forEach(e => { e.textContent = b.year; });
            $('absBalRight').textContent = (b.base + b.extra) + ' zile' + (b.extra ? ' (' + b.base + ' + ' + b.extra + ' supl.)' : '') + (b.months < 12 ? ' · ' + b.months + ' luni' : '');
            $('absBalCarry').textContent = b.carry ? b.carry + ' zile din ' + (b.year - 1) + ' (până la 30.06.' + (b.year + 1) + ')' : '—';
            $('absBalUsed').textContent = b.taken + ' + ' + b.planned;
            $('absBalPending').textContent = b.pending;
            $('absBalLeft').textContent = b.available + ' zile CO disponibile';
            $('absBalLeft').className = 'status-badge ' + (b.available <= 0 ? 'status-error' : b.available <= 3 ? 'status-warning' : 'status-online');
        }

        // zile
        const info = $('absDaysInfo'), warn = [];
        if (from && to && from <= to) {
            const wd = workdays(from, to), hol = holidaysIn(from, to);
            info.innerHTML = '<strong>' + plural(wd, 'zi lucrătoare', 'zile lucrătoare') + '</strong> · ' + plural(calDays(from, to), 'zi calendaristică', 'zile calendaristice')
                + (hol.length ? ' · sărbători legale excluse: ' + esc(hol.join(', ')) : '') + ' · ' + esc((HR.types[type] || {}).basis || '');
            info.style.display = '';
            if (code === 'CO' && b && wd > b.available) warn.push('Concediul cerut (' + wd + ' zile) depășește soldul disponibil (' + b.available + ' zile).');
            if (code === 'CM' && sid) {
                const m = medical(sid), d = HR.cmCodes[$('ddlCmCode').value];
                const emp = d && d.employer5 && $('ddlCmKind').value === 'initial' ? Math.min(5, wd) : 0;
                $('absCmInfo').innerHTML = (d ? 'Indemnizație ' + d.pct + '% · ' : '') + 'zile suportate de angajator: <strong>' + emp + '</strong> · din FNUASS: <strong>' + (wd - emp) + '</strong>'
                    + '<br>Concediu medical în ultimele 12 luni: <strong>' + m.last12 + '</strong> zile + ' + calDays(from, to) + ' (limita: ' + HR.cmLimit + ' zile; aviz medic expert peste ' + HR.cmExpert + ').';
                if (m.last12 + calDays(from, to) > HR.cmExpert) warn.push('Se depășesc ' + HR.cmExpert + ' de zile de concediu medical în ultimele 12 luni – prelungirea necesită avizul medicului expert al asigurărilor sociale.');
                const co = HR.absences.filter(a => a.staff === sid && a.type === 'Concediu de odihnă' && a.status !== 'Anulat' && a.from <= to && a.to >= from);
                if (co.length) warn.push('Se suprapune cu concediul de odihnă ' + fmt(co[0].from) + ' – ' + fmt(co[0].to) + ': concediul de odihnă se întrerupe (art. 150 Codul muncii), iar zilele suprapuse revin în sold.');
            }
            const lim = (HR.types[type] || {}).limit;
            if ((code === 'CI' || code === 'FM') && sid) {
                const used = typeUsed(sid, type);
                if (used + wd > lim) warn.push('Se depășește limita anuală de ' + lim + ' zile lucrătoare (folosite în ' + HR.year + ': ' + used + ').');
            }
            if (code === 'FM') warn.push('Absența pentru forță majoră se recuperează (art. 152^2 Codul muncii) – stabiliți cu angajatul zilele de recuperare.');
        } else info.style.display = 'none';
        if (code === 'CFP') warn.push('Concediul fără plată nu se ia în calcul la vechime și la dreptul de concediu de odihnă.');
        if (code === 'CCC') warn.push('Concediul pentru creșterea copilului suspendă contractul de muncă – se înregistrează și în Revisal.');
        $('absWarn').innerHTML = warn.map(w => '<div>' + w + '</div>').join('');
        show('absWarn', warn.length);

        // intervenții SONIC PRO afectate
        const hits = sid && from ? (HR.interventions[sid] || []).filter(i => i.date >= from && i.date <= to) : [];
        $('absIvAlert').innerHTML = hits.length ? '<div><strong>' + plural(hits.length, 'intervenție programată', 'intervenții programate') + ' în perioada aleasă</strong> – trebuie reprogramate din SONIC PRO:</div>'
            + hits.map(i => '<div>' + esc(i.id) + ' · ' + fmt(i.date) + ' ' + esc(i.time) + ' · ' + esc(i.type) + ' · NOD ' + esc(i.nod) + '</div>').join('') : '';
        show('absIvAlert', hits.length);
        return { sid, type, code, from, to, b, hits };
    }

    function open(o) {
        opts = o || {};
        $('ddlAbsStaff').value = opts.staff || '';
        $('ddlAbsStaff').disabled = !!(opts.lockStaff && opts.staff);
        $('ddlAbsType').value = opts.type || '';
        ['dtpAbsFrom', 'dtpAbsTo'].forEach(id => SonicDatepicker.setValue($(id), opts.date || ''));
        ['txtCmSeries', 'txtCmNumber', 'txtCmInitial', 'txtCmDoctor', 'txtAbsNote'].forEach(id => { $(id).value = ''; });
        SonicDatepicker.setValue($('dtpCmIssued'), ''); SonicDatepicker.setValue($('dtpChildBirth'), '');
        $('ddlCmCode').value = ''; $('ddlCmKind').value = 'initial'; $('ddlEvent').value = ''; $('chkCourse').checked = false;
        $('ddlAbsStatus').value = 'Aprobat'; $('txtAbsApprover').value = HR.approver; $('fileAbsDoc').value = '';
        show('absErrors', false);
        refresh();
        modal.style.display = 'flex';
        ($('ddlAbsStaff').value ? $('ddlAbsType') : $('ddlAbsStaff')).focus();
    }
    const close = () => { modal.style.display = 'none'; };

    function save() {
        const r = refresh();
        const e = [];
        if (!r.sid) e.push('Selectați angajatul.');
        if (!r.type) e.push('Selectați tipul absenței.');
        if (!r.from || !iso('dtpAbsTo')) e.push('Completați perioada (De la / Până la).');
        else if (r.from > r.to) e.push('Data de început nu poate fi după data de sfârșit.');
        const wd = r.from && r.to && r.from <= r.to ? workdays(r.from, r.to) : 0;
        const detail = {};
        if (r.type && r.from && r.to && r.from <= r.to) {
            if (['CO', 'EV', 'CP', 'CI', 'FM'].includes(r.code) && !wd) e.push('Perioada nu conține nicio zi lucrătoare.');
            const clash = HR.absences.find(a => a.staff === r.sid && a.status !== 'Anulat' && a.from <= r.to && a.to >= r.from
                && !(r.code === 'CM' && a.type === 'Concediu de odihnă'));
            if (clash) e.push('Angajatul are deja o absență în perioada aleasă: ' + clash.type + ', ' + fmt(clash.from) + ' – ' + fmt(clash.to) + '.');
            if (r.code === 'CO' && r.b && wd > r.b.available) e.push('Concediul de odihnă depășește soldul disponibil (' + r.b.available + ' zile).');
            if (r.code === 'CM') {
                if (!val('txtCmSeries') || !val('txtCmNumber')) e.push('Completați seria și numărul certificatului medical.');
                if (!iso('dtpCmIssued')) e.push('Completați data acordării certificatului.');
                if (!$('ddlCmCode').value) e.push('Selectați codul de indemnizație.');
                if ($('ddlCmKind').value === 'continuare' && !val('txtCmInitial')) e.push('Completați seria și numărul certificatului inițial.');
                Object.assign(detail, { series: val('txtCmSeries').toUpperCase(), number: val('txtCmNumber'), issued: iso('dtpCmIssued'), code: $('ddlCmCode').value, kind: $('ddlCmKind').value, initial: val('txtCmInitial'), doctor: val('txtCmDoctor') });
            }
            if (r.code === 'EV') {
                const ev = $('ddlEvent').value;
                if (!ev) e.push('Selectați evenimentul familial.');
                else if (wd > HR.events[ev]) e.push('Pentru „' + ev + '” se acordă ' + plural(HR.events[ev], 'zi lucrătoare', 'zile lucrătoare') + '.');
                detail.event = ev;
            }
            if (r.code === 'CP') {
                const birth = iso('dtpChildBirth'), max = $('chkCourse').checked ? 15 : 10;
                if (!birth) e.push('Completați data nașterii copilului.');
                else if (r.from < birth || r.to > addDays(birth, 56)) e.push('Concediul paternal se acordă în primele 8 săptămâni de la nașterea copilului.');
                if (wd + typeUsed(r.sid, r.type) > max) e.push('Concediul paternal este de cel mult ' + max + ' zile lucrătoare.');
                Object.assign(detail, { child_birth: birth, course: $('chkCourse').checked });
            }
            if ((r.code === 'CI' || r.code === 'FM') && typeUsed(r.sid, r.type) + wd > HR.types[r.type].limit)
                e.push('Se depășește limita anuală de ' + HR.types[r.type].limit + ' zile lucrătoare pentru „' + r.type + '”.');
        }
        if ($('ddlAbsStatus').value === 'Aprobat' && !val('txtAbsApprover')) e.push('Completați cine a aprobat.');
        $('absErrors').innerHTML = e.map(x => '<div>' + x + '</div>').join('');
        show('absErrors', e.length);
        if (e.length) { $('absErrors').scrollIntoView({ block: 'nearest' }); return; }
        if (r.hits.length && !confirm('Angajatul are ' + plural(r.hits.length, 'intervenție programată', 'intervenții programate') + ' în perioada aleasă. Salvați absența?')) return;
        if (r.code === 'CM' && HR.absences.some(a => a.staff === r.sid && a.type === 'Concediu de odihnă' && a.status !== 'Anulat' && a.from <= r.to && a.to >= r.from)
            && !confirm('Concediul medical se suprapune cu un concediu de odihnă, care se va întrerupe. Continuați?')) return;

        // În producție: POST /api/staff/absences
        const status = $('ddlAbsStatus').value;
        const rec = { id: 'A-' + (nextId++), staff: r.sid, type: r.type, from: r.from, to: r.to, note: val('txtAbsNote'), status,
                      approved_by: status === 'Aprobat' ? val('txtAbsApprover') : '', entered_by: HR.operator, detail,
                      document: $('fileAbsDoc').files[0] ? $('fileAbsDoc').files[0].name : '' };
        HR.absences.push(rec);
        close();
        if (typeof opts.onSaved === 'function') opts.onSaved(rec);
    }

    function setStatus(id, status, approver) {
        const a = HR.absences.find(x => x.id === id);
        if (a) { a.status = status; if (approver) a.approved_by = approver; }
        return a;
    }

    ['ddlAbsStaff', 'ddlAbsType', 'dtpAbsFrom', 'dtpAbsTo', 'ddlCmCode', 'ddlCmKind', 'ddlAbsStatus', 'ddlEvent', 'chkCourse', 'dtpChildBirth']
        .forEach(id => { $(id).addEventListener('change', refresh); $(id).addEventListener('input', refresh); });
    $('btnAbsSave').addEventListener('click', save);
    modal.addEventListener('click', ev => { if (ev.target === modal || ev.target.closest('[data-abs-close]')) close(); });
    document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && modal.style.display !== 'none') close(); });

    window.SonicAbsence = { open, close, balance, medical, workdays, calDays, detail, setStatus, typeUsed, fmt, data: HR };
})();
