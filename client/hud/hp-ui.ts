(() => {
  // --- Colorimétrie par seuils
  const colorFor = (pct: number) => (pct <= 20 ? '#d32f2f' : (pct <= 50 ? '#c62828' : '#2e7d32'));

  // --- Construire la pill
  function buildPill(cur: number, max: number, temp = 0) {
    const wrap = document.createElement('div'); wrap.className = 'ii-hp';
    const fill = document.createElement('div'); fill.className = 'ii-hp_fill';
    const text = document.createElement('div'); text.className = 'ii-hp_text';
    const m50 = document.createElement('i'); m50.className = 'ii-hp_marker m50';
    const m20 = document.createElement('i'); m20.className = 'ii-hp_marker m20';
    const tempBar = document.createElement('div'); tempBar.className = 'ii-hp_temp';
    wrap.append(fill, text, m50, m20, tempBar);
    updatePill(wrap, cur, max, temp);
    return wrap;
  }

  // --- Mettre à jour (soins/dégâts, seuils, temp HP)
  function updatePill(node: HTMLElement, cur: number, max: number, temp = 0) {
    const pct = Math.max(0, Math.min(100, Math.round((max ? cur / max : 0) * 100)));
    const tempPct = Math.max(0, Math.min(100, Math.round((Math.min(cur + temp, max) - cur) / (max || 1) * 100)));

    node.style.setProperty('--hp-pct', pct + '%');
    node.style.setProperty('--hp-color', colorFor(pct));
    node.style.setProperty('--hp-temp', tempPct + '%');

    const text = node.querySelector('.ii-hp_text') as HTMLElement | null;
    if (text) text.textContent = `${cur}/${max}`;

    const wasCrit = (node.dataset.wasCrit === '1');
    const isCrit = pct <= 20;
    node.classList.toggle('ii-hp_crit', isCrit);
    if (isCrit && !wasCrit) { node.classList.add('ii-hp_pulse'); setTimeout(() => node.classList.remove('ii-hp_pulse'), 650); }
    node.dataset.wasCrit = isCrit ? '1' : '0';
  }

  // --- Parse "56/93"
  const parseFrac = (s: string | null) => {
    const m = String(s ?? '').trim().match(/(-?\d+)\s*\/\s*(\d+)/);
    return m ? { cur: parseInt(m[1], 10), max: parseInt(m[2], 10) } : null;
  };

  // --- Upgrade d’une cellule contenant "x/y"
  function enhanceOnce(cell: Element) {
    const el = cell as HTMLElement;
    if (!el || (el as any).__iiHp) return;

    const frac = parseFrac(el.textContent);
    if (!frac) return;

    // Récup PV temporaires possibles (via data-attr posé ailleurs si tu en as)
    const temp = (() => {
      const vAttr = el.getAttribute('data-temp-hp');
      if (vAttr) return parseInt(vAttr, 10) || 0;
      const near = el.closest('tr, .row')?.querySelector('[data-temp-hp]') as HTMLElement | null;
      return near ? (parseInt(near.getAttribute('data-temp-hp') || '0', 10) || 0) : 0;
    })();

    const pill = buildPill(frac.cur, frac.max, temp);
    const badge = document.createElement('span'); badge.className = 'ii-hp_badge'; badge.textContent = '⚠ 20% PV';
    badge.style.display = (frac.cur / frac.max <= 0.2) ? 'inline-block' : 'none';

    (el as any).__iiHp = { pill, badge };
    el.setAttribute('data-ii-hp', '1');
    el.innerHTML = '';
    el.appendChild(pill);
    el.appendChild(badge);

    el.dataset.cur = String(frac.cur);
    el.dataset.max = String(frac.max);
    el.dataset.temp = String(temp);
  }

  // --- Refresh pour toutes les pills
  function refreshAll(root: Document | Element = document) {
    root.querySelectorAll<HTMLElement>('[data-ii-hp="1"]').forEach(cell => {
      const cur = parseInt(cell.dataset.cur || '0', 10);
      const max = parseInt(cell.dataset.max || '0', 10);
      const temp = parseInt(cell.dataset.temp || '0', 10);
      updatePill((cell as any).__iiHp.pill, cur, max, temp);
      ((cell as any).__iiHp.badge as HTMLElement).style.display = (max > 0 && cur / max <= 0.2) ? 'inline-block' : 'none';
    });
  }

  // --- Observer DOM : transforme auto les fractions "x/y"
  const observer = new MutationObserver(muts => {
    for (const m of muts) {
      m.addedNodes?.forEach(n => {
        if (!(n instanceof Element)) return;
        // Cherche large : cellules et items de liste
        const hpCells = n.querySelectorAll?.('td, .cell, .stat, .hp, [role="cell"]') || [];
        hpCells.forEach(c => { if (/\d+\s*\/\s*\d+/.test(c.textContent || '')) enhanceOnce(c); });
      });
    }
    refreshAll();
  });

  function boot() {
    observer.observe(document.body, { subtree: true, childList: true });

    // Premier passage sur le DOM déjà rendu
    document.querySelectorAll('td, .cell, .stat, .hp, [role="cell"]').forEach(enhanceOnce);
    refreshAll();

    // Raccourcis rapides (+/-) sur la "ligne sélectionnée" (ou la première si aucune)
    document.addEventListener('keydown', e => {
      const sel = document.querySelector('[data-ii-hp="1"].selected') || document.querySelector('[data-ii-hp="1"]');
      if (!sel) return;
      if (e.key === '-' || e.key === '+') {
        e.preventDefault();
        const delta = (e.key === '+') ? +5 : -5;
        const max = parseInt((sel as HTMLElement).dataset.max || '0', 10);
        const cur = Math.max(0, Math.min(max, (parseInt((sel as HTMLElement).dataset.cur || '0', 10) + delta)));
        (sel as HTMLElement).dataset.cur = String(cur);
        refreshAll();
      }
    });

    // Bus d’événements (si tu envoies des updates ailleurs)
    window.addEventListener('ii:update-hp' as any, (ev: any) => {
      const { id, cur, max, temp } = ev.detail || {};
      const cell = document.querySelector(`[data-ii-hp="1"][data-combatant-id="${id}"]`) as HTMLElement | null;
      if (cell) {
        if (cur != null) cell.dataset.cur = String(cur);
        if (max != null) cell.dataset.max = String(max);
        if (temp != null) cell.dataset.temp = String(temp);
        refreshAll();
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
