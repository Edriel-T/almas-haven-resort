/**
 * Admin-only notes per room + date (localStorage).
 * Never shown on the public calendar.
 */
(function () {
  const KEY = "almas_haven_admin_notes_v1";

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
    window.dispatchEvent(new CustomEvent("alma:admin-notes-updated"));
    if (window.AlmaCloud && !window.AlmaCloud.isApplyingRemote("notes")) {
      window.AlmaCloud.pushNotes(data);
    }
  }

  function getNote(roomId, dateStr) {
    const data = load();
    const note = data[roomId] && data[roomId][dateStr];
    return typeof note === "string" ? note : "";
  }

  function setNote(roomId, dateStr, text) {
    const data = load();
    if (!data[roomId]) data[roomId] = {};
    const clean = String(text || "").trim();
    if (!clean) {
      delete data[roomId][dateStr];
      if (!Object.keys(data[roomId]).length) delete data[roomId];
    } else {
      data[roomId][dateStr] = clean;
    }
    save(data);
  }

  function clearNote(roomId, dateStr) {
    setNote(roomId, dateStr, "");
  }

  function hasNote(roomId, dateStr) {
    return !!getNote(roomId, dateStr);
  }

  function exportJSON() {
    return JSON.stringify(load(), null, 2);
  }

  function importJSON(text) {
    const data = JSON.parse(text);
    if (typeof data !== "object" || data === null) throw new Error("Invalid data");
    save(data);
  }

  function clearAll() {
    save({});
  }

  window.AlmaAdminNotes = {
    KEY,
    load,
    save,
    getNote,
    setNote,
    clearNote,
    hasNote,
    exportJSON,
    importJSON,
    clearAll,
  };
})();
