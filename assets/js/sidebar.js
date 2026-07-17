/**
 * SONIC BILLING – Sidebar JS
 *
 * Features:
 *   1. Smooth accordion animation (max-height driven)
 *   2. Sidebar toggle:
 *        Desktop → collapse/expand (icon-only at 64px)
 *        Mobile  → overlay slide-in with backdrop
 *   3. Custom monochrome tooltip (collapsed mode, desktop)
 *   4. Flyout submenu (collapsed mode, desktop)
 *
 * React conversion notes:
 *   toggleGroup()     → useState(isOpen) per <NavGroup>
 *   isMobile()        → useMediaQuery('(max-width: 768px)')
 *   sidebar collapse  → useState(isCollapsed) in <Layout>
 *   mobile open       → useState(isMobileOpen) in <Layout>
 *   tooltip           → <Tooltip> portal (Floating UI / Radix)
 *   flyout            → <FlyoutMenu> portal component
 *   backdrop          → conditional <Backdrop> portal
 *   localStorage      → user preferences context / API
 */
(function () {
    'use strict';

    /* ─── Module-level refs ─────────────────────────────────────── */
    var sidebar         = null;
    var backdrop        = null;
    var tooltipEl       = null;
    var flyoutEl        = null;
    var activeFlyoutGrp = null;
    var tooltipTimer    = null;

    /* ═══════════════════════════════════════════════════════════════
       HELPERS
    ═══════════════════════════════════════════════════════════════ */
    function isMobile() {
        return window.innerWidth <= 768;
    }

    function escHtml(s) {
        return s.replace(/&/g,'&amp;').replace(/</g,'&lt;')
                .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    /* ═══════════════════════════════════════════════════════════════
       1. ACCORDION
    ═══════════════════════════════════════════════════════════════ */
    function toggleGroup(btn) {
        var group    = btn.closest('.nav-group');
        var subitems = group.querySelector('.nav-subitems');

        /* Collapsed desktop mode → show flyout instead */
        if (!isMobile() && sidebar.classList.contains('collapsed')) {
            if (group.querySelectorAll('.nav-subitem').length) {
                showFlyout(btn, group);
            }
            return;
        }

        hideFlyout();
        var isOpen = group.classList.contains('open');

        if (isOpen) {
            subitems.style.maxHeight = subitems.scrollHeight + 'px';
            subitems.offsetHeight; /* force reflow */
            subitems.style.maxHeight = '0';
            group.classList.remove('open');
        } else {
            group.classList.add('open');
            subitems.style.maxHeight = subitems.scrollHeight + 'px';
            subitems.addEventListener('transitionend', function done() {
                if (group.classList.contains('open')) {
                    subitems.style.maxHeight = 'none';
                }
                subitems.removeEventListener('transitionend', done);
            });
        }
    }

    function initAccordion() {
        document.querySelectorAll('.nav-group-title').forEach(function (btn) {
            var group    = btn.closest('.nav-group');
            var subitems = group.querySelector('.nav-subitems');
            subitems.style.maxHeight = group.classList.contains('open') ? 'none' : '0';
            btn.addEventListener('click', function () { toggleGroup(btn); });
        });
    }

    /* ═══════════════════════════════════════════════════════════════
       2. SIDEBAR TOGGLE  (desktop collapse OR mobile overlay)
    ═══════════════════════════════════════════════════════════════ */

    /* ── Mobile overlay ── */
    function openMobileSidebar() {
        sidebar.classList.add('mobile-open');
        backdrop.classList.add('visible');
        document.body.style.overflow = 'hidden';
    }

    function closeMobileSidebar() {
        sidebar.classList.remove('mobile-open');
        backdrop.classList.remove('visible');
        document.body.style.overflow = '';
    }

    function initSidebarToggle() {
        var toggleBtn = document.getElementById('sidebarToggle');
        if (!toggleBtn) return;

        /* Create backdrop for mobile overlay */
        backdrop = document.createElement('div');
        backdrop.className = 'sidebar-backdrop';
        backdrop.id = 'sidebarBackdrop';
        document.body.appendChild(backdrop);
        backdrop.addEventListener('click', closeMobileSidebar);

        /* Restore desktop collapse state (not on mobile) */
        var savedCollapsed = localStorage.getItem('sb_collapsed');
        var cookieCollapsedMatch = document.cookie.match(/(^|;)\s*sb_collapsed\s*=\s*([^;]+)/);
        var cookieCollapsed = cookieCollapsedMatch ? cookieCollapsedMatch[2] : null;
        
        // Prefer localStorage as source of truth, fallback to cookie
        var isCollapsed = (savedCollapsed !== null) ? (savedCollapsed === '1') : (cookieCollapsed === '1');

        if (!isMobile() && isCollapsed) {
            sidebar.classList.add('collapsed');
            toggleBtn.setAttribute('data-collapsed', '1');
        } else if (!isMobile() && !isCollapsed) {
            sidebar.classList.remove('collapsed');
            toggleBtn.setAttribute('data-collapsed', '0');
        }

        // Ensure cookie is in sync with the determined state
        if (!isMobile() && cookieCollapsed !== (isCollapsed ? '1' : '0')) {
            document.cookie = "sb_collapsed=" + (isCollapsed ? "1" : "0") + ";path=/;max-age=31536000;SameSite=Lax";
        }

        toggleBtn.addEventListener('click', function () {
            if (isMobile()) {
                /* Mobile: toggle overlay */
                if (sidebar.classList.contains('mobile-open')) {
                    closeMobileSidebar();
                } else {
                    openMobileSidebar();
                }
            } else {
                /* Desktop: collapse / expand */
                hideFlyout();
                hideTooltip();
                var collapsed = sidebar.classList.toggle('collapsed');
                toggleBtn.setAttribute('data-collapsed', collapsed ? '1' : '0');
                localStorage.setItem('sb_collapsed', collapsed ? '1' : '0');
                document.cookie = "sb_collapsed=" + (collapsed ? "1" : "0") + ";path=/;max-age=31536000;SameSite=Lax";
            }
        });

        /* Close mobile sidebar on resize to desktop */
        window.addEventListener('resize', function () {
            if (!isMobile()) closeMobileSidebar();
        }, { passive: true });

        /* Close mobile sidebar on Escape */
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeMobileSidebar();
        });
    }

    /* ═══════════════════════════════════════════════════════════════
       3. TOOLTIP  (collapsed desktop mode, position:fixed)
          React: <Tooltip> portal using Floating UI / Radix
    ═══════════════════════════════════════════════════════════════ */
    function createTooltip() {
        tooltipEl = document.createElement('div');
        tooltipEl.className = 'sidebar-tooltip';
        tooltipEl.setAttribute('role', 'tooltip');
        tooltipEl.setAttribute('aria-hidden', 'true');
        document.body.appendChild(tooltipEl);
    }

    function showTooltip(el, text) {
        if (!sidebar.classList.contains('collapsed') || isMobile()) return;
        var sRect = sidebar.getBoundingClientRect();
        var eRect = el.getBoundingClientRect();
        tooltipEl.textContent = text;
        tooltipEl.style.left  = (sRect.right + 10) + 'px';
        tooltipEl.style.top   = (eRect.top + eRect.height / 2) + 'px';
        tooltipEl.classList.add('visible');
    }

    function hideTooltip() {
        clearTimeout(tooltipTimer);
        if (tooltipEl) tooltipEl.classList.remove('visible');
    }

    function initTooltips() {
        createTooltip();
        sidebar.querySelectorAll('[title]').forEach(function (el) {
            var text = el.getAttribute('title');
            if (!text) return;
            el.removeAttribute('title');
            el.dataset.tooltip = text;
            el.addEventListener('mouseenter', function () {
                tooltipTimer = setTimeout(function () { showTooltip(el, text); }, 180);
            });
            el.addEventListener('mouseleave', hideTooltip);
            el.addEventListener('click', hideTooltip);
        });
    }

    /* ═══════════════════════════════════════════════════════════════
       4. FLYOUT SUBMENU  (collapsed desktop mode, position:fixed)
          React: <FlyoutMenu> portal component
    ═══════════════════════════════════════════════════════════════ */
    function createFlyout() {
        flyoutEl = document.createElement('div');
        flyoutEl.className = 'sidebar-flyout';
        flyoutEl.id = 'sidebarFlyout';
        document.body.appendChild(flyoutEl);

        document.addEventListener('click', function (e) {
            if (!flyoutEl.classList.contains('visible')) return;
            if (!flyoutEl.contains(e.target) && !e.target.closest('.nav-group-title')) {
                hideFlyout();
            }
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') hideFlyout();
        });

        window.addEventListener('scroll', repositionFlyout, { passive: true });
        window.addEventListener('resize', repositionFlyout, { passive: true });
    }

    function repositionFlyout() {
        if (!flyoutEl || !flyoutEl.classList.contains('visible') || !activeFlyoutGrp) return;
        var titleBtn = activeFlyoutGrp.querySelector('.nav-group-title');
        if (titleBtn) positionFlyout(titleBtn);
    }

    function positionFlyout(titleBtn) {
        var sRect = sidebar.getBoundingClientRect();
        var tRect = titleBtn.getBoundingClientRect();
        var vh    = window.innerHeight;
        var fh    = flyoutEl.offsetHeight || 220;
        flyoutEl.style.left = (sRect.right + 6) + 'px';
        var top = tRect.top;
        if (top + fh > vh - 12) top = vh - fh - 12;
        flyoutEl.style.top = Math.max(12, top) + 'px';
    }

    function buildFlyoutHtml(titleBtn, groupEl) {
        var labelEl = titleBtn.querySelector('.nav-label');
        var label   = labelEl ? labelEl.textContent.trim()
                               : (titleBtn.dataset.tooltip || '');
        var html = '<div class="flyout-header">' + escHtml(label) + '</div>'
                 + '<div class="flyout-items">';
        groupEl.querySelectorAll('.nav-subitem').forEach(function (item) {
            html += '<a href="' + item.getAttribute('href') + '" class="flyout-item'
                  + (item.classList.contains('active') ? ' active' : '') + '">'
                  + escHtml(item.textContent.trim()) + '</a>';
        });
        return html + '</div>';
    }

    function showFlyout(titleBtn, groupEl) {
        if (!sidebar.classList.contains('collapsed') || isMobile()) return;
        hideTooltip();
        if (activeFlyoutGrp === groupEl && flyoutEl.classList.contains('visible')) {
            hideFlyout();
            return;
        }
        activeFlyoutGrp = groupEl;
        flyoutEl.innerHTML = buildFlyoutHtml(titleBtn, groupEl);
        requestAnimationFrame(function () {
            positionFlyout(titleBtn);
            flyoutEl.classList.add('visible');
        });
    }

    function hideFlyout() {
        if (flyoutEl) flyoutEl.classList.remove('visible');
        activeFlyoutGrp = null;
    }

    /* ═══════════════════════════════════════════════════════════════
       5. CONTEXTUAL HELP PANEL  (WordPress-style)
          React: <HelpPanel isOpen={isOpen} tabs={helpTabs} onTabChange={setActiveTab} />
    ═══════════════════════════════════════════════════════════════ */
    function initHelpPanel() {
        var toggleBtn = document.getElementById('helpToggle');
        var panel     = document.getElementById('helpPanel');
        if (!toggleBtn || !panel) return;

        /* ── Tab switching ── */
        panel.querySelectorAll('.help-tab-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var idx = btn.dataset.tab;

                panel.querySelectorAll('.help-tab-btn').forEach(function (b) {
                    var isThis = b.dataset.tab === idx;
                    b.classList.toggle('active', isThis);
                    b.setAttribute('aria-selected', isThis ? 'true' : 'false');
                });

                panel.querySelectorAll('.help-tab-pane').forEach(function (p) {
                    p.classList.toggle('active', p.dataset.pane === idx);
                });
            });
        });

        /* ── Panel open / close (same max-height technique as accordion) ── */
        toggleBtn.addEventListener('click', function () {
            var isOpen = panel.classList.contains('open');

            if (isOpen) {
                /* Closing: pin to current height, then animate to 0 */
                panel.style.maxHeight = panel.scrollHeight + 'px';
                panel.offsetHeight; /* force reflow */
                panel.style.maxHeight = '0';
                panel.classList.remove('open');
                toggleBtn.classList.remove('active');
                toggleBtn.setAttribute('aria-expanded', 'false');
                panel.setAttribute('aria-hidden', 'true');
            } else {
                /* Opening */
                panel.classList.add('open');
                panel.style.maxHeight = panel.scrollHeight + 'px';
                toggleBtn.classList.add('active');
                toggleBtn.setAttribute('aria-expanded', 'true');
                panel.setAttribute('aria-hidden', 'false');

                /* After transition: release max-height so content can resize */
                panel.addEventListener('transitionend', function done() {
                    if (panel.classList.contains('open')) {
                        panel.style.maxHeight = 'none';
                    }
                    panel.removeEventListener('transitionend', done);
                });
            }
        });
    }

    /* ═══════════════════════════════════════════════════════════════
       6. APP SECTION ACCORDION  (SONIC GRID / BILLING / PRO)
          React: useState(activeApp) in <Layout>, <AppSection isOpen={...} />
    ═══════════════════════════════════════════════════════════════ */
    function updateLogo(section) {
        var logoPath = section.getAttribute('data-logo');
        var logoIcon = section.getAttribute('data-logo-icon');
        /* Sidebar logo */
        var sidebarLogo = document.getElementById('sidebarLogo');
        var sidebarLogoIcon = document.getElementById('sidebarLogoIcon');
        if (sidebarLogo && logoPath) sidebarLogo.src = logoPath;
        if (sidebarLogoIcon && logoIcon) sidebarLogoIcon.textContent = logoIcon;
        /* Header mobile logo */
        var headerLogo = document.querySelector('.header-logo img');
        if (headerLogo && logoPath) headerLogo.src = logoPath;
    }

    function collapseAppSection(section) {
        var body = section.querySelector('.app-section-body');
        if (!body) return;
        body.style.maxHeight = body.scrollHeight + 'px';
        body.offsetHeight; /* force reflow */
        body.style.maxHeight = '0';
        section.classList.remove('open');
    }

    function expandAppSection(section) {
        var body = section.querySelector('.app-section-body');
        if (!body) return;
        section.classList.add('open');
        body.style.maxHeight = body.scrollHeight + 'px';
        body.addEventListener('transitionend', function done() {
            if (section.classList.contains('open')) {
                body.style.maxHeight = 'none';
            }
            body.removeEventListener('transitionend', done);
        });
    }

    function toggleAppSection(clickedSection) {
        /* Collapsed desktop mode → ignore */
        if (!isMobile() && sidebar.classList.contains('collapsed')) return;

        var isOpen = clickedSection.classList.contains('open');

        /* Close all other sections (exclusive accordion) */
        document.querySelectorAll('.app-section').forEach(function (sec) {
            if (sec !== clickedSection && sec.classList.contains('open')) {
                collapseAppSection(sec);
            }
        });

        /* Toggle clicked section */
        if (isOpen) {
            collapseAppSection(clickedSection);
        } else {
            expandAppSection(clickedSection);
            updateLogo(clickedSection);
            /* Persist */
            localStorage.setItem('active_app_section', clickedSection.getAttribute('data-app'));
        }
    }

    function initAppSections() {
        var sections = document.querySelectorAll('.app-section');
        if (!sections.length) return;

        /* Set initial max-height for bodies */
        sections.forEach(function (section) {
            var body = section.querySelector('.app-section-body');
            if (!body) return;
            body.style.maxHeight = section.classList.contains('open') ? 'none' : '0';
        });

        /* Update logo to match the initially open section */
        var openSection = document.querySelector('.app-section.open');
        if (openSection) updateLogo(openSection);

        /* Bind click handlers */
        document.querySelectorAll('.app-section-header').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var section = btn.closest('.app-section');
                toggleAppSection(section);
            });
        });
    }

    /* ═══════════════════════════════════════════════════════════════
       INIT
    ═══════════════════════════════════════════════════════════════ */
    document.addEventListener('DOMContentLoaded', function () {
        sidebar = document.getElementById('sidebar');
        if (!sidebar) return;

        createFlyout();
        initAppSections();
        initAccordion();
        initSidebarToggle();
        initTooltips();
        initHelpPanel();
    });

}());
