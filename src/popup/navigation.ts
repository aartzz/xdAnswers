// src/popup/navigation.ts
// @ts-nocheck — popup UI module. AOSP-style settings search and category navigation.
import { settings } from './state';
import { t } from './i18n';

export function initAospSettingsNavigation() {
    const catView = document.getElementById('settings-categories-view');
    const subView = document.getElementById('settings-subpage-view');
    const backBtn = document.getElementById('settings-back-btn');
    const subTitle = document.getElementById('settings-subpage-title');
    const searchInp = document.getElementById('settings-search-input');
    const searchClear = document.getElementById('settings-search-clear');
    if (!catView || !subView) return;

    const sections = {
        'general': { titleKey: 'sectionGeneral', el: document.getElementById('settings-section-general') },
        'automation': { titleKey: 'sectionAutomation', el: document.getElementById('settings-section-automation') },
        'ai-tools': { titleKey: 'sectionAiTools', el: document.getElementById('settings-section-ai-tools') },
        'stealth': { titleKey: 'sectionStealth', el: document.getElementById('settings-section-stealth') },
        'appearance': { titleKey: 'sectionAppearance', el: document.getElementById('settings-section-appearance') }
    };

    function openSection(catKey) {
        const sec = sections[catKey];
        if (!sec || !sec.el) return;
        catView.classList.add('hidden');
        catView.classList.remove('aosp-anim-in');
        catView.style.display = 'none';
        subView.classList.remove('hidden');
        subView.style.display = 'flex';
        subTitle.textContent = t(sec.titleKey);
        Object.values(sections).forEach(s => {
            if (s.el) {
                s.el.classList.add('hidden');
                s.el.style.display = 'none';
            }
        });
        sec.el.classList.remove('hidden');
        sec.el.style.display = 'flex';

        // Scroll tab-content to top
        const tabContent = document.getElementById('features-tab');
        if (tabContent) tabContent.scrollTop = 0;
    }

    function backToCategories() {
        subView.classList.add('hidden');
        subView.style.display = 'none';
        catView.classList.remove('hidden');
        catView.style.display = 'flex';
        catView.classList.remove('aosp-anim-in');
        // Trigger reflow to restart CSS animation
        void catView.offsetWidth;
        catView.classList.add('aosp-anim-in');

        Object.values(sections).forEach(s => {
            if (s.el) {
                s.el.classList.add('hidden');
                s.el.style.display = 'none';
            }
        });
    }

    document.querySelectorAll('.aosp-category-card').forEach(card => {
        card.addEventListener('click', () => {
            const cat = card.dataset.category;
            openSection(cat);
        });
    });

    if (backBtn) {
        backBtn.addEventListener('click', backToCategories);
    }

    // Search functionality
    if (searchInp) {
        searchInp.addEventListener('input', () => {
            const q = searchInp.value.trim().toLowerCase();
            if (searchClear) searchClear.classList.toggle('hidden', !q);

            if (!q) {
                // If on subview, leave it, else show normal categories
                document.querySelectorAll('.aosp-category-card').forEach(c => {
                    c.classList.remove('hidden');
                    c.style.display = '';
                });
                document.querySelectorAll('.settings-section-panel .form-group').forEach(fg => {
                    fg.classList.remove('hidden');
                    fg.style.display = '';
                });
                return;
            }

            // During search: reveal all panels, highlight matching form-groups
            catView.classList.add('hidden');
            catView.style.display = 'none';
            subView.classList.remove('hidden');
            subView.style.display = 'flex';
            subTitle.textContent = t('settingsSearchPlaceholder') || 'Пошук';
            Object.values(sections).forEach(s => {
                if (!s.el) return;
                s.el.classList.remove('hidden');
                s.el.style.display = 'flex';
                let hasMatch = false;
                s.el.querySelectorAll('.form-group').forEach(fg => {
                    const terms = (fg.dataset.searchTerms || '').toLowerCase();
                    const text = (fg.textContent || '').toLowerCase();
                    const match = terms.includes(q) || text.includes(q);
                    fg.classList.toggle('hidden', !match);
                    fg.style.display = match ? '' : 'none';
                    if (match) hasMatch = true;
                });
                s.el.classList.toggle('hidden', !hasMatch);
                s.el.style.display = hasMatch ? 'flex' : 'none';
            });
        });
    }

    if (searchClear) {
        searchClear.addEventListener('click', () => {
            if (searchInp) {
                searchInp.value = '';
                searchInp.dispatchEvent(new Event('input'));
                searchInp.focus();
            }
            backToCategories();
        });
    }
}
