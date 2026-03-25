// Simple global tooltip manager that replaces native `title` tooltips
// Finds elements with a `title` attribute and shows a styled tooltip.

const OFFSET_Y = 12;

function createTooltipEl() {
  const el = document.createElement('div');
  el.className = 'global-tooltip';
  el.style.left = '0px';
  el.style.top = '0px';
  el.style.visibility = 'hidden';
  document.body.appendChild(el);
  return el;
}

export default function initTooltipManager() {
  if (typeof window === 'undefined' || !document) return;
  const tip = createTooltipEl();
  let activeEl = null;

  function showFor(el, text, x, y) {
    if (!text) return;
    tip.textContent = text;
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
    tip.style.visibility = 'visible';
    requestAnimationFrame(() => tip.classList.add('visible'));
  }

  function hide() {
    tip.classList.remove('visible');
    tip.style.visibility = 'hidden';
    tip.textContent = '';
    activeEl = null;
  }

  function onMouseOver(e) {
    const el = e.target.closest && e.target.closest('*') || e.target;
    if (!el) return;
    const title = el.getAttribute && el.getAttribute('title');
    if (!title) return;
    // move title to data attribute to prevent native tooltip
    el.setAttribute('data-orig-title', title);
    el.removeAttribute('title');
    activeEl = el;
    showFor(el, title, e.clientX + 8, e.clientY + OFFSET_Y);
  }

  function onMouseMove(e) {
    if (!activeEl) return;
    const x = e.clientX + 8;
    const y = e.clientY + OFFSET_Y;
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
  }

  function onMouseOut(e) {
    const el = e.target.closest && e.target.closest('*') || e.target;
    if (!el || !activeEl) return hide();
    const orig = el.getAttribute && el.getAttribute('data-orig-title');
    if (orig) {
      el.setAttribute('title', orig);
      el.removeAttribute('data-orig-title');
    }
    hide();
  }

  function onFocus(e) {
    const el = e.target;
    const title = el.getAttribute && el.getAttribute('title');
    if (!title) return;
    el.setAttribute('data-orig-title', title);
    el.removeAttribute('title');
    activeEl = el;
    const rect = el.getBoundingClientRect();
    showFor(el, title, rect.left + rect.width / 2, rect.top - OFFSET_Y - 6);
  }

  function onBlur(e) {
    const el = e.target;
    const orig = el.getAttribute && el.getAttribute('data-orig-title');
    if (orig) {
      el.setAttribute('title', orig);
      el.removeAttribute('data-orig-title');
    }
    hide();
  }

  document.addEventListener('mouseover', onMouseOver, { passive: true });
  document.addEventListener('mousemove', onMouseMove, { passive: true });
  document.addEventListener('mouseout', onMouseOut, { passive: true });
  document.addEventListener('focusin', onFocus);
  document.addEventListener('focusout', onBlur);

  return function cleanup() {
    document.removeEventListener('mouseover', onMouseOver);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseout', onMouseOut);
    document.removeEventListener('focusin', onFocus);
    document.removeEventListener('focusout', onBlur);
    if (tip && tip.parentNode) tip.parentNode.removeChild(tip);
  };
}
