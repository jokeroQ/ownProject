import { onMounted, onUnmounted } from 'vue';

// Keep fixed app layouts inside the visible viewport when mobile keyboards open.
export function useViewportHeight() {
  let frame = 0;
  const update = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const viewport = window.visualViewport;
      // A pinch zoom should magnify the page rather than reflow its layout.
      if (viewport && Math.abs(viewport.scale - 1) > 0.05) return;
      const height = Math.round(viewport?.height || window.innerHeight);
      document.documentElement.style.setProperty('--app-height', `${height}px`);
      document.documentElement.toggleAttribute('data-compact-height', height <= 500);
    });
  };
  onMounted(() => {
    update();
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
  });
  onUnmounted(() => {
    cancelAnimationFrame(frame);
    window.removeEventListener('resize', update);
    window.visualViewport?.removeEventListener('resize', update);
    document.documentElement.style.removeProperty('--app-height');
    document.documentElement.removeAttribute('data-compact-height');
  });
}
