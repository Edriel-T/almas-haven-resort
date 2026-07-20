/**
 * Resort photo gallery + lightbox
 * Home: limited grid + link to gallery.html
 * Gallery page: full grid
 */
(function () {
  const DEFAULT_PREVIEW = 6;

  function imgSrc(path) {
    if (!path) return "";
    return path
      .split("/")
      .map((part, i) => (i === 0 ? part : encodeURIComponent(part)))
      .join("/");
  }

  function getItems() {
    // Prefer Admin-managed gallery (local + cloud) when available
    if (window.AlmaSiteGallery && typeof window.AlmaSiteGallery.getItems === "function") {
      const list = window.AlmaSiteGallery.getItems();
      if (Array.isArray(list) && list.length) return list;
    }
    const cfg = window.ALMA_CONFIG || {};
    if (Array.isArray(cfg.gallery) && cfg.gallery.length) return cfg.gallery;
    return [];
  }

  let lightbox;
  let items = [];
  let index = 0;

  function ensureLightbox() {
    if (document.getElementById("galleryLightbox")) {
      lightbox = document.getElementById("galleryLightbox");
      return;
    }
    const el = document.createElement("div");
    el.id = "galleryLightbox";
    el.className = "gallery-lightbox";
    el.hidden = true;
    el.innerHTML = `
      <div class="gallery-lightbox__backdrop" data-lb-close></div>
      <div class="gallery-lightbox__stage" role="dialog" aria-modal="true" aria-label="Photo gallery">
        <button type="button" class="gallery-lightbox__close" data-lb-close aria-label="Close">×</button>
        <button type="button" class="gallery-lightbox__nav gallery-lightbox__prev" data-lb-prev aria-label="Previous">‹</button>
        <figure class="gallery-lightbox__figure">
          <img id="galleryLightboxImg" alt="" />
          <figcaption id="galleryLightboxCap"></figcaption>
        </figure>
        <button type="button" class="gallery-lightbox__nav gallery-lightbox__next" data-lb-next aria-label="Next">›</button>
        <p class="gallery-lightbox__count" id="galleryLightboxCount"></p>
      </div>
    `;
    document.body.appendChild(el);
    lightbox = el;

    el.querySelectorAll("[data-lb-close]").forEach((b) =>
      b.addEventListener("click", close)
    );
    el.querySelector("[data-lb-prev]").addEventListener("click", () => show(index - 1));
    el.querySelector("[data-lb-next]").addEventListener("click", () => show(index + 1));

    document.addEventListener("keydown", (e) => {
      if (!lightbox || lightbox.hidden) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") show(index - 1);
      if (e.key === "ArrowRight") show(index + 1);
    });
  }

  function show(i) {
    if (!items.length) return;
    index = (i + items.length) % items.length;
    const item = items[index];
    const img = document.getElementById("galleryLightboxImg");
    const cap = document.getElementById("galleryLightboxCap");
    const count = document.getElementById("galleryLightboxCount");
    img.src = imgSrc(item.src);
    img.alt = item.alt || item.label || "Resort photo";
    cap.textContent = item.label || item.alt || "";
    count.textContent = `${index + 1} / ${items.length}`;
  }

  function open(i) {
    ensureLightbox();
    items = getItems();
    if (!items.length) return;
    show(typeof i === "number" ? i : 0);
    lightbox.hidden = false;
    document.body.classList.add("modal-open");
  }

  function close() {
    if (!lightbox) return;
    lightbox.hidden = true;
    document.body.classList.remove("modal-open");
  }

  /**
   * data-gallery-grid
   * data-gallery-limit="6"  — only show N (home). Omit for all (gallery page).
   * data-gallery-more="gallery.html" — show more link href
   */
  function renderGrid(root) {
    if (!root) return;
    items = getItems();
    if (!items.length) {
      root.innerHTML = "<p class='section-lead'>Gallery photos coming soon.</p>";
      return;
    }

    const limitAttr = root.getAttribute("data-gallery-limit");
    const hasLimit = limitAttr !== null && limitAttr !== "";
    const limit = hasLimit ? Math.max(1, parseInt(limitAttr, 10) || DEFAULT_PREVIEW) : items.length;
    const moreHref = root.getAttribute("data-gallery-more") || "gallery.html";
    const visible = items.slice(0, Math.min(limit, items.length));
    const hasMore = hasLimit && items.length > limit;

    root.innerHTML = visible
      .map(
        (item, i) => `
      <button type="button" class="gallery-item reveal" data-gallery-index="${i}" data-reveal-delay="${Math.min(i * 40, 280)}ms">
        <img src="${imgSrc(item.src)}" alt="${item.alt || item.label || "Resort photo"}" loading="lazy" width="400" height="400" />
        <span class="gallery-item__label">${item.label || "Photo"}</span>
      </button>
    `
      )
      .join("");

    if (!root.dataset.galleryBound) {
      root.dataset.galleryBound = "1";
      root.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-gallery-index]");
        if (!btn) return;
        // On limited home grid, open lightbox at that index among full set
        const idx = Number(btn.getAttribute("data-gallery-index"));
        open(idx);
      });
    }

    const moreWrap = root.parentElement?.querySelector("[data-gallery-more-wrap]");
    if (moreWrap) {
      if (hasMore) {
        moreWrap.hidden = false;
        moreWrap.innerHTML = `
          <a class="btn btn-outline" href="${moreHref}">
            Show more… <span class="btn-meta">(${items.length - limit} more photos)</span>
          </a>
        `;
      } else {
        moreWrap.hidden = true;
        moreWrap.innerHTML = "";
      }
    }

    if (window.AlmaReveal) window.AlmaReveal.refresh();
  }

  function refreshGrids() {
    document.querySelectorAll("[data-gallery-grid]").forEach(renderGrid);
  }

  function init() {
    refreshGrids();
    window.addEventListener("alma:site-gallery-updated", refreshGrids);

    const hero = document.querySelector("[data-hero-image]");
    if (hero && window.ALMA_CONFIG?.heroImages?.[0]) {
      const h = window.ALMA_CONFIG.heroImages[0];
      hero.innerHTML = `<img src="${imgSrc(h.src)}" alt="${h.alt || "Alma's Haven Resort"}" width="1600" height="900" decoding="async" />`;
    }

    const story = document.querySelector("[data-story-image]");
    if (story && window.ALMA_CONFIG?.heroImages?.[1]) {
      const h = window.ALMA_CONFIG.heroImages[1];
      story.innerHTML = `<img src="${imgSrc(h.src)}" alt="${h.alt || "Resort"}" loading="lazy" width="800" height="600" />`;
    } else if (story) {
      const g = getItems();
      if (g[2]) {
        const h = g[2];
        story.innerHTML = `<img src="${imgSrc(h.src)}" alt="${h.alt || "Resort"}" loading="lazy" width="800" height="600" />`;
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.AlmaGallery = { open, close, renderGrid };
})();
