(() => {
  "use strict";
  let trip = null;
  let outfits = {};
  let dialog = null;
  const root = () => document.querySelector("#outfit-root");
  const esc = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
  const storageKey = () => `travel-plan:outfits:v1:${encodeURIComponent(trip?.metadata?.tripId || "default-trip")}`;

  function load() {
    try {
      outfits = JSON.parse(localStorage.getItem(storageKey()) || "{}") || {};
    } catch {
      outfits = {};
    }
  }

  function save() {
    try {
      localStorage.setItem(storageKey(), JSON.stringify(outfits));
      return true;
    } catch (error) {
      console.error("Could not save outfit", error);
      alert("搭配信息保存失败，请检查浏览器可用空间后重试。");
      return false;
    }
  }

  function safeUrl(value) {
    try {
      const url = new URL(String(value || ""));
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  }

  const hasImage = (outfit) => Boolean(outfit?.imageData || outfit?.imageRef);

  function imageMarkup(outfit, day) {
    if (!hasImage(outfit)) return '<div class="outfit-placeholder" aria-hidden="true">LOOK</div>';
    const legacySource = outfit.imageData || "";
    return `<button class="outfit-card__image-button" type="button" data-image-preview aria-label="全屏查看 ${esc(day.date)} 服装搭配">
      <img ${legacySource ? `src="${legacySource}"` : "hidden"} data-outfit-image-date="${esc(day.date)}" alt="${esc(day.date)} 服装搭配">
    </button>`;
  }

  async function hydrateImages() {
    if (!window.OutfitImageStore) return;
    const images = [...document.querySelectorAll("[data-outfit-image-date]")];
    await Promise.all(images.map(async (image) => {
      const outfit = outfits[image.dataset.outfitImageDate] || {};
      if (!outfit.imageRef) return;
      try {
        const source = await window.OutfitImageStore.resolve(outfit.imageRef);
        if (!source || !image.isConnected) return;
        image.src = source;
        image.hidden = false;
      } catch (error) {
        console.error("Could not load outfit image", error);
        image.closest("button")?.setAttribute("aria-label", "图片暂时无法载入，请重新打开页面后重试");
      }
    }));
  }

  function formatDate(date) {
    const [, month, day] = date.split("-");
    return `${Number(month)}月${Number(day)}日`;
  }

  function render() {
    if (!trip || !root()) return;
    window.OutfitImageStore?.releaseObjectUrls?.();
    root().innerHTML = `
      <section class="outfit-hero">
        <p>DAILY OUTFITS</p>
        <h1>每日服装搭配</h1>
        <span>按日期保存穿搭文字、图片与参考链接</span>
      </section>
      <section class="outfit-grid">
        ${trip.days.map((day) => {
          const outfit = outfits[day.date] || {};
          const link = safeUrl(outfit.url);
          return `
            <article class="outfit-card">
              <header><span>DAY ${String(day.day).padStart(2, "0")}</span><strong>${formatDate(day.date)}</strong></header>
              ${imageMarkup(outfit, day)}
              <div class="outfit-card-body">
                <h2>${esc(day.title)}</h2>
                <p>${outfit.text ? esc(outfit.text) : "尚未添加当天穿搭"}</p>
                ${link ? `<a href="${esc(link)}" target="_blank" rel="noopener noreferrer">打开穿搭参考 ↗</a>` : ""}
                <div class="outfit-actions">
                  ${outfit.text || hasImage(outfit) || outfit.url ? `<button class="is-danger" type="button" data-outfit-clear="${day.date}">清空</button>` : ""}
                  <button class="content-editor-primary" type="button" data-outfit-edit="${day.date}">${outfit.text || hasImage(outfit) || outfit.url ? "修改搭配" : "＋ 添加搭配"}</button>
                </div>
              </div>
            </article>
          `;
        }).join("")}
      </section>
    `;
    void hydrateImages();
  }

  function openEditor(date) {
    const day = trip.days.find((item) => item.date === date);
    const outfit = outfits[date] || {};
    dialog.innerHTML = `
      <header class="content-editor-dialog-header">
        <div><span>${formatDate(date)}</span><h2>服装搭配</h2></div>
        <button type="button" data-outfit-close>关闭</button>
      </header>
      <form class="content-editor-dialog-body content-editor-form" data-outfit-form data-date="${date}">
        <p class="outfit-form-day">${esc(day?.title || "")}</p>
        <label><span>搭配说明 <small>选填</small></span><textarea name="text" rows="5" placeholder="例如：薄外套、短袖、舒适运动鞋">${esc(outfit.text || "")}</textarea></label>
        <label><span>参考网址 <small>选填</small></span><input name="url" type="url" value="${esc(outfit.url || "")}" placeholder="https://..."></label>
        <label class="content-editor-file"><span>上传搭配图片 <small>选填 · 单张最高 1GB</small></span><input name="image" type="file" accept="image/*"></label>
        ${hasImage(outfit) ? `<div class="content-editor-image-preview outfit-image-preview" data-outfit-image-preview>
          <img ${outfit.imageData ? `src="${outfit.imageData}"` : "hidden"} data-outfit-editor-image="${esc(date)}" alt="当前服装图片" data-image-preview tabindex="0" role="button" aria-label="全屏查看当前服装图片">
          <input name="removeImage" type="hidden" value="">
          <div class="outfit-image-delete-actions" role="group" aria-label="当前图片操作">
            <button class="outfit-image-delete-button is-danger" type="button" data-outfit-remove-image>删除图片</button>
            <button class="outfit-image-cancel-button" type="button" data-outfit-cancel-remove>取消删除</button>
          </div>
          <p class="outfit-image-delete-status" data-outfit-image-status aria-live="polite">当前图片会保留</p>
        </div>` : ""}
        <div class="content-editor-form-actions">
          <button type="button" data-outfit-close>取消</button>
          <button class="content-editor-primary" type="submit">保存搭配</button>
        </div>
      </form>
    `;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    const editorImage = dialog.querySelector("[data-outfit-editor-image]");
    if (editorImage && outfit.imageRef) {
      void window.OutfitImageStore?.resolve(outfit.imageRef).then((source) => {
        if (!source || !editorImage.isConnected) return;
        editorImage.src = source;
        editorImage.hidden = false;
      }).catch((error) => console.error("Could not load editor image", error));
    }
  }

  function closeEditor() {
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  async function submit(form) {
    const date = form.dataset.date;
    const current = outfits[date] || {};
    const values = new FormData(form);
    const next = {
      text: String(values.get("text") || "").trim(),
      url: String(values.get("url") || "").trim(),
      imageData: values.get("removeImage") ? "" : current.imageData || "",
      imageRef: values.get("removeImage") ? null : current.imageRef || null
    };
    const file = form.elements.image?.files?.[0];
    const submitButton = form.querySelector('[type="submit"]');
    const previousLabel = submitButton?.textContent || "保存搭配";
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = file ? "正在保存图片…" : "正在保存…";
    }
    let newReference = null;
    try {
      if (file) {
        if (!window.OutfitImageStore) throw new Error("图片存储组件尚未载入，请刷新页面后重试。");
        newReference = await window.OutfitImageStore.save(file, {
          tripId: trip?.metadata?.tripId || "default-trip",
          date
        });
        next.imageRef = newReference;
        next.imageData = "";
      }
      outfits[date] = next;
      if (!save()) throw new Error("搭配信息未能写入浏览器");
      if ((file || values.get("removeImage")) && current.imageRef) {
        await window.OutfitImageStore?.remove(current.imageRef).catch((error) => console.warn("Could not remove replaced image", error));
      }
      closeEditor();
      render();
    } catch (error) {
      if (newReference) await window.OutfitImageStore?.remove(newReference).catch(() => {});
      outfits[date] = current;
      alert(error?.message || "图片保存失败，请稍后重试。");
    } finally {
      if (submitButton?.isConnected) {
        submitButton.disabled = false;
        submitButton.textContent = previousLabel;
      }
    }
  }

  function setup() {
    document.body.insertAdjacentHTML("beforeend", '<dialog class="content-editor-dialog" id="outfit-editor-dialog"></dialog>');
    dialog = document.querySelector("#outfit-editor-dialog");
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) closeEditor();
    });
    document.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      if (button.matches("[data-outfit-remove-image]")) {
        const preview = button.closest("[data-outfit-image-preview]");
        const removeField = preview?.querySelector('[name="removeImage"]');
        const status = preview?.querySelector("[data-outfit-image-status]");
        if (removeField) removeField.value = "1";
        preview?.classList.add("is-pending-delete");
        button.disabled = true;
        button.setAttribute("aria-pressed", "true");
        if (status) status.textContent = "保存搭配后将删除当前图片";
        return;
      }
      if (button.matches("[data-outfit-cancel-remove]")) {
        const preview = button.closest("[data-outfit-image-preview]");
        const removeField = preview?.querySelector('[name="removeImage"]');
        const removeButton = preview?.querySelector("[data-outfit-remove-image]");
        const status = preview?.querySelector("[data-outfit-image-status]");
        if (removeField) removeField.value = "";
        preview?.classList.remove("is-pending-delete");
        if (removeButton) {
          removeButton.disabled = false;
          removeButton.setAttribute("aria-pressed", "false");
        }
        if (status) status.textContent = "已取消删除，当前图片会保留";
        return;
      }
      if (button.matches("[data-outfit-close]")) closeEditor();
      if (button.dataset.outfitEdit) openEditor(button.dataset.outfitEdit);
      if (button.dataset.outfitClear && confirm("清空这一天的服装搭配？")) {
        const removed = outfits[button.dataset.outfitClear];
        delete outfits[button.dataset.outfitClear];
        save();
        if (removed?.imageRef) void window.OutfitImageStore?.remove(removed.imageRef).catch((error) => console.warn("Could not remove cleared image", error));
        render();
      }
    });
    document.addEventListener("submit", (event) => {
      if (!event.target.matches("[data-outfit-form]")) return;
      event.preventDefault();
      void submit(event.target);
    });
  }

  document.addEventListener("DOMContentLoaded", setup);
  document.addEventListener("travel-data-ready", (event) => {
    trip = event.detail;
    load();
    render();
  });
})();
