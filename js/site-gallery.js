/**
 * Public site gallery (home + gallery.html) managed from Admin.
 * Stored in localStorage; syncs via Firestore when signed in.
 * Shape: { items: [{ id, src, alt, label }], updatedAt }
 */
(function () {
  const KEY = "almas_haven_site_gallery_v1";

  function uid() {
    return `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function defaultsFromConfig() {
    const cfg = window.ALMA_CONFIG || {};
    const list = Array.isArray(cfg.gallery) ? cfg.gallery : [];
    return list.map((item, i) => ({
      id: item.id || `default_${i}`,
      src: item.src || "",
      alt: item.alt || item.label || "Resort photo",
      label: item.label || item.alt || "Photo",
    })).filter((x) => x.src);
  }

  function loadRaw() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.items)) return data;
      if (Array.isArray(data)) return { items: data, updatedAt: "" };
      return null;
    } catch {
      return null;
    }
  }

  function load() {
    const data = loadRaw();
    // Any saved document (even empty items) means custom admin gallery
    if (data) {
      return {
        items: (data.items || [])
          .map((it) => ({
            id: it.id || uid(),
            src: String(it.src || "").trim(),
            alt: String(it.alt || it.label || "Resort photo"),
            label: String(it.label || it.alt || "Photo"),
          }))
          .filter((it) => it.src),
        updatedAt: data.updatedAt || "",
        isCustom: true,
      };
    }
    return { items: defaultsFromConfig(), updatedAt: "", isCustom: false };
  }

  function getItems() {
    return load().items;
  }

  function hasCustom() {
    return !!loadRaw();
  }

  function save(items, options) {
    const clean = (Array.isArray(items) ? items : [])
      .map((it) => ({
        id: it.id || uid(),
        src: String(it.src || "").trim(),
        alt: String(it.alt || it.label || "Resort photo"),
        label: String(it.label || it.alt || "Photo"),
      }))
      .filter((it) => it.src)
      .slice(0, 80); // hard cap for storage/cloud size

    const payload = {
      items: clean,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(KEY, JSON.stringify(payload));
    window.dispatchEvent(
      new CustomEvent("alma:site-gallery-updated", { detail: payload })
    );
    if (
      !(options && options.skipCloud) &&
      window.AlmaCloud &&
      !window.AlmaCloud.isApplyingRemote("gallery")
    ) {
      window.AlmaCloud.pushGallery(payload);
    }
    return payload;
  }

  function clear() {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new CustomEvent("alma:site-gallery-updated", { detail: null }));
    if (window.AlmaCloud && !window.AlmaCloud.isApplyingRemote("gallery")) {
      // Empty custom list means "use site defaults"
      window.AlmaCloud.pushGallery({ items: [], cleared: true, updatedAt: new Date().toISOString() });
    }
  }

  function applyRemote(data) {
    if (!data || typeof data !== "object") return;
    if (data.cleared || (Array.isArray(data.items) && data.items.length === 0 && data.cleared)) {
      localStorage.removeItem(KEY);
      window.dispatchEvent(new CustomEvent("alma:site-gallery-updated", { detail: null }));
      return;
    }
    if (!Array.isArray(data.items)) return;
    // Empty items without cleared flag still apply as empty custom gallery
    localStorage.setItem(KEY, JSON.stringify({
      items: data.items,
      updatedAt: data.updatedAt || new Date().toISOString(),
    }));
    window.dispatchEvent(new CustomEvent("alma:site-gallery-updated", { detail: data }));
  }

  window.AlmaSiteGallery = {
    KEY,
    uid,
    load,
    loadRaw,
    getItems,
    hasCustom,
    save,
    clear,
    defaultsFromConfig,
    applyRemote,
  };
})();
