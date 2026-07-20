/**
 * Room price overrides (Admin → localStorage).
 * Applied onto ALMA_CONFIG.rooms so the rest of the site reads the live price.
 */
(function () {
  const KEY = "almas_haven_room_prices_v1";

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
    applyToConfig();
    window.dispatchEvent(new CustomEvent("alma:room-prices-updated"));
    if (window.AlmaCloud && !window.AlmaCloud.isApplyingRemote("prices")) {
      window.AlmaCloud.pushPrices(data);
    }
  }

  function getDefaultPrice(roomId) {
    const rooms = (window.ALMA_CONFIG && window.ALMA_CONFIG.rooms) || [];
    const r = rooms.find((x) => x.id === roomId);
    if (!r) return null;
    if (typeof r._defaultPrice === "number") return r._defaultPrice;
    return typeof r.price === "number" ? r.price : null;
  }

  function getPrice(roomId) {
    const data = load();
    if (data[roomId] != null && data[roomId] !== "") {
      const n = Number(data[roomId]);
      if (Number.isFinite(n) && n >= 0) return Math.round(n);
    }
    return getDefaultPrice(roomId);
  }

  function setPrice(roomId, price) {
    const data = load();
    const n = Number(price);
    if (!Number.isFinite(n) || n < 0) {
      delete data[roomId];
    } else {
      data[roomId] = Math.round(n);
    }
    save(data);
  }

  function setMany(map) {
    const data = load();
    Object.keys(map || {}).forEach((id) => {
      const n = Number(map[id]);
      if (!Number.isFinite(n) || n < 0) delete data[id];
      else data[id] = Math.round(n);
    });
    save(data);
  }

  function clearRoom(roomId) {
    const data = load();
    delete data[roomId];
    save(data);
  }

  function clearAll() {
    save({});
  }

  function hasOverride(roomId) {
    const data = load();
    return data[roomId] != null && data[roomId] !== "";
  }

  /** Stamp defaults once, then apply overrides to room.price */
  function applyToConfig() {
    const rooms = (window.ALMA_CONFIG && window.ALMA_CONFIG.rooms) || [];
    const data = load();
    rooms.forEach((r) => {
      if (typeof r._defaultPrice !== "number" && typeof r.price === "number") {
        r._defaultPrice = r.price;
      }
      const base = typeof r._defaultPrice === "number" ? r._defaultPrice : r.price;
      if (data[r.id] != null && data[r.id] !== "") {
        const n = Number(data[r.id]);
        if (Number.isFinite(n) && n >= 0) r.price = Math.round(n);
        else r.price = base;
      } else {
        r.price = base;
      }
    });
  }

  // Apply as soon as this file loads (after rooms-config.js)
  applyToConfig();

  window.AlmaRoomPrices = {
    KEY,
    load,
    save,
    getPrice,
    getDefaultPrice,
    setPrice,
    setMany,
    clearRoom,
    clearAll,
    hasOverride,
    applyToConfig,
  };
})();
