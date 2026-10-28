import { onBeforeUnmount, ref, watch, type Ref } from 'vue';

/** Select cards in content coordinates so the selection stays accurate while scrolling. */
export function useBookmarkMarquee(
  root: Ref<HTMLElement | null>,
  enabled: Ref<boolean>,
  busy: Ref<boolean>,
  selected: Ref<number[]>,
) {
  const rectangle = ref<Record<string, string> | null>(null);
  let session: {
    pointerId: number;
    x: number;
    y: number;
    clientX: number;
    clientY: number;
    base: number[];
    additive: boolean;
    active: boolean;
  } | null = null;
  let frame = 0;

  function measure() {
    const host = root.value;
    if (!host) return;
    const bounds = host.getBoundingClientRect();
    const toolbar = host.querySelector('.batch-toolbar')?.getBoundingClientRect();
    return {
      left: bounds.left + host.clientLeft,
      right: bounds.left + host.clientLeft + host.clientWidth,
      top: Math.max(bounds.top, toolbar?.bottom ?? bounds.top),
      bottom: bounds.top + host.clientHeight,
      contentTop: bounds.top + host.clientTop,
    };
  }

  function update() {
    const host = root.value;
    const bounds = measure();
    if (!host || !session || !bounds || !session.active) return;
    const x = Math.max(bounds.left, Math.min(bounds.right, session.clientX));
    const y = Math.max(bounds.top, Math.min(bounds.bottom, session.clientY));
    const startX = bounds.left + session.x - host.scrollLeft;
    const startY = bounds.contentTop + session.y - host.scrollTop;
    const left = Math.min(startX, x),
      right = Math.max(startX, x);
    const top = Math.min(startY, y),
      bottom = Math.max(startY, y);
    rectangle.value = {
      left: `${Math.max(left, bounds.left)}px`,
      top: `${Math.max(top, bounds.top)}px`,
      width: `${Math.max(0, Math.min(right, bounds.right) - Math.max(left, bounds.left))}px`,
      height: `${Math.max(0, Math.min(bottom, bounds.bottom) - Math.max(top, bounds.top))}px`,
    };
    const hits = Array.from(host.querySelectorAll<HTMLElement>('[data-bookmark-id].is-editable'))
      .filter((card) => {
        const box = card.getBoundingClientRect();
        return box.left < right && box.right > left && box.top < bottom && box.bottom > top;
      })
      .map((card) => Number(card.dataset.bookmarkId));
    const next = [...new Set([...(session.additive ? session.base : []), ...hits])];
    if (
      next.length !== selected.value.length ||
      next.some((id, index) => id !== selected.value[index])
    )
      selected.value = next;
  }

  function step() {
    const bounds = measure();
    if (!session || !root.value || !bounds) return;
    if (session.active) {
      const y = session.clientY;
      const speed = y < bounds.top + 32 ? -12 : y > bounds.bottom - 32 ? 12 : 0;
      if (speed) root.value.scrollTop += speed;
      update();
    }
    frame = requestAnimationFrame(step);
  }

  function move(event: PointerEvent) {
    if (!session || session.pointerId !== event.pointerId) return;
    session.clientX = event.clientX;
    session.clientY = event.clientY;
    if (!session.active && root.value) {
      const bounds = root.value.getBoundingClientRect();
      session.active =
        Math.hypot(
          event.clientX - bounds.left + root.value.scrollLeft - session.x,
          event.clientY - bounds.top + root.value.scrollTop - session.y,
        ) > 4;
    }
    update();
  }

  function finish(cancel = false) {
    if (!session) return;
    if (cancel) selected.value = session.base;
    else if (!session.active && !session.additive) selected.value = [];
    const pointerId = session.pointerId;
    session = null;
    rectangle.value = null;
    cancelAnimationFrame(frame);
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', abort);
    window.removeEventListener('keydown', keydown);
    window.removeEventListener('blur', abort);
    if (root.value?.hasPointerCapture(pointerId)) root.value.releasePointerCapture(pointerId);
  }
  function end(event: PointerEvent) {
    if (session?.pointerId !== event.pointerId) return;
    move(event);
    finish();
  }
  function abort() {
    finish(true);
  }
  function keydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      abort();
    }
  }
  function start(event: PointerEvent) {
    const host = root.value;
    if (
      !enabled.value ||
      busy.value ||
      event.pointerType !== 'mouse' ||
      event.button !== 0 ||
      !host
    )
      return;
    if (
      !(event.target instanceof Element) ||
      event.target.closest(
        '[data-bookmark-id], .lastBox, .batch-toolbar, button, a, input, textarea, select, [role="button"], [role="dialog"]',
      )
    )
      return;
    const bounds = measure();
    if (!bounds || event.clientX >= bounds.right || event.clientY >= bounds.bottom) return;
    event.preventDefault();
    host.scrollTo({ top: host.scrollTop, behavior: 'instant' });
    session = {
      pointerId: event.pointerId,
      x: event.clientX - bounds.left + host.scrollLeft,
      y: event.clientY - bounds.contentTop + host.scrollTop,
      clientX: event.clientX,
      clientY: event.clientY,
      base: [...selected.value],
      additive: event.ctrlKey || event.metaKey || event.shiftKey,
      active: false,
    };
    host.setPointerCapture(event.pointerId);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', abort);
    window.addEventListener('keydown', keydown);
    window.addEventListener('blur', abort);
    frame = requestAnimationFrame(step);
  }
  watch([enabled, busy], () => {
    if (!enabled.value || busy.value) abort();
  });
  onBeforeUnmount(abort);
  return { rectangle, startMarquee: start, cancelMarquee: abort };
}
