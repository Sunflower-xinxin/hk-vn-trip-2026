(() => {
  "use strict";

  let dialog = null;
  let stage = null;
  let image = null;
  let status = null;
  let previousFocus = null;
  let scale = 1;
  let translateX = 0;
  let translateY = 0;
  const pointers = new Map();
  let dragBase = null;
  let pinchBase = null;

  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

  function sourceFor(trigger) {
    const previewImage = trigger.matches("img") ? trigger : trigger.querySelector("img");
    return trigger.dataset.previewSrc || previewImage?.currentSrc || previewImage?.src || "";
  }

  function altFor(trigger) {
    const previewImage = trigger.matches("img") ? trigger : trigger.querySelector("img");
    return trigger.dataset.previewAlt || previewImage?.alt || "图片预览";
  }

  function applyTransform() {
    image.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`;
    dialog.dataset.zoomed = scale > 1.01 ? "true" : "false";
    dialog.querySelector("[data-image-preview-scale]").textContent = `${Math.round(scale * 100)}%`;
  }

  function resetTransform() {
    scale = 1;
    translateX = 0;
    translateY = 0;
    dragBase = null;
    pinchBase = null;
    pointers.clear();
    applyTransform();
  }

  function zoomAt(nextScale, pointX = 0, pointY = 0) {
    const previousScale = scale;
    scale = clamp(nextScale, 1, 6);
    if (scale === 1) {
      translateX = 0;
      translateY = 0;
    } else {
      const ratio = scale / previousScale;
      translateX = pointX - ((pointX - translateX) * ratio);
      translateY = pointY - ((pointY - translateY) * ratio);
    }
    applyTransform();
  }

  function ensureDialog() {
    if (dialog) return;
    document.body.insertAdjacentHTML("beforeend", `
      <dialog class="image-preview-dialog" id="image-preview-dialog" aria-label="全屏图片预览">
        <header class="image-preview-toolbar">
          <span data-image-preview-caption>图片预览</span>
          <div class="image-preview-controls" role="group" aria-label="图片缩放">
            <button type="button" data-image-preview-zoom-out aria-label="缩小图片">−</button>
            <button type="button" data-image-preview-reset aria-label="重置图片缩放"><span data-image-preview-scale>100%</span></button>
            <button type="button" data-image-preview-zoom-in aria-label="放大图片">＋</button>
            <button class="image-preview-close" type="button" data-image-preview-close aria-label="关闭图片预览">×</button>
          </div>
        </header>
        <div class="image-preview-stage" data-image-preview-stage>
          <img data-image-preview-image alt="">
          <p class="image-preview-status" data-image-preview-status role="status">正在载入原图…</p>
        </div>
        <p class="image-preview-help">双指或鼠标滚轮缩放 · 拖动查看细节</p>
      </dialog>`);
    dialog = document.querySelector("#image-preview-dialog");
    stage = dialog.querySelector("[data-image-preview-stage]");
    image = dialog.querySelector("[data-image-preview-image]");
    status = dialog.querySelector("[data-image-preview-status]");

    dialog.addEventListener("click", (event) => {
      if (event.target === dialog || event.target.closest("[data-image-preview-close]")) close();
      if (event.target.closest("[data-image-preview-zoom-in]")) zoomAt(scale * 1.35);
      if (event.target.closest("[data-image-preview-zoom-out]")) zoomAt(scale / 1.35);
      if (event.target.closest("[data-image-preview-reset]")) resetTransform();
    });
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      close();
    });
    dialog.addEventListener("close", cleanup);

    stage.addEventListener("wheel", (event) => {
      event.preventDefault();
      const bounds = stage.getBoundingClientRect();
      const pointX = event.clientX - bounds.left - (bounds.width / 2);
      const pointY = event.clientY - bounds.top - (bounds.height / 2);
      zoomAt(scale * Math.exp(-event.deltaY * .002), pointX, pointY);
    }, { passive: false });

    stage.addEventListener("dblclick", (event) => {
      const bounds = stage.getBoundingClientRect();
      const pointX = event.clientX - bounds.left - (bounds.width / 2);
      const pointY = event.clientY - bounds.top - (bounds.height / 2);
      zoomAt(scale > 1.01 ? 1 : 2, pointX, pointY);
    });

    stage.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      stage.setPointerCapture?.(event.pointerId);
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 1) {
        dragBase = { x: event.clientX, y: event.clientY, translateX, translateY };
      } else if (pointers.size === 2) {
        const [first, second] = [...pointers.values()];
        pinchBase = {
          distance: Math.hypot(second.x - first.x, second.y - first.y) || 1,
          centerX: (first.x + second.x) / 2,
          centerY: (first.y + second.y) / 2,
          scale,
          translateX,
          translateY
        };
      }
    });

    stage.addEventListener("pointermove", (event) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size >= 2 && pinchBase) {
        const [first, second] = [...pointers.values()];
        const distance = Math.hypot(second.x - first.x, second.y - first.y) || 1;
        const centerX = (first.x + second.x) / 2;
        const centerY = (first.y + second.y) / 2;
        scale = clamp(pinchBase.scale * (distance / pinchBase.distance), 1, 6);
        translateX = pinchBase.translateX + centerX - pinchBase.centerX;
        translateY = pinchBase.translateY + centerY - pinchBase.centerY;
        if (scale === 1) translateX = translateY = 0;
        applyTransform();
      } else if (pointers.size === 1 && dragBase && scale > 1.01) {
        translateX = dragBase.translateX + event.clientX - dragBase.x;
        translateY = dragBase.translateY + event.clientY - dragBase.y;
        applyTransform();
      }
    });

    const finishPointer = (event) => {
      pointers.delete(event.pointerId);
      stage.releasePointerCapture?.(event.pointerId);
      pinchBase = null;
      const remaining = [...pointers.values()][0];
      dragBase = remaining ? { x: remaining.x, y: remaining.y, translateX, translateY } : null;
      if (scale <= 1.01) resetTransform();
    };
    stage.addEventListener("pointerup", finishPointer);
    stage.addEventListener("pointercancel", finishPointer);
  }

  function cleanup() {
    document.body.classList.remove("is-previewing-image");
    pointers.clear();
    previousFocus?.focus?.({ preventScroll: true });
    previousFocus = null;
  }

  function close() {
    if (dialog?.open) dialog.close();
  }

  function open(trigger) {
    ensureDialog();
    const source = sourceFor(trigger);
    if (!source) return;
    previousFocus = document.activeElement;
    resetTransform();
    dialog.querySelector("[data-image-preview-caption]").textContent = altFor(trigger);
    status.textContent = "正在载入原图…";
    status.hidden = false;
    image.hidden = true;
    image.alt = altFor(trigger);
    image.onload = () => {
      status.hidden = true;
      image.hidden = false;
    };
    image.onerror = () => {
      image.hidden = true;
      status.hidden = false;
      status.textContent = "图片载入失败，请重新上传后再试。";
    };
    image.removeAttribute("src");
    image.src = source;
    if (!dialog.open) dialog.showModal();
    document.body.classList.add("is-previewing-image");
  }

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-image-preview]");
    if (!trigger || trigger.closest("#image-preview-dialog")) return;
    event.preventDefault();
    open(trigger);
  });

  document.addEventListener("keydown", (event) => {
    if (!event.target.matches('[data-image-preview][role="button"]')) return;
    if (!["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    open(event.target);
  });

  window.TravelImagePreview = { open, close };
})();
