/**
 * SONIC – Tooltip pentru butoanele de acțiune (standard unic, RULES §1.2)
 * Același aspect ca tooltip-ul din sidebar (.sidebar-tooltip); CSS: secțiunea „ACTION TOOLTIP” din style.css.
 *
 * Markup – nimic în plus față de standardul butoanelor de acțiune:
 *   <a href="…" class="btn-action-icon" title="Editează"><svg …/></a>
 *   <button type="button" class="btn-action-icon" title="Dezactivează"><svg …/></button>
 *
 * Comportament:
 *   - La hover (după 200 ms) sau la focus din tastatură, textul din `title` apare într-un tooltip
 *     deasupra butonului (sub buton, dacă nu este spațiu sus), păstrat în interiorul ecranului.
 *   - La primul hover, `title` se mută în `data-tooltip` (ca să nu apară și tooltip-ul nativ al
 *     browserului) și în `aria-label`, dacă butonul nu are deja unul (numele accesibil rămâne).
 *   - Butoanele adăugate din JS sunt acoperite automat (evenimente delegate pe document).
 *   - Dacă JS schimbă acțiunea (`btn.title = 'Activează'`), noul text este preluat imediat
 *     (data-tooltip + aria-label), fără alt cod în pagină.
 *   - Se ascunde la click, scroll, redimensionare, Esc sau la ieșirea mouse-ului.
 *   - Pe ecranele fără hover (touch) nu se afișează.
 *
 * React conversion:
 *   <Tooltip content={label}><IconButton aria-label={label} … /></Tooltip> (portal, ex. Floating UI / Radix).
 */
(function () {
    'use strict';

    var SELECTOR = '.btn-action-icon';
    var DELAY    = 200;   // ms
    var GAP      = 8;     // distanța față de buton (px)
    var EDGE     = 8;     // marginea minimă față de ecran (px)

    var tip     = null;
    var current = null;
    var timer   = null;

    var noHover = window.matchMedia && window.matchMedia('(hover: none)');

    function ensureTip() {
        if (tip) return tip;
        tip = document.createElement('div');
        tip.className = 'action-tooltip';
        tip.setAttribute('role', 'tooltip');
        tip.setAttribute('aria-hidden', 'true');
        document.body.appendChild(tip);
        return tip;
    }

    /* Textul tooltip-ului: `title` actual (dacă JS l-a schimbat) sau cel deja mutat în data-tooltip. */
    function textFor(btn) {
        var title = btn.getAttribute('title');
        if (title !== null) {
            title = title.trim();
            var prev = btn.getAttribute('data-tooltip');
            var aria = btn.getAttribute('aria-label');
            if (title && (!aria || aria === prev)) btn.setAttribute('aria-label', title);
            btn.setAttribute('data-tooltip', title);
            btn.removeAttribute('title');
        }
        return (btn.getAttribute('data-tooltip') || '').trim();
    }

    function show(btn) {
        var text = textFor(btn);
        if (!text || !document.contains(btn)) return;
        ensureTip();
        tip.textContent = text;
        tip.classList.remove('is-below');

        var r     = btn.getBoundingClientRect();
        var w     = tip.offsetWidth;
        var h     = tip.offsetHeight;
        var vw    = document.documentElement.clientWidth;
        var below = r.top - GAP - h < EDGE;

        var center  = r.left + r.width / 2;
        var clamped = Math.min(Math.max(center, EDGE + w / 2), vw - EDGE - w / 2);

        tip.classList.toggle('is-below', below);
        tip.style.left = clamped + 'px';
        tip.style.top  = (below ? r.bottom + GAP : r.top - GAP) + 'px';
        tip.style.setProperty('--tip-arrow-x', (center - clamped) + 'px');
        tip.classList.add('visible');
    }

    function hide() {
        clearTimeout(timer);
        current = null;
        if (tip) tip.classList.remove('visible');
    }

    function schedule(btn, delay) {
        clearTimeout(timer);
        current = btn;
        timer = setTimeout(function () { if (current === btn) show(btn); }, delay);
    }

    document.addEventListener('mouseover', function (e) {
        if (noHover && noHover.matches) return;
        var btn = e.target.closest ? e.target.closest(SELECTOR) : null;
        if (!btn || btn === current) return;
        schedule(btn, DELAY);
    });

    document.addEventListener('mouseout', function (e) {
        if (!current) return;
        if (e.relatedTarget && current.contains(e.relatedTarget)) return;
        if (e.target.closest && e.target.closest(SELECTOR) === current) hide();
    });

    document.addEventListener('focusin', function (e) {
        var btn = e.target.closest ? e.target.closest(SELECTOR) : null;
        if (!btn) return;
        var visible = true;
        try { visible = btn.matches(':focus-visible'); } catch (err) { /* browser vechi */ }
        if (visible) schedule(btn, 0);
    });

    document.addEventListener('focusout', function (e) {
        if (current && e.target === current) hide();
    });

    /* JS a schimbat acțiunea butonului (`btn.title = 'Activează'`) → aria-label / data-tooltip actualizate imediat. */
    if (window.MutationObserver) {
        new MutationObserver(function (list) {
            list.forEach(function (m) {
                var el = m.target;
                if (el.getAttribute('title') !== null && el.matches && el.matches(SELECTOR)) textFor(el);
            });
        }).observe(document.documentElement, { attributes: true, attributeFilter: ['title'], subtree: true });
    }

    document.addEventListener('click', hide, true);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hide(); });
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
})();
