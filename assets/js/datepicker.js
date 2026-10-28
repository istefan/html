/**
 * SONIC – Datepicker (standard unic pentru TOATE câmpurile de dată, RULES §1.10)
 *
 * Markup obligatoriu (fără alt JS pe pagină):
 *   <input type="text" id="dtpReadingDate" name="reading_date" class="input-control"
 *          data-datepicker value="28.10.2026">
 *
 *   - NU se folosește <input type="date"> (arată diferit în fiecare browser și nu respectă limba aplicației).
 *   - Nu se pune `placeholder` – îl setează componenta din limba activă (ro: „ZZ.LL.AAAA”).
 *   - `value` poate fi în formatul limbii (28.10.2026) sau ISO (2026-10-28); la încărcare se afișează în formatul limbii.
 *   - Câmpurile `readonly` / `disabled` nu deschid calendarul.
 *   - Funcționează și pentru câmpuri adăugate ulterior din JS (evenimente delegate pe document).
 *
 * Limbă (i18n):
 *   - Limba = atributul `data-locale` al câmpului › SonicDatepicker.setLocale() › <html lang="…"> › „ro”.
 *   - Incluse: `ro` (implicit) și `en`. Limbă nouă: SonicDatepicker.addLocale('hu', { … aceleași chei ca `ro` … }).
 *     Pentru o limbă nedefinită, lunile și zilele se generează automat cu Intl.DateTimeFormat.
 *   - SonicDatepicker.setLocale('en') schimbă limba pentru toată pagina și reformatează valorile existente.
 *
 * API pentru scripturile paginilor:
 *   SonicDatepicker.getISO(input)         → '2026-10-28' sau '' (pentru comparații / trimitere către API)
 *   SonicDatepicker.setValue(input, val)  → val = Date | '2026-10-28' | '28.10.2026' | ''
 *   SonicDatepicker.parse(text) / format(date)
 *   La alegerea unei date se declanșează evenimentele `input` și `change` pe câmp.
 *
 * Tastatură: ↓ deschide calendarul; săgeți = zi / săptămână; PageUp / PageDown = lună (Shift = an);
 *            Home / End = început / sfârșit de săptămână; Enter = alege; Esc = închide.
 *
 * React conversion:
 *   <DatePicker value={iso} onChange={setIso} locale={i18n.language} />
 *   – în state se ține data ISO (yyyy-mm-dd); afișarea folosește formatul limbii.
 */
