(() => {
  const loadActiveFrame = () => {
    const active = document.querySelector('.view.active');
    const frame = active?.querySelector('iframe[data-src]');
    if (!frame || frame.getAttribute('src')) return;
    frame.setAttribute('src', frame.dataset.src);
  };
  const observer = new MutationObserver(loadActiveFrame);
  document.querySelectorAll('.view').forEach(view => observer.observe(view, { attributes: true, attributeFilter: ['class'] }));
  document.addEventListener('click', event => {
    if (event.target.closest('[data-view]')) setTimeout(loadActiveFrame, 0);
  }, true);
  window.addEventListener('hashchange', () => setTimeout(loadActiveFrame, 0));
  setTimeout(loadActiveFrame, 0);
})();