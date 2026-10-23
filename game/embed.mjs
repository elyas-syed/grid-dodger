// Keep the embedding page in control of scrolling; the game owns its state/input.
if (window.parent !== window && document.documentElement.dataset.arcadeEmbed === 'true') {
  let scheduled = false;
  let lastHeight = 0;
  function reportSize() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      const height = Math.ceil(document.body.getBoundingClientRect().height) + 2;
      if (height === lastHeight || height < 100) return;
      lastHeight = height;
      window.parent.postMessage({ type: 'grid-dodger:embed-size', height }, location.origin);
    });
  }
  new ResizeObserver(reportSize).observe(document.body);
  window.addEventListener('load', reportSize);
  document.fonts?.ready.then(reportSize);
  reportSize();
}
