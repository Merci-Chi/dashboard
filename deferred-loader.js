(() => {
  'use strict';

  const ACTIVE_FRAME_ATTR = 'data-active-frame';

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

  const unloadFrame = frame => {
    if (!frame || !frame.getAttribute('src')) return;

    try {
      frame.removeAttribute('src');
      frame.removeAttribute(ACTIVE_FRAME_ATTR);
      frame.src = 'about:blank';
      frame.removeAttribute('src');
    } catch (error) {
      console.error('Could not unload inactive dashboard frame:', error);
    }
  };

  const syncFrames = () => {
    const activeView = document.querySelector('.view.active');
    const activeFrame = activeView?.querySelector('iframe[data-src]') || null;

    document.querySelectorAll('iframe[data-src]').forEach(frame => {
      prepareFrame(frame);

      if (frame !== activeFrame) {
        unloadFrame(frame);
        return;
      }

      if (!frame.getAttribute('src')) {
        frame.setAttribute(ACTIVE_FRAME_ATTR, 'true');
        frame.setAttribute('src', frame.dataset.src);
      }
    });
  };

  document.querySelectorAll('iframe[data-src]').forEach(prepareFrame);

  const observer = new MutationObserver(() => {
    requestAnimationFrame(syncFrames);
  });

  document.querySelectorAll('.view').forEach(view => {
    observer.observe(view, { attributes: true, attributeFilter: ['class'] });
  });

  document.addEventListener('click', event => {
    if (event.target.closest('[data-view]')) {
      setTimeout(syncFrames, 0);
    }
  }, true);

  window.addEventListener('hashchange', () => setTimeout(syncFrames, 0));
  window.addEventListener('pagehide', () => {
    document.querySelectorAll('iframe[data-src]').forEach(unloadFrame);
  });

  setTimeout(syncFrames, 0);
})();
