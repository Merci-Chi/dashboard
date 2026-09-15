(() => {
  'use strict';

  const installLeadPerformancePatch = frame => {
    if (!frame || frame.id !== 'leadsFrameDeferred') return;

    try {
      const doc = frame.contentDocument;
      if (!doc || doc.querySelector('script[data-lead-performance-limit]')) return;

      const script = doc.createElement('script');
      script.src = 'performance-limit.js?v=20260914-1';
      script.dataset.leadPerformanceLimit = 'true';
      (doc.head || doc.documentElement).appendChild(script);
    } catch (error) {
      console.error('Could not install Leads performance limiter:', error);
    }
  };

  const prepareFrame = frame => {
    if (!frame || frame.dataset.deferredPrepared === 'true') return;
    frame.dataset.deferredPrepared = 'true';

    if (frame.id === 'leadsFrameDeferred') {
      frame.addEventListener('load', () => installLeadPerformancePatch(frame));
    }
  };

  const loadActiveFrame = () => {
    const active = document.querySelector('.view.active');
    const frame = active?.querySelector('iframe[data-src]');
    if (!frame || frame.getAttribute('src')) return;

    prepareFrame(frame);
    frame.setAttribute('src', frame.dataset.src);
  };

  document.querySelectorAll('iframe[data-src]').forEach(prepareFrame);

  const observer = new MutationObserver(loadActiveFrame);
  document.querySelectorAll('.view').forEach(view => {
    observer.observe(view, { attributes: true, attributeFilter: ['class'] });
  });

  document.addEventListener('click', event => {
    if (event.target.closest('[data-view]')) setTimeout(loadActiveFrame, 0);
  }, true);

  window.addEventListener('hashchange', () => setTimeout(loadActiveFrame, 0));
  setTimeout(loadActiveFrame, 0);
})();
