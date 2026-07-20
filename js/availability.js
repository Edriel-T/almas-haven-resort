/**
 * Room occupancy by unit + stay (guest, check-in, check-out).
 * Admin manages stays; public calendar shows free/busy without guest names.
 *
 * A unit is occupied on date D when checkin <= D < checkout (hotel-style).
 */
(function () {
  const KEY = "almas_haven_stays_v1";
  const LEGACY_KEY = "almas_haven_availability_v1";
  const channelName = "almas-haven-availability";

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && Array.isArray(data.stays)) return data;
      }
    } catch {
      /* ignore */
    }
    return { stays: [] };
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
    // Sync to Firebase so all devices/guests see the same occupancy
    if (window.AlmaCloud && !window.AlmaCloud.isApplyingRemote("stays")) {
      window.AlmaCloud.pushStays(data);
    }
  }

  function rooms() {
    return (window.ALMA_CONFIG && window.ALMA_CONFIG.rooms) || [];
  }

  function roomById(id) {
    return rooms().find((r) => r.id === id) || null;
  }

  /** Expand room types into numbered units (Room 1, Room 2, …) */
  function getAllUnits() {
    const out = [];
    rooms().forEach((r) => {
      const n = Math.max(1, Number(r.count) || 1);
      for (let u = 1; u <= n; u++) {
        out.push({
          roomTypeId: r.id,
          unit: u,
          unitKey: `${r.id}#${u}`,
          floor: r.floor || "",
          name: r.name || r.id,
          pax: r.pax,
          price: r.price,
          label: n === 1 ? r.name : `${r.name} · Room ${u}`,
          shortLabel: n === 1 ? "Room 1" : `Room ${u}`,
          count: n,
        });
      }
    });
    return out;
  }

  function getUnitsForType(roomTypeId) {
    return getAllUnits().filter((u) => u.roomTypeId === roomTypeId);
  }

  function listStays() {
    return load().stays.slice();
  }

  function getStay(id) {
    return load().stays.find((s) => s.id === id) || null;
  }

  function uid() {
    return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
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

  /** Stay covers night of dateStr if checkin <= dateStr < checkout */
  function stayCoversDate(stay, dateStr) {
    if (!stay || !dateStr) return false;
    return stay.checkin <= dateStr && dateStr < stay.checkout;
  }

  function staysOverlap(a, b) {
    // ranges [checkin, checkout) overlap
    return a.checkin < b.checkout && b.checkin < a.checkout;
  }

  function findStayForUnitOnDate(roomTypeId, unit, dateStr) {
    return (
      load().stays.find(
        (s) =>
          s.roomTypeId === roomTypeId &&
          Number(s.unit) === Number(unit) &&
          stayCoversDate(s, dateStr)
      ) || null
    );
  }

  function unitConflicts(roomTypeId, unit, checkin, checkout, excludeId) {
    return load().stays.filter((s) => {
      if (excludeId && s.id === excludeId) return false;
      if (s.roomTypeId !== roomTypeId || Number(s.unit) !== Number(unit)) return false;
      return staysOverlap(s, { checkin, checkout });
    });
  }

  function addStay({ roomTypeId, unit, guestName, checkin, checkout, adminNote }) {
    const name = String(guestName || "").trim();
    if (!roomTypeId || !unit || !name || !checkin || !checkout) {
      throw new Error("Missing required stay fields");
    }
    if (checkout <= checkin) throw new Error("Check-out must be after check-in");
    const conflicts = unitConflicts(roomTypeId, unit, checkin, checkout);
    if (conflicts.length) throw new Error("That room is already booked for overlapping dates");

    const data = load();
    const stay = {
      id: uid(),
      roomTypeId,
      unit: Number(unit),
      guestName: name,
      checkin,
      checkout,
      adminNote: String(adminNote || "").trim(),
      createdAt: new Date().toISOString(),
    };
    data.stays.push(stay);
    save(data);
    return stay;
  }

  function updateStay(id, patch) {
    const data = load();
    const i = data.stays.findIndex((s) => s.id === id);
    if (i < 0) throw new Error("Stay not found");
    const next = { ...data.stays[i], ...patch };
    next.guestName = String(next.guestName || "").trim();
    next.adminNote = String(next.adminNote || "").trim();
    next.unit = Number(next.unit);
    if (!next.guestName) throw new Error("Guest name required");
    if (!next.checkin || !next.checkout || next.checkout <= next.checkin) {
      throw new Error("Invalid dates");
    }
    const conflicts = unitConflicts(next.roomTypeId, next.unit, next.checkin, next.checkout, id);
    if (conflicts.length) throw new Error("That room is already booked for overlapping dates");
    data.stays[i] = next;
    save(data);
    return next;
  }

  function removeStay(id) {
    const data = load();
    data.stays = data.stays.filter((s) => s.id !== id);
    save(data);
  }

  /**
   * Full occupancy snapshot for one calendar date (all units).
   * Public-safe fields omit nothing sensitive except we flag admin-only guestName.
   */
  function getDayOccupancy(dateStr) {
    const units = getAllUnits();
    const rows = units.map((u) => {
      const stay = findStayForUnitOnDate(u.roomTypeId, u.unit, dateStr);
      return {
        ...u,
        occupied: !!stay,
        stay: stay
          ? {
              id: stay.id,
              guestName: stay.guestName,
              checkin: stay.checkin,
              checkout: stay.checkout,
              adminNote: stay.adminNote || "",
            }
          : null,
      };
    });
    const occupied = rows.filter((r) => r.occupied).length;
    const free = rows.length - occupied;
    let level = "available";
    if (occupied === 0) level = "available";
    else if (free === 0) level = "full";
    else level = "partial";
    return { date: dateStr, rows, total: rows.length, free, occupied, level };
  }

  /** Summary for room type on a date (any unit free?) */
  function typeSummaryOnDate(roomTypeId, dateStr) {
    const units = getUnitsForType(roomTypeId);
    let free = 0;
    let occupied = 0;
    units.forEach((u) => {
      if (findStayForUnitOnDate(roomTypeId, u.unit, dateStr)) occupied++;
      else free++;
    });
    return {
      free,
      occupied,
      total: units.length,
      open: free > 0,
      level: occupied === 0 ? "available" : free === 0 ? "full" : "partial",
    };
  }

  /** Public: group by room type for a date */
  function getPublicDayBreakdown(dateStr) {
    return rooms().map((r) => {
      const sum = typeSummaryOnDate(r.id, dateStr);
      const unitRows = getUnitsForType(r.id).map((u) => {
        const stay = findStayForUnitOnDate(r.id, u.unit, dateStr);
        return {
          unit: u.unit,
          shortLabel: u.shortLabel,
          available: !stay,
        };
      });
      return {
        roomTypeId: r.id,
        floor: r.floor,
        name: r.name,
        pax: r.pax,
        price: r.price,
        ...sum,
        units: unitRows,
      };
    });
  }

  // ---- Compatibility with older calendar API ----

  function getStatus(roomTypeId, dateStr) {
    const sum = typeSummaryOnDate(roomTypeId, dateStr);
    return sum.open ? "available" : "blocked";
  }

  function setStatus() {
    /* deprecated — use addStay / removeStay */
  }

  function isDateOpen(roomTypeId, dateStr) {
    return typeSummaryOnDate(roomTypeId, dateStr).open;
  }

  function isRangeOpen(roomTypeId, checkin, checkout) {
    if (!checkin || !checkout || checkout <= checkin) return false;
    const nights = datesBetween(checkin, checkout, true);
    return nights.every((d) => isDateOpen(roomTypeId, d));
  }

  function getRangeConflicts(roomTypeId, checkin, checkout) {
    if (!checkin || !checkout || checkout <= checkin) return [];
    return datesBetween(checkin, checkout, true).filter((d) => !isDateOpen(roomTypeId, d));
  }

  function monthMatrix(year, monthIndex) {
    const first = new Date(year, monthIndex, 1);
    const startPad = first.getDay();
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

  function dayLevel(dateStr) {
    return getDayOccupancy(dateStr).level;
  }

  function exportJSON() {
    return JSON.stringify(load(), null, 2);
  }

  function importJSON(text) {
    const data = JSON.parse(text);
    if (!data || typeof data !== "object") throw new Error("Invalid data");
    if (Array.isArray(data.stays)) {
      save({ stays: data.stays });
      return;
    }
    // legacy map format ignored for stays
    throw new Error("Expected { stays: [...] }");
  }

  function clearAll() {
    save({ stays: [] });
  }

  function markPendingFromBooking() {
    /* no-op: staff assigns real stays in admin */
  }

  window.AlmaAvailability = {
    KEY,
    LEGACY_KEY,
    channelName,
    load,
    save,
    rooms,
    roomById,
    getAllUnits,
    getUnitsForType,
    listStays,
    getStay,
    addStay,
    updateStay,
    removeStay,
    stayCoversDate,
    findStayForUnitOnDate,
    getDayOccupancy,
    getPublicDayBreakdown,
    typeSummaryOnDate,
    dayLevel,
    getStatus,
    setStatus,
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
