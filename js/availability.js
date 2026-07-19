/**
 * Room availability by date (per room type).
 * Status: available (default) | booked | blocked | pending
 * Editable from admin panel; read by booking calendar.
 */
(function () {
  const KEY = "almas_haven_availability_v1";
  const channelName = "almas-haven-availability";

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
    try {
      const bc = new BroadcastChannel(channelName);
      bc.postMessage({ type: "availability-updated" });
      bc.close();
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new CustomEvent("alma:availability-updated"));
  }

  function getStatus(roomId, dateStr) {
    const data = load();
    return (data[roomId] && data[roomId][dateStr]) || "available";
  }

  function setStatus(roomId, dateStr, status) {
    const data = load();
    if (!data[roomId]) data[roomId] = {};
    if (status === "available") {
      delete data[roomId][dateStr];
      if (!Object.keys(data[roomId]).length) delete data[roomId];
    } else {
      data[roomId][dateStr] = status;
    }
    save(data);
  }

  function setRange(roomId, startStr, endStr, status, options) {
    const exclusiveEnd = options && options.exclusiveEnd;
    const dates = datesBetween(startStr, endStr, exclusiveEnd);
    dates.forEach((d) => setStatus(roomId, d, status));
  }

  function isDateOpen(roomId, dateStr) {
    const s = getStatus(roomId, dateStr);
    return s === "available" || s === "pending";
  }

  /** Nights: check-in inclusive, check-out exclusive (hotel style) */
  function isRangeOpen(roomId, checkin, checkout) {
    if (!checkin || !checkout || checkout <= checkin) return false;
    const nights = datesBetween(checkin, checkout, true);
    return nights.every((d) => isDateOpen(roomId, d));
  }

  function getRangeConflicts(roomId, checkin, checkout) {
    if (!checkin || !checkout || checkout <= checkin) return [];
    return datesBetween(checkin, checkout, true).filter((d) => !isDateOpen(roomId, d));
  }

  function datesBetween(startStr, endStr, exclusiveEnd) {
    const out = [];
    const cur = parseYMD(startStr);
    const end = parseYMD(endStr);
    if (!cur || !end) return out;
    while (exclusiveEnd ? cur < end : cur <= end) {
      out.push(formatYMD(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }

  function parseYMD(s) {
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function formatYMD(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function todayStr() {
    return formatYMD(new Date());
  }

  function monthMatrix(year, monthIndex) {
    // monthIndex 0-11; returns weeks of date strings or null for padding
    const first = new Date(year, monthIndex, 1);
    const startPad = first.getDay(); // 0 Sun
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(formatYMD(new Date(year, monthIndex, d)));
    }
    while (cells.length % 7 !== 0) cells.push(null);
    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  }

  function markPendingFromBooking(roomId, checkin, checkout) {
    if (!roomId || !checkin || !checkout) return;
    const nights = datesBetween(checkin, checkout, true);
    nights.forEach((d) => {
      if (getStatus(roomId, d) === "available") setStatus(roomId, d, "pending");
    });
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

  window.AlmaAvailability = {
    KEY,
    channelName,
    load,
    save,
    getStatus,
    setStatus,
    setRange,
    isDateOpen,
    isRangeOpen,
    getRangeConflicts,
    datesBetween,
    parseYMD,
    formatYMD,
    todayStr,
    monthMatrix,
    markPendingFromBooking,
    exportJSON,
    importJSON,
    clearAll,
  };
})();
