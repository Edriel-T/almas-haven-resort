/**
 * Public availability calendar (read-only).
 * Place <div data-public-calendar></div> on any page.
 */
(function () {
  function mount(root) {
    if (!root || !window.AlmaAvailability) return;
    const Av = window.AlmaAvailability;
    const rooms = (window.ALMA_CONFIG && window.ALMA_CONFIG.rooms) || [];
    if (!rooms.length) return;

    let viewYear = new Date().getFullYear();
    let viewMonth = new Date().getMonth();

    root.innerHTML = `
      <div class="public-cal-card">
        <div class="public-cal-toolbar">
          <label class="cal-field">
            Room
            <select id="publicRoomSelect"></select>
          </label>
          <div class="admin-cal-nav">
            <button type="button" class="btn btn-ghost btn-sm" id="publicCalPrev">‹</button>
            <strong id="publicCalLabel"></strong>
            <button type="button" class="btn btn-ghost btn-sm" id="publicCalNext">›</button>
          </div>
        </div>
        <div class="cal-legend">
          <span><i class="leg available"></i> Available</span>
          <span><i class="leg unavailable"></i> Not available</span>
        </div>
        <div class="cal-grid public-cal-grid" id="publicCalGrid"></div>
        <p class="cal-hint">
          Green days are open. To reserve, message us on Facebook with your room and dates.
        </p>
        <button type="button" class="btn btn-primary btn-block" id="publicBookBtn">
          Message to book
        </button>
      </div>
    `;

    const select = root.querySelector("#publicRoomSelect");
    rooms.forEach((r) => {
      const opt = document.createElement("option");
      opt.value = r.id;
      opt.textContent = `${r.name} · ₱${r.price.toLocaleString("en-PH")}`;
      select.appendChild(opt);
    });

    function render() {
      const roomId = select.value;
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
      ];
      root.querySelector("#publicCalLabel").textContent =
        `${monthNames[viewMonth]} ${viewYear}`;
      const weeks = Av.monthMatrix(viewYear, viewMonth);
      const today = Av.todayStr();
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
          const open = !past && Av.isDateOpen(roomId, dateStr);
          const status = past ? "past" : open ? "available" : "unavailable";
          const dayNum = Number(dateStr.slice(-2));
          html += `<span class="cal-day ${status}" title="${dateStr}">${dayNum}</span>`;
        });
        html += `</div>`;
      });
      root.querySelector("#publicCalGrid").innerHTML = html;
    }

    select.addEventListener("change", render);
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
        window.AlmaBooking.open(select.value);
      }
    });

    window.addEventListener("alma:availability-updated", render);
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
