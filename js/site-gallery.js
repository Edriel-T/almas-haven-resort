/**
 * Public site gallery (home + gallery.html) managed from Admin.
 * Stored in localStorage; syncs via Firestore when signed in.
 * Shape: { items: [{ id, src, alt, label }], updatedAt }
 *
 * Empty custom galleries always fall back to website defaults so
 * guests never see a blank gallery by accident.
 */
(function () {
  const KEY = "almas_haven_site_gallery_v1";

  function uid() {
    return `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function defaultsFromConfig() {
    const cfg = window.ALMA_CONFIG || {};
    const list = Array.isArray(cfg.gallery) ? cfg.gallery : [];
    return list
      .map((item, i) => ({
        id: item.id || `default_${i}`,
        src: item.src || "",
        alt: item.alt || item.label || "Resort photo",
        label: item.label || item.alt || "Photo",
      }))
      .filter((x) => x.src);
  }

  function normalizeItems(list) {
    return (Array.isArray(list) ? list : [])
      .map((it) => ({
        id: it.id || uid(),
        src: String(it.src || "").trim(),
        alt: String(it.alt || it.label || "Resort photo"),
        label: String(it.label || it.alt || "Photo"),
      }))
      .filter((it) => it.src);
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

  /**
   * Remove corrupt/empty custom saves so defaults show again.
   */
  function healEmptyCustom() {
    const data = loadRaw();
    if (!data) return false;
    const items = normalizeItems(data.items);
    if (items.length) return false;
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    return true;
  }

  function load() {
    // Drop accidental empty custom galleries
    healEmptyCustom();

    const data = loadRaw();
    if (data) {
      const items = normalizeItems(data.items);
      if (items.length) {
        return {
          items,
          updatedAt: data.updatedAt || "",
          isCustom: true,
        };
      }
    }
    return { items: defaultsFromConfig(), updatedAt: "", isCustom: false };
  }

  function getItems() {
    const items = load().items;
    // Absolute safety: never return empty if defaults exist
    if (items && items.length) return items;
    return defaultsFromConfig();
  }

  function hasCustom() {
    healEmptyCustom();
    const data = loadRaw();
    if (!data) return false;
    return normalizeItems(data.items).length > 0;
  }

  function save(items, options) {
    const clean = normalizeItems(items).slice(0, 80);

    // Saving nothing → treat as reset to defaults (never store blank gallery)
    if (!clean.length) {
      clear(options);
      return { items: defaultsFromConfig(), updatedAt: new Date().toISOString(), cleared: true };
    }

    const payload = {
      items: clean,
      updatedAt: new Date().toISOString(),
      cleared: false,
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

  function clear(options) {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    const payload = {
      items: [],
      cleared: true,
      updatedAt: new Date().toISOString(),
    };
    window.dispatchEvent(
      new CustomEvent("alma:site-gallery-updated", { detail: null })
    );
    if (
      !(options && options.skipCloud) &&
      window.AlmaCloud &&
      !window.AlmaCloud.isApplyingRemote("gallery")
    ) {
      window.AlmaCloud.pushGallery(payload);
    }
  }

  function applyRemote(data) {
    if (!data || typeof data !== "object") return;

    // Cleared or empty cloud gallery → use website defaults
    if (data.cleared === true) {
      try {
        localStorage.removeItem(KEY);
      } catch {
        /* ignore */
      }
      window.dispatchEvent(
        new CustomEvent("alma:site-gallery-updated", { detail: null })
      );
      return;
    }

    if (!Array.isArray(data.items)) return;

    const items = normalizeItems(data.items);
    // Empty custom list from cloud is treated as defaults (not a blank site)
    if (!items.length) {
      try {
        localStorage.removeItem(KEY);
      } catch {
        /* ignore */
      }
      window.dispatchEvent(
        new CustomEvent("alma:site-gallery-updated", { detail: null })
      );
      return;
    }

    const payload = {
      items,
      updatedAt: data.updatedAt || new Date().toISOString(),
      cleared: false,
    };
    localStorage.setItem(KEY, JSON.stringify(payload));
    window.dispatchEvent(
      new CustomEvent("alma:site-gallery-updated", { detail: payload })
    );
  }

  // Heal on boot (fixes empty gallery after bad save / empty cloud doc)
  try {
    if (healEmptyCustom()) {
      window.dispatchEvent(
        new CustomEvent("alma:site-gallery-updated", { detail: null })
      );
    }
  } catch {
    /* ignore */
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
