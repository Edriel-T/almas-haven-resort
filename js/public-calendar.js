/**
 * Public availability calendar (read-only).
 * Guests click a date to see which room units are free or occupied
 * (no guest names — admin only).
 */
(function () {
  function formatNiceDate(iso) {
    try {
      const [y, m, d] = iso.split("-").map(Number);
      return new Date(y, m - 1, d).toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return iso;
    }
  }

  function mount(root) {
    if (!root || !window.AlmaAvailability) return;
    const Av = window.AlmaAvailability;
    const rooms = (window.ALMA_CONFIG && window.ALMA_CONFIG.rooms) || [];
    if (!rooms.length) return;

    let viewYear = new Date().getFullYear();
    let viewMonth = new Date().getMonth();
    let selectedDate = null;

    root.innerHTML = `
      <div class="public-cal-card">
        <div class="public-cal-toolbar">
          <div class="admin-cal-nav public-cal-nav">
            <button type="button" class="btn btn-ghost btn-sm" id="publicCalPrev">‹</button>
            <strong id="publicCalLabel"></strong>
            <button type="button" class="btn btn-ghost btn-sm" id="publicCalNext">›</button>
          </div>
        </div>
        <div class="cal-legend">
          <span><i class="leg available"></i> All free</span>
          <span><i class="leg partial"></i> Some free</span>
          <span><i class="leg unavailable"></i> Fully booked</span>
        </div>
        <div class="cal-grid public-cal-grid" id="publicCalGrid"></div>
        <div class="public-day-detail" id="publicDayDetail">
          <p class="cal-hint" id="publicDayHint">
            Tap a date to see which rooms are available or occupied.
          </p>
          <div id="publicDayBody" hidden></div>
        </div>
        <button type="button" class="btn btn-primary btn-block" id="publicBookBtn">
          Message to book
        </button>
      </div>
    `;

    function renderDayDetail() {
      const hint = root.querySelector("#publicDayHint");
      const body = root.querySelector("#publicDayBody");
      if (!selectedDate) {
        hint.hidden = false;
        hint.textContent = "Tap a date to see which rooms are available or occupied. Tap again to hide.";
        body.hidden = true;
        body.innerHTML = "";
        return;
      }

      const day = Av.getDayOccupancy(selectedDate);
      const breakdown = Av.getPublicDayBreakdown(selectedDate);

      hint.hidden = false;
      hint.textContent = `${formatNiceDate(selectedDate)} · ${day.free} free · ${day.occupied} occupied · tap date again to hide`;

      body.hidden = false;
      let html = "";
      let lastFloor = "";
      breakdown.forEach((r) => {
        if (r.floor !== lastFloor) {
          lastFloor = r.floor;
          html += `<h4 class="public-floor-label">${r.floor || "Rooms"}</h4>`;
        }
        const typeStatus =
          r.free === r.total
            ? "Available"
            : r.free === 0
              ? "Fully booked"
              : `${r.free} of ${r.total} available`;
        html += `<div class="public-type-block">
          <div class="public-type-head">
            <strong>${r.name}</strong>
            <span class="public-type-meta">${typeStatus} · ${r.pax} pax · ₱${Number(r.price || 0).toLocaleString("en-PH")}</span>
          </div>
          <ul class="public-unit-status">`;
        r.units.forEach((u) => {
          const label = r.total === 1 ? "Room" : u.shortLabel;
          if (u.available) {
            html += `<li class="is-free"><span class="dot"></span>${label}: <strong>Available</strong></li>`;
          } else {
            html += `<li class="is-busy"><span class="dot"></span>${label}: <strong>Occupied</strong></li>`;
          }
        });
        html += `</ul></div>`;
      });
      body.innerHTML = html;
    }

    function render() {
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
      ];
      root.querySelector("#publicCalLabel").textContent =
        `${monthNames[viewMonth]} ${viewYear}`;
      const weeks = Av.monthMatrix(viewYear, viewMonth);
      const today = Av.todayStr();

      // Drop selection if it became a past date (e.g. after midnight)
      if (selectedDate && selectedDate < today) {
        selectedDate = null;
      }

      const days = ["S", "M", "T", "W", "T", "F", "S"];
      let html = `<div class="cal-weekdays">${days.map((d) => `<span>${d}</span>`).join("")}</div>`;
      weeks.forEach((week) => {
        html += `<div class="cal-week">`;
        week.forEach((dateStr) => {
          if (!dateStr) {
            html += `<span class="cal-day empty"></span>`;
            return;
          }
          const past = dateStr < today;
          const dayNum = Number(dateStr.slice(-2));

          if (past) {
            // Past dates: visible but not clickable
            html += `<span class="cal-day past" title="Past date" aria-disabled="true">${dayNum}</span>`;
            return;
          }

          const day = Av.getDayOccupancy(dateStr);
          let status = "available";
          if (day.level === "full") status = "unavailable full";
          else if (day.level === "partial") status = "partial";
          const selected = dateStr === selectedDate ? "is-selected" : "";
          const title = selected
            ? `${dateStr} · click again to hide details`
            : `${dateStr} · ${day.free} free / ${day.occupied} occupied — click for details`;
          html += `<button type="button" class="cal-day ${status} ${selected}" data-public-date="${dateStr}" title="${title}" aria-pressed="${selected ? "true" : "false"}">${dayNum}</button>`;
        });
        html += `</div>`;
      });
      root.querySelector("#publicCalGrid").innerHTML = html;
      root.querySelectorAll("[data-public-date]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const date = btn.getAttribute("data-public-date");
          // Toggle: same date again hides details
          selectedDate = selectedDate === date ? null : date;
          render();
        });
      });
      renderDayDetail();
    }

    root.querySelector("#publicCalPrev").addEventListener("click", () => {
      viewMonth--;
      if (viewMonth < 0) {
        viewMonth = 11;
        viewYear--;
      }
      render();
    });
    root.querySelector("#publicCalNext").addEventListener("click", () => {
      viewMonth++;
      if (viewMonth > 11) {
        viewMonth = 0;
        viewYear++;
      }
      render();
    });

    root.querySelector("#publicBookBtn").addEventListener("click", () => {
      if (window.AlmaBooking) {
        // Prefer first free room type on selected date, else open default
        let roomId = "";
        if (selectedDate) {
          const bd = Av.getPublicDayBreakdown(selectedDate);
          const free = bd.find((r) => r.free > 0);
          if (free) roomId = free.roomTypeId;
        }
        window.AlmaBooking.open(roomId || undefined);
      }
    });

    window.addEventListener("alma:availability-updated", render);
    window.addEventListener("alma:room-prices-updated", render);
    try {
      const bc = new BroadcastChannel(Av.channelName);
      bc.onmessage = () => render();
    } catch {
      /* ignore */
    }
    render();
  }

  function init() {
    document.querySelectorAll("[data-public-calendar]").forEach(mount);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.AlmaPublicCalendar = { mount };
})();