(function () {
    'use strict';

    var SELECTOR = 'input[data-datepicker]';

    var locales = {
        ro: {
            months: ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'],
            monthsShort: ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Noi', 'Dec'],
            weekdaysShort: ['Du', 'Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ'], // începe cu duminica (Date.getDay())
            firstDay: 1,                // 0 = duminică, 1 = luni
            format: 'dd.mm.yyyy',
            placeholder: 'ZZ.LL.AAAA',
            labels: {
                dialog: 'Alege data', today: 'Azi', clear: 'Șterge',
                prevMonth: 'Luna anterioară', nextMonth: 'Luna următoare',
                prevYear: 'Anul anterior', nextYear: 'Anul următor',
                prevYears: 'Anii anteriori', nextYears: 'Anii următori',
                chooseMonth: 'Alege luna', chooseYear: 'Alege anul'
            }
        },
        en: {
            months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
            monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            weekdaysShort: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
            firstDay: 1,
            format: 'dd/mm/yyyy',
            placeholder: 'DD/MM/YYYY',
            labels: {
                dialog: 'Choose date', today: 'Today', clear: 'Clear',
                prevMonth: 'Previous month', nextMonth: 'Next month',
                prevYear: 'Previous year', nextYear: 'Next year',
                prevYears: 'Previous years', nextYears: 'Next years',
                chooseMonth: 'Choose month', chooseYear: 'Choose year'
            }
        }
    };
    var pageLocale = null; // setat prin setLocale(); altfel <html lang>

    /* ── Limbă ─────────────────────────────────────────────── */

    function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

    function localeFromIntl(code) {
        try {
            var months = [], monthsShort = [], weekdays = [];
            var fm = new Intl.DateTimeFormat(code, { month: 'long' });
            var fs = new Intl.DateTimeFormat(code, { month: 'short' });
            var fw = new Intl.DateTimeFormat(code, { weekday: 'short' });
            for (var m = 0; m < 12; m++) {
                months.push(capitalize(fm.format(new Date(2024, m, 1))));
                monthsShort.push(capitalize(fs.format(new Date(2024, m, 1)).replace('.', '')));
            }
            for (var d = 0; d < 7; d++) weekdays.push(capitalize(fw.format(new Date(2024, 0, 7 + d)).replace('.', '')).slice(0, 2));
            return { months: months, monthsShort: monthsShort, weekdaysShort: weekdays, firstDay: 1,
                     format: 'dd.mm.yyyy', placeholder: 'DD.MM.YYYY', labels: locales.en.labels };
        } catch (e) {
            return locales.ro;
        }
    }

    function codeFor(input) {
        return ((input && input.getAttribute('data-locale')) || pageLocale ||
                document.documentElement.getAttribute('lang') || 'ro').toLowerCase();
    }

    function getLocale(code) {
        code = (code || codeFor(null)).toLowerCase();
        if (locales[code]) return locales[code];
        var base = code.split('-')[0];
        if (locales[base]) return locales[base];
        return (locales[code] = localeFromIntl(code));
    }

    /* ── Date: parsare / formatare ─────────────────────────── */

    function pad(n) { return (n < 10 ? '0' : '') + n; }

    function makeDate(y, m, d) {
        var dt = new Date(y, m - 1, d);
        return (dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d) ? dt : null;
    }

    function toISO(dt) { return dt ? dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate()) : ''; }

    function format(dt, code) {
        if (!dt) return '';
        return getLocale(code).format
            .replace('dd', pad(dt.getDate()))
            .replace('mm', pad(dt.getMonth() + 1))
            .replace('yyyy', dt.getFullYear());
    }

    /** Acceptă formatul limbii (28.10.2026, 28.10.26, 28102026) și ISO (2026-10-28). */
    function parse(text, code) {
        if (text instanceof Date) return isNaN(text) ? null : new Date(text.getFullYear(), text.getMonth(), text.getDate());
        text = String(text || '').trim();
        if (!text) return null;
        var iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
        if (iso) return makeDate(+iso[1], +iso[2], +iso[3]);

        var fmt = getLocale(code).format;
        var order = ['dd', 'mm', 'yyyy'].sort(function (a, b) { return fmt.indexOf(a) - fmt.indexOf(b); });
        var parts = text.split(/[^0-9]+/);
        if (parts.length === 1 && /^\d{8}$/.test(text)) {
            parts = [];
            order.forEach(function (t) { parts.push(text.substr(fmt.replace(/[^dmy]/g, '').indexOf(t), t.length)); });
        }
        if (parts.length !== 3) return null;
        var v = {};
        order.forEach(function (t, i) { v[t] = parseInt(parts[i], 10); });
        if (isNaN(v.dd) || isNaN(v.mm) || isNaN(v.yyyy)) return null;
        if (parts[order.indexOf('yyyy')].length === 2) v.yyyy += 2000;
        if (v.yyyy < 1900 || v.yyyy > 2199) return null;
        return makeDate(v.yyyy, v.mm, v.dd);
    }

    /* ── Popover (unul singur pe pagină) ───────────────────── */

    var ICON_PREV = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>';
    var ICON_NEXT = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>';

    var pop = null;          // elementul .datepicker
    var current = null;      // inputul activ
    var view = 'days';       // days | months | years
    var cursor = null;       // data evidențiată (navigare)
    var suppressOpen = false;

    function today() { var t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); }
    function sameDay(a, b) { return a && b && a.getTime() === b.getTime(); }
    function addDays(dt, n) { return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + n); }
    function addMonths(dt, n) {
        var last = new Date(dt.getFullYear(), dt.getMonth() + n + 1, 0).getDate();
        return new Date(dt.getFullYear(), dt.getMonth() + n, Math.min(dt.getDate(), last));
    }

    function ensurePopover() {
        if (pop) return pop;
        pop = document.createElement('div');
        pop.className = 'datepicker';
        pop.setAttribute('role', 'dialog');
        pop.hidden = true;
        // Click-ul în calendar nu mută focusul din câmp (se poate continua tastarea)
        pop.addEventListener('mousedown', function (e) { e.preventDefault(); });
        pop.addEventListener('click', onPopClick);
        pop.addEventListener('keydown', onPopKeydown);
        document.body.appendChild(pop);
        return pop;
    }

    function btn(cls, attrs, html) {
        var a = '';
        for (var k in attrs) if (attrs[k] !== null) a += ' ' + k + '="' + attrs[k] + '"';
        return '<button type="button" class="' + cls + '"' + a + '>' + html + '</button>';
    }

    function render(focusCell) {
        var loc = getLocale(codeFor(current));
        var L = loc.labels;
        var selected = parse(current.value, codeFor(current));
        var y = cursor.getFullYear(), m = cursor.getMonth();
        var head, body, cells = [];
        pop.setAttribute('aria-label', L.dialog);
        pop.setAttribute('data-view', view);

        if (view === 'days') {
            head = btn('dp-nav', { 'data-act': 'prev', 'aria-label': L.prevMonth, title: L.prevMonth }, ICON_PREV) +
                   btn('dp-title', { 'data-act': 'months', 'aria-label': L.chooseMonth, 'aria-live': 'polite' }, loc.months[m] + ' ' + y) +
                   btn('dp-nav', { 'data-act': 'next', 'aria-label': L.nextMonth, title: L.nextMonth }, ICON_NEXT);
            for (var w = 0; w < 7; w++) cells.push('<span class="dp-weekday" aria-hidden="true">' + loc.weekdaysShort[(loc.firstDay + w) % 7] + '</span>');
            var first = new Date(y, m, 1);
            var start = addDays(first, -((first.getDay() - loc.firstDay + 7) % 7));
            var t = today();
            for (var i = 0; i < 42; i++) {
                var d = addDays(start, i);
                var cls = 'dp-cell dp-day' + (d.getMonth() !== m ? ' is-out' : '') + (sameDay(d, t) ? ' is-today' : '') + (sameDay(d, selected) ? ' is-selected' : '');
                cells.push(btn(cls, {
                    'data-date': toISO(d), tabindex: sameDay(d, cursor) ? '0' : '-1',
                    'aria-label': d.getDate() + ' ' + loc.months[d.getMonth()] + ' ' + d.getFullYear(),
                    'aria-pressed': sameDay(d, selected) ? 'true' : 'false',
                    'aria-current': sameDay(d, t) ? 'date' : null
                }, d.getDate()));
            }
            body = '<div class="dp-grid dp-grid-days">' + cells.join('') + '</div>';
        } else if (view === 'months') {
            head = btn('dp-nav', { 'data-act': 'prev', 'aria-label': L.prevYear, title: L.prevYear }, ICON_PREV) +
                   btn('dp-title', { 'data-act': 'years', 'aria-label': L.chooseYear, 'aria-live': 'polite' }, y) +
                   btn('dp-nav', { 'data-act': 'next', 'aria-label': L.nextYear, title: L.nextYear }, ICON_NEXT);
            for (var mm = 0; mm < 12; mm++) {
                var mc = 'dp-cell' + (selected && selected.getFullYear() === y && selected.getMonth() === mm ? ' is-selected' : '') +
                         (t2(y, mm) ? ' is-today' : '');
                cells.push(btn(mc, { 'data-month': mm, tabindex: mm === m ? '0' : '-1', 'aria-label': loc.months[mm] + ' ' + y }, loc.monthsShort[mm]));
            }
            body = '<div class="dp-grid dp-grid-3">' + cells.join('') + '</div>';
        } else {
            var y0 = y - (y % 12);
            head = btn('dp-nav', { 'data-act': 'prev', 'aria-label': L.prevYears, title: L.prevYears }, ICON_PREV) +
                   '<span class="dp-title is-static">' + y0 + ' – ' + (y0 + 11) + '</span>' +
                   btn('dp-nav', { 'data-act': 'next', 'aria-label': L.nextYears, title: L.nextYears }, ICON_NEXT);
            for (var yy = y0; yy < y0 + 12; yy++) {
                var yc = 'dp-cell' + (selected && selected.getFullYear() === yy ? ' is-selected' : '') + (yy === today().getFullYear() ? ' is-today' : '');
                cells.push(btn(yc, { 'data-year': yy, tabindex: yy === y ? '0' : '-1' }, yy));
            }
            body = '<div class="dp-grid dp-grid-3">' + cells.join('') + '</div>';
        }

        pop.innerHTML =
            '<div class="dp-head">' + head + '</div>' + body +
            '<div class="dp-foot">' +
                btn('dp-link', { 'data-act': 'today' }, L.today) +
                btn('dp-link dp-link-muted', { 'data-act': 'clear' }, L.clear) +
            '</div>';

        if (focusCell) {
            var f = pop.querySelector('.dp-cell[tabindex="0"]');
            if (f) f.focus();
        }
    }

    function t2(y, m) { var t = today(); return t.getFullYear() === y && t.getMonth() === m; }

    function position() {
        if (!pop || pop.hidden || !current) return;
        var r = current.getBoundingClientRect();
        var w = pop.offsetWidth, h = pop.offsetHeight, gap = 4;
        var top = r.bottom + gap;
        if (top + h > window.innerHeight - 8 && r.top - h - gap > 8) top = r.top - h - gap;
        var left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
        pop.style.top = Math.round(top) + 'px';
        pop.style.left = Math.round(Math.max(8, left)) + 'px';
    }

    function isUsable(input) { return input && !input.readOnly && !input.disabled; }

    function open(input) {
        if (!isUsable(input)) return;
        ensurePopover();
        if (current && current !== input) current.setAttribute('aria-expanded', 'false');
        current = input;
        view = 'days';
        cursor = parse(input.value, codeFor(input)) || today();
        pop.hidden = false;
        pop.classList.remove('is-open'); void pop.offsetWidth; pop.classList.add('is-open');
        input.setAttribute('aria-expanded', 'true');
        render(false);
        position();
    }

    function close(focusInput) {
        if (!pop || pop.hidden) return;
        pop.hidden = true;
        if (current) {
            current.setAttribute('aria-expanded', 'false');
            if (focusInput) { suppressOpen = true; current.focus(); suppressOpen = false; }
        }
    }

    function fire(input) {
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function choose(dt) {
        current.value = format(dt, codeFor(current));
        current.classList.remove('is-invalid');
        current.removeAttribute('aria-invalid');
        fire(current);
        close(true);
    }

    function onPopClick(e) {
        var b = e.target.closest('button');
        if (!b || !current) return;
        var act = b.getAttribute('data-act');
        if (b.hasAttribute('data-date')) return choose(parse(b.getAttribute('data-date')));
        if (b.hasAttribute('data-month')) { cursor = new Date(cursor.getFullYear(), +b.getAttribute('data-month'), 1); view = 'days'; }
        else if (b.hasAttribute('data-year')) { cursor = new Date(+b.getAttribute('data-year'), cursor.getMonth(), 1); view = 'months'; }
        else if (act === 'prev' || act === 'next') {
            var s = act === 'prev' ? -1 : 1;
            cursor = view === 'days' ? addMonths(cursor, s) : view === 'months' ? addMonths(cursor, 12 * s) : addMonths(cursor, 144 * s);
        }
        else if (act === 'months' || act === 'years') view = act;
        else if (act === 'today') return choose(today());
        else if (act === 'clear') {
            current.value = '';
            current.classList.remove('is-invalid');
            current.removeAttribute('aria-invalid');
            fire(current);
            return close(true);
        }
        render(pop.contains(document.activeElement));
        position();
    }

    function onPopKeydown(e) {
        if (e.key === 'Escape') { e.preventDefault(); return close(true); }
        if (e.key === 'Tab') { e.preventDefault(); return close(true); }
        var step = null;
        if (view === 'days') {
            var loc = getLocale(codeFor(current));
            var dow = (cursor.getDay() - loc.firstDay + 7) % 7;
            step = { ArrowLeft: function () { return addDays(cursor, -1); }, ArrowRight: function () { return addDays(cursor, 1); },
                     ArrowUp: function () { return addDays(cursor, -7); }, ArrowDown: function () { return addDays(cursor, 7); },
                     Home: function () { return addDays(cursor, -dow); }, End: function () { return addDays(cursor, 6 - dow); },
                     PageUp: function () { return addMonths(cursor, e.shiftKey ? -12 : -1); },
                     PageDown: function () { return addMonths(cursor, e.shiftKey ? 12 : 1); } }[e.key];
        } else {
            var unit = view === 'months' ? 1 : 12;
            step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 }[e.key];
            if (step !== undefined) { var n = step; step = function () { return addMonths(cursor, n * unit); }; }
        }
        if (!step) return;
        e.preventDefault();
        cursor = step();
        render(true);
    }

    /* ── Evenimente delegate (merg și pentru câmpuri adăugate din JS) ── */

    function prepare(input) {
        if (input.getAttribute('data-dp-ready')) return;
        var code = codeFor(input);
        if (!input.hasAttribute('placeholder')) input.setAttribute('placeholder', getLocale(code).placeholder);
        input.setAttribute('autocomplete', 'off');
        input.setAttribute('inputmode', 'numeric');
        input.setAttribute('aria-haspopup', 'dialog');
        input.setAttribute('aria-expanded', 'false');
        if (!input.hasAttribute('maxlength')) input.setAttribute('maxlength', '10');
        var dt = parse(input.value, code);
        if (dt) input.value = format(dt, code);
        input.setAttribute('data-dp-ready', '1');
    }

    function normalize(input) {
        var v = input.value.trim();
        var dt = parse(v, codeFor(input));
        if (dt) input.value = format(dt, codeFor(input));
        var bad = v !== '' && !dt;
        input.classList.toggle('is-invalid', bad);
        if (bad) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
    }

    document.addEventListener('focusin', function (e) {
        var input = e.target.closest && e.target.closest(SELECTOR);
        if (!input) return;
        prepare(input);
        if (!suppressOpen) open(input);
    });

    document.addEventListener('click', function (e) {
        var input = e.target.closest && e.target.closest(SELECTOR);
        if (input && (!pop || pop.hidden)) open(input);
    });

    document.addEventListener('mousedown', function (e) {
        if (!pop || pop.hidden) return;
        if (pop.contains(e.target) || e.target === current) return;
        close(false);
    });

    document.addEventListener('focusout', function (e) {
        var input = e.target.closest && e.target.closest(SELECTOR);
        if (!input) return;
        setTimeout(function () {
            if (pop && pop.contains(document.activeElement)) return;
            if (current === input) close(false);
            normalize(input);
        }, 0);
    });

    document.addEventListener('keydown', function (e) {
        var input = e.target.closest && e.target.closest(SELECTOR);
        if (!input || !isUsable(input)) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!pop || pop.hidden || current !== input) open(input);
            render(true);
        } else if (e.key === 'Escape' && pop && !pop.hidden) {
            e.preventDefault();
            close(false);
        } else if (e.key === 'Enter' && pop && !pop.hidden) {
            normalize(input);
            close(false);
        } else if (e.key === 'Tab') {
            close(false);
        }
    });

    // Tastare: punctele (separatorii) se adaugă automat, iar calendarul urmărește data tastată
    document.addEventListener('input', function (e) {
        var input = e.target.closest && e.target.closest(SELECTOR);
        if (!input || e.isTrusted === false) return;
        var fmt = getLocale(codeFor(input)).format;
        var sep = fmt.replace(/[dmy]/g, '').charAt(0);
        if (e.inputType === 'insertText' && sep) {
            var v = input.value;
            var segs = fmt.split(sep);
            var len0 = segs[0].length, len1 = len0 + 1 + segs[1].length;
            if ((v.length === len0 || v.length === len1) && /\d$/.test(v) && v.split(sep).length <= 2) input.value = v + sep;
        }
        var dt = parse(input.value, codeFor(input));
        if (dt && current === input && pop && !pop.hidden) { cursor = dt; view = 'days'; render(false); }
    });

    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);

    document.addEventListener('DOMContentLoaded', function () {
        document.querySelectorAll(SELECTOR).forEach(prepare);
    });

    /* ── API public ────────────────────────────────────────── */

    window.SonicDatepicker = {
        locales: locales,
        addLocale: function (code, def) { locales[code.toLowerCase()] = def; },
        setLocale: function (code) {
            document.querySelectorAll(SELECTOR).forEach(function (input) {
                var dt = parse(input.value, codeFor(input));
                input.setAttribute('data-dp-new', dt ? toISO(dt) : '');
            });
            pageLocale = code.toLowerCase();
            document.querySelectorAll(SELECTOR).forEach(function (input) {
                var iso = input.getAttribute('data-dp-new');
                if (iso) input.value = format(parse(iso), codeFor(input));
                input.removeAttribute('data-dp-new');
                input.setAttribute('placeholder', getLocale(codeFor(input)).placeholder);
            });
            if (pop && !pop.hidden) render(false);
        },
        parse: function (text, code) { return parse(text, code); },
        format: function (dt, code) { return format(parse(dt, code), code); },
        getISO: function (input) { return toISO(parse(input.value, codeFor(input))); },
        setValue: function (input, value) {
            var dt = parse(value, codeFor(input));
            input.value = dt ? format(dt, codeFor(input)) : '';
        },
        open: open,
        close: function () { close(false); }
    };
})();
