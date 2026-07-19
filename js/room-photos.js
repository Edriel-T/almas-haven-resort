/**
 * Extra room photos managed in Admin (localStorage).
 * Merged with default images from rooms-config.js
 */
(function () {
  const KEY = "almas_haven_room_photos_v1";

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
    window.dispatchEvent(new CustomEvent("alma:room-photos-updated"));
  }

  function getOverrides(roomId) {
    const data = load();
    return Array.isArray(data[roomId]) ? data[roomId].filter(Boolean) : [];
  }

  function setOverrides(roomId, paths) {
    const data = load();
    const clean = (paths || []).map((p) => String(p).trim()).filter(Boolean);
    if (!clean.length) delete data[roomId];
    else data[roomId] = clean;
    save(data);
  }

  function roomDefaults(roomId) {
    const rooms = (window.ALMA_CONFIG && window.ALMA_CONFIG.rooms) || [];
    const r = rooms.find((x) => x.id === roomId);
    if (!r) return [];
    if (Array.isArray(r.images) && r.images.length) return r.images.slice();
    if (r.image) return [r.image];
    return [];
  }

  /** Admin overrides replace defaults when set; otherwise defaults */
  function getImages(roomId) {
    const over = getOverrides(roomId);
    if (over.length) return over;
    return roomDefaults(roomId);
  }

  function getCover(roomId) {
    const imgs = getImages(roomId);
    return imgs[0] || "";
  }

  function clearRoom(roomId) {
    const data = load();
    delete data[roomId];
    save(data);
  }

  window.AlmaRoomPhotos = {
    KEY,
    load,
    save,
    getOverrides,
    setOverrides,
    getImages,
    getCover,
    roomDefaults,
    clearRoom,
  };
})();
