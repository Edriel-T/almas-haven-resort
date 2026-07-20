/**
 * Admin: password gate, availability calendar, room photos, inbox
 */
(function () {
  const SESSION_KEY = "almas_haven_admin_session";
  const toastEl = document.getElementById("toast");
  let toastTimer;

  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toastEl.hidden = true), 3500);
  }

  function expectedPassword() {
    return (window.ALMA_CONFIG && window.ALMA_CONFIG.adminPassword) || "almasadmin";
  }

  function isLoggedIn() {
    try {
      return sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {
      return false;
    }
  }

  function setLoggedIn(on) {
    try {
      if (on) sessionStorage.setItem(SESSION_KEY, "1");
      else sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }

  function showApp(show) {
    const login = document.getElementById("adminLogin");
    const app = document.getElementById("adminApp");
    if (login) login.hidden = !!show;
    if (app) app.hidden = !show;
  }

  /* ---- Login ---- */
  document.getElementById("adminLoginForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("adminPasswordInput");
    const err = document.getElementById("adminLoginError");
    if (input.value === expectedPassword()) {
      setLoggedIn(true);
      err.hidden = true;
      showApp(true);
      initAdminApp();
      toast("Signed in");
    } else {
      err.hidden = false;
      input.focus();
    }
  });

  document.getElementById("adminLogout")?.addEventListener("click", () => {
    if (window.AlmaLiveAgent) window.AlmaLiveAgent.goOffline();
    setLoggedIn(false);
    showApp(false);
    document.getElementById("adminPasswordInput").value = "";
    toast("Logged out");
  });

  let appReady = false;

  function initAdminApp() {
    if (appReady) return;
    appReady = true;
    initTabs();
    initLiveAgentDesk();
    initAvailability();
    initPrices();
    initPhotos();
    initInbox();
  }

  /* ---- Live agent desk ---- */
  let activeLiveChatId = null;
  let agentHbTimer = null;

  function initLiveAgentDesk() {
    const Live = window.AlmaLiveAgent;
    if (!Live) return;

    const toggle = document.getElementById("agentOnlineToggle");
    const label = document.getElementById("agentOnlineLabel");

    function syncToggleUI() {
      const on = Live.isAgentOnline();
      if (toggle) toggle.checked = on;
      if (label) label.textContent = on ? "● You are online" : "Go online as agent";
    }

    function startHeartbeat() {
      stopHeartbeat();
      agentHbTimer = setInterval(() => Live.heartbeat(), Live.HEARTBEAT_MS);
    }

    function stopHeartbeat() {
      if (agentHbTimer) {
        clearInterval(agentHbTimer);
        agentHbTimer = null;
      }
    }

    toggle?.addEventListener("change", () => {
      if (toggle.checked) {
        Live.goOnline("Alma's Haven agent");
        startHeartbeat();
        toast("You are online — guests can chat on the website");
      } else {
        Live.goOffline();
        stopHeartbeat();
        toast("You are offline — guests will use Facebook");
      }
      syncToggleUI();
    });

    // Resume online if presence already active
    if (Live.isAgentOnline()) {
      toggle.checked = true;
      Live.heartbeat();
      startHeartbeat();
    }
    syncToggleUI();

    document.getElementById("liveChatForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!activeLiveChatId) return;
      const chat = Live.getChat(activeLiveChatId);
      if (chat && chat.status === "queued") {
        toast("Accept this guest from the queue first");
        return;
      }
      const input = document.getElementById("liveChatInput");
      const text = input.value.trim();
      if (!text) return;
      Live.addMessage(activeLiveChatId, "agent", text);
      input.value = "";
      renderLiveThread(activeLiveChatId);
      renderLiveList();
    });

    document.getElementById("liveChatAccept")?.addEventListener("click", () => {
      if (!activeLiveChatId) return;
      Live.acceptChat(activeLiveChatId);
      renderLiveList();
      renderLiveThread(activeLiveChatId);
      toast("Guest accepted — you can chat now");
    });

    document.getElementById("liveChatEnd")?.addEventListener("click", () => {
      if (!activeLiveChatId) return;
      if (!confirm("End this live chat? The next person in queue will be connected.")) return;
      Live.closeChat(activeLiveChatId);
      activeLiveChatId = null;
      renderLiveList();
      renderLiveThread(null);
      toast("Chat ended · next in queue promoted if any");
    });

    // Template chips (label on button, full formatted text sent)
    const tplBox = document.getElementById("liveChatTemplates");
    if (tplBox && Live.AGENT_TEMPLATES) {
      tplBox.innerHTML =
        '<p class="live-templates-label">Ready messages</p>' +
        Live.AGENT_TEMPLATES.map((t, i) => {
          const label = t.label || `Message ${i + 1}`;
          return `<button type="button" class="live-template-btn" data-tpl="${i}" title="${escapeHtmlAdmin(Live.getTemplateText(t).slice(0, 120))}">${escapeHtmlAdmin(label)}</button>`;
        }).join("");
      tplBox.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-tpl]");
        if (!btn || !activeLiveChatId) return;
        const item = Live.AGENT_TEMPLATES[Number(btn.getAttribute("data-tpl"))];
        const text = Live.getTemplateText(item);
        if (!text) return;
        const chat = Live.getChat(activeLiveChatId);
        if (chat?.status === "queued") {
          Live.acceptChat(activeLiveChatId);
        }
        Live.addMessage(activeLiveChatId, "agent", text);
        renderLiveThread(activeLiveChatId);
        renderLiveList();
      });
    }

    window.addEventListener("alma:live-agent", () => {
      renderLiveList();
      if (activeLiveChatId) renderLiveThread(activeLiveChatId);
      syncToggleUI();
    });

    setInterval(() => {
      if (toggle?.checked) Live.heartbeat();
      renderLiveList();
      if (activeLiveChatId) renderLiveThread(activeLiveChatId);
    }, 3000);

    renderLiveList();
  }

  function renderLiveList() {
    const Live = window.AlmaLiveAgent;
    const list = document.getElementById("liveChatList");
    if (!Live || !list) return;
    const chats = Live.listOpenChats();
    const tab = document.getElementById("tabLive");
    const q = Live.listQueued().length;
    const a = Live.listActive().length;
    if (tab) {
      tab.textContent = chats.length ? `(${a} live · ${q} queue)` : "";
    }

    if (!chats.length) {
      list.innerHTML =
        '<p class="lp-note" style="padding:1rem">No website chats. Go online, then guests will share their name and what they need before joining.</p>';
      return;
    }

    list.innerHTML = chats
      .map((c) => {
        const pos = c.status === "queued" ? Live.queuePosition(c.id) : 0;
        const badge =
          c.status === "active"
            ? '<em class="live-badge live-badge--active">Active</em>'
            : `<em class="live-badge live-badge--queue">Queue #${pos}</em>`;
        const need = c.need ? c.need.slice(0, 40) : "—";
        return `
        <button type="button" class="live-chat-item ${c.id === activeLiveChatId ? "is-active" : ""}" data-live-id="${c.id}">
          <strong>${escapeHtmlAdmin(c.guestName || "Guest")} ${badge}</strong>
          <span>${escapeHtmlAdmin(need)}</span>
        </button>`;
      })
      .join("");

    list.querySelectorAll("[data-live-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeLiveChatId = btn.getAttribute("data-live-id");
        renderLiveList();
        renderLiveThread(activeLiveChatId);
      });
    });
  }

  function renderLiveThread(chatId) {
    const Live = window.AlmaLiveAgent;
    const head = document.getElementById("liveChatHead");
    const needEl = document.getElementById("liveChatNeed");
    const box = document.getElementById("liveChatMessages");
    const form = document.getElementById("liveChatForm");
    const acceptBtn = document.getElementById("liveChatAccept");
    const tplBox = document.getElementById("liveChatTemplates");
    if (!Live || !box) return;

    if (!chatId) {
      head.textContent = "Select a conversation";
      if (needEl) {
        needEl.hidden = true;
        needEl.textContent = "";
      }
      box.innerHTML = "";
      form.hidden = true;
      if (tplBox) tplBox.hidden = true;
      return;
    }

    const chat = Live.getChat(chatId);
    if (!chat) {
      head.textContent = "Conversation not found";
      box.innerHTML = "";
      form.hidden = true;
      if (tplBox) tplBox.hidden = true;
      return;
    }

    const statusLabel =
      chat.status === "queued"
        ? `Queue #${Live.queuePosition(chat.id)}`
        : chat.status === "active"
          ? "Active"
          : chat.status;
    head.textContent = `${chat.guestName || "Guest"} · ${statusLabel}`;
    if (needEl) {
      needEl.hidden = !chat.need;
      needEl.textContent = chat.need ? `Need: ${chat.need}` : "";
    }
    form.hidden = chat.status === "closed";
    if (acceptBtn) {
      acceptBtn.hidden = chat.status !== "queued";
    }
    if (tplBox) {
      tplBox.hidden = chat.status === "closed";
    }

    box.innerHTML = (chat.messages || [])
      .map((m) => {
        const cls =
          m.from === "guest" ? "live-msg guest" : m.from === "agent" ? "live-msg agent" : "live-msg system";
        return `<div class="${cls}"><span class="live-msg-meta">${m.from}</span>${escapeHtmlAdmin(m.text)}</div>`;
      })
      .join("");
    box.scrollTop = box.scrollHeight;
  }

  function escapeHtmlAdmin(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function initTabs() {
    document.querySelectorAll(".admin-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".admin-tab").forEach((t) => {
          t.classList.remove("active");
          t.setAttribute("aria-selected", "false");
        });
        tab.classList.add("active");
        tab.setAttribute("aria-selected", "true");
        const id = tab.getAttribute("data-tab");
        const panels = ["live", "availability", "prices", "photos", "inbox"];
        panels.forEach((p) => {
          const el = document.getElementById(`panel-${p}`);
          if (el) el.hidden = p !== id;
        });
        if (id === "photos") loadPhotoEditor();
        if (id === "prices") renderPriceList();
        if (id === "live") renderLiveList();
      });
    });
  }

  function imgSrcAdmin(path) {
    if (!path) return "";
    if (path.startsWith("data:") || path.startsWith("blob:") || path.startsWith("http")) return path;
    return path
      .split("/")
      .map((part, i) => (i === 0 ? part : encodeURIComponent(part)))
      .join("/");
  }

  /* ---- Availability: all units per date + guest stays ---- */
  const DAY_NOTE_KEY = "__day__";

  function initAvailability() {
    const Av = window.AlmaAvailability;
    const Notes = window.AlmaAdminNotes;
    const calLabel = document.getElementById("adminCalLabel");
    const calGrid = document.getElementById("adminCalGrid");
    if (!Av || !calGrid) return;

    let viewYear = new Date().getFullYear();
    let viewMonth = new Date().getMonth();
    let selectedDate = null;

    function formatNiceDate(iso) {
      try {
        const [y, m, d] = iso.split("-").map(Number);
        return new Date(y, m - 1, d).toLocaleDateString(undefined, {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      } catch {
        return iso;
      }
    }

    function formatShort(iso) {
      try {
        const [y, m, d] = iso.split("-").map(Number);
        return new Date(y, m - 1, d).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      } catch {
        return iso;
      }
    }

    function hideAssignBox() {
      const box = document.getElementById("adminAssignBox");
      if (box) box.hidden = true;
      const form = document.getElementById("adminAssignForm");
      if (form) form.reset();
      document.getElementById("assignStayId").value = "";
      document.getElementById("assignRemove").hidden = true;
    }

    function openAssign({ roomTypeId, unit, stay, label }) {
      const box = document.getElementById("adminAssignBox");
      box.hidden = false;
      document.getElementById("adminAssignTitle").textContent = stay
        ? `Edit stay · ${label}`
        : `Assign guest · ${label}`;
      document.getElementById("assignRoomType").value = roomTypeId;
      document.getElementById("assignUnit").value = String(unit);
      document.getElementById("assignStayId").value = stay ? stay.id : "";
      document.getElementById("assignGuest").value = stay ? stay.guestName : "";
      document.getElementById("assignCheckin").value = stay ? stay.checkin : selectedDate || "";
      // default 1 night if new
      let checkout = stay ? stay.checkout : "";
      if (!checkout && selectedDate) {
        const d = Av.parseYMD(selectedDate);
        d.setDate(d.getDate() + 1);
        checkout = Av.formatYMD(d);
      }
      document.getElementById("assignCheckout").value = checkout;
      document.getElementById("assignNote").value = stay ? stay.adminNote || "" : "";
      document.getElementById("assignRemove").hidden = !stay;
      document.getElementById("assignGuest").focus();
      box.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function renderUnitList() {
      const list = document.getElementById("adminUnitList");
      if (!list || !selectedDate) return;
      const day = Av.getDayOccupancy(selectedDate);
      let lastFloor = "";
      let html = "";
      day.rows.forEach((row) => {
        if (row.floor !== lastFloor) {
          lastFloor = row.floor;
          html += `<h4 class="admin-unit-floor">${escapeHtmlAdmin(row.floor || "Rooms")}</h4>`;
        }
        if (row.occupied && row.stay) {
          html += `
            <article class="admin-unit-card is-occupied">
              <div class="admin-unit-card__main">
                <strong>${escapeHtmlAdmin(row.label)}</strong>
                <span class="admin-unit-badge occupied">Occupied</span>
                <p class="admin-unit-guest"><strong>Guest:</strong> ${escapeHtmlAdmin(row.stay.guestName)}</p>
                <p class="admin-unit-dates">
                  <strong>Check-in:</strong> ${escapeHtmlAdmin(formatShort(row.stay.checkin))}
                  · <strong>Check-out:</strong> ${escapeHtmlAdmin(formatShort(row.stay.checkout))}
                </p>
                ${row.stay.adminNote ? `<p class="lp-note">${escapeHtmlAdmin(row.stay.adminNote)}</p>` : ""}
              </div>
              <button type="button" class="btn btn-ghost btn-sm" data-edit-stay="${row.stay.id}"
                data-room="${row.roomTypeId}" data-unit="${row.unit}" data-label="${escapeHtmlAdmin(row.label)}">Edit</button>
            </article>`;
        } else {
          html += `
            <article class="admin-unit-card is-free">
              <div class="admin-unit-card__main">
                <strong>${escapeHtmlAdmin(row.label)}</strong>
                <span class="admin-unit-badge free">Available</span>
                <p class="lp-note">Up to ${row.pax} pax · ₱${Number(row.price || 0).toLocaleString("en-PH")}/night</p>
              </div>
              <button type="button" class="btn btn-primary btn-sm" data-assign-unit
                data-room="${row.roomTypeId}" data-unit="${row.unit}" data-label="${escapeHtmlAdmin(row.label)}">Assign guest</button>
            </article>`;
        }
      });
      list.innerHTML = html || '<p class="lp-note">No rooms configured.</p>';
    }

    function updateDayPanel() {
      const title = document.getElementById("adminDayTitle");
      const sub = document.getElementById("adminDaySub");
      const controls = document.getElementById("adminDayControls");
      const statusEl = document.getElementById("adminDayStatus");
      const noteEl = document.getElementById("adminDayNote");

      if (!selectedDate) {
        title.textContent = "Select a date";
        sub.textContent = "Click a day to view room occupancy.";
        controls.hidden = true;
        hideAssignBox();
        return;
      }

      const day = Av.getDayOccupancy(selectedDate);
      const note = Notes ? Notes.getNote(DAY_NOTE_KEY, selectedDate) : "";
      title.textContent = formatNiceDate(selectedDate);
      sub.textContent = `${day.free} free · ${day.occupied} occupied · ${day.total} total units`;
      controls.hidden = false;

      let pill = "is-open";
      let label = "All rooms free";
      if (day.level === "partial") {
        pill = "is-partial";
        label = "Some rooms occupied";
      } else if (day.level === "full") {
        pill = "is-closed";
        label = "Fully booked";
      }
      statusEl.innerHTML = `<span class="admin-status-pill ${pill}">${label}</span>`;
      noteEl.value = note;
      hideAssignBox();
      renderUnitList();
    }

    function onDayClick(dateStr) {
      selectedDate = dateStr;
      renderAdminCal();
    }

    function renderAdminCal() {
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
      ];
      calLabel.textContent = `${monthNames[viewMonth]} ${viewYear}`;
      const weeks = Av.monthMatrix(viewYear, viewMonth);
      const today = Av.todayStr();
      const days = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
      let html = `<div class="cal-weekdays">${days.map((d) => `<span>${d}</span>`).join("")}</div>`;
      weeks.forEach((week) => {
        html += `<div class="cal-week">`;
        week.forEach((dateStr) => {
          if (!dateStr) {
            html += `<button type="button" class="cal-day empty" disabled></button>`;
            return;
          }
          const day = Av.getDayOccupancy(dateStr);
          const past = dateStr < today;
          const dayNum = Number(dateStr.slice(-2));
          const levelClass =
            day.level === "full" ? "unavailable full" : day.level === "partial" ? "partial" : "available";
          const hasNote = Notes && Notes.hasNote(DAY_NOTE_KEY, dateStr);
          const selected = dateStr === selectedDate ? "is-selected" : "";
          const title = `${dateStr} · ${day.free} free / ${day.occupied} occupied${hasNote ? " · note" : ""}`;
          html += `<button type="button" class="cal-day ${levelClass} ${past ? "past" : ""} ${selected} ${hasNote ? "has-note" : ""} admin-day" data-date="${dateStr}" title="${title}"><span class="cal-day-num">${dayNum}</span>${hasNote ? '<span class="cal-note-dot" aria-hidden="true"></span>' : ""}</button>`;
        });
        html += `</div>`;
      });
      calGrid.innerHTML = html;
      calGrid.querySelectorAll(".admin-day").forEach((btn) => {
        btn.addEventListener("click", () => onDayClick(btn.getAttribute("data-date")));
      });
      updateDayPanel();
    }

    document.getElementById("adminUnitList")?.addEventListener("click", (e) => {
      const assign = e.target.closest("[data-assign-unit]");
      if (assign) {
        openAssign({
          roomTypeId: assign.getAttribute("data-room"),
          unit: Number(assign.getAttribute("data-unit")),
          stay: null,
          label: assign.getAttribute("data-label") || "Room",
        });
        return;
      }
      const edit = e.target.closest("[data-edit-stay]");
      if (edit) {
        const stay = Av.getStay(edit.getAttribute("data-edit-stay"));
        openAssign({
          roomTypeId: edit.getAttribute("data-room"),
          unit: Number(edit.getAttribute("data-unit")),
          stay,
          label: edit.getAttribute("data-label") || "Room",
        });
      }
    });

    document.getElementById("adminAssignForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      try {
        const stayId = document.getElementById("assignStayId").value;
        const payload = {
          roomTypeId: document.getElementById("assignRoomType").value,
          unit: Number(document.getElementById("assignUnit").value),
          guestName: document.getElementById("assignGuest").value,
          checkin: document.getElementById("assignCheckin").value,
          checkout: document.getElementById("assignCheckout").value,
          adminNote: document.getElementById("assignNote").value,
        };
        if (stayId) Av.updateStay(stayId, payload);
        else Av.addStay(payload);
        hideAssignBox();
        renderAdminCal();
        toast(stayId ? "Stay updated" : "Guest assigned");
      } catch (err) {
        toast(err.message || "Could not save stay");
      }
    });

    document.getElementById("assignCancel")?.addEventListener("click", hideAssignBox);

    document.getElementById("assignRemove")?.addEventListener("click", () => {
      const stayId = document.getElementById("assignStayId").value;
      if (!stayId) return;
      if (!confirm("Remove this stay? The room will show as available on those dates.")) return;
      Av.removeStay(stayId);
      hideAssignBox();
      renderAdminCal();
      toast("Stay removed");
    });

    document.getElementById("adminDayNoteSave")?.addEventListener("click", () => {
      if (!selectedDate || !Notes) return;
      const text = document.getElementById("adminDayNote").value;
      Notes.setNote(DAY_NOTE_KEY, selectedDate, text);
      renderAdminCal();
      toast(text.trim() ? "Day note saved" : "Note cleared");
    });

    document.getElementById("adminDayNoteClear")?.addEventListener("click", () => {
      if (!selectedDate || !Notes) return;
      Notes.clearNote(DAY_NOTE_KEY, selectedDate);
      document.getElementById("adminDayNote").value = "";
      renderAdminCal();
      toast("Note cleared");
    });

    document.getElementById("adminCalPrev").addEventListener("click", () => {
      viewMonth--;
      if (viewMonth < 0) {
        viewMonth = 11;
        viewYear--;
      }
      renderAdminCal();
    });
    document.getElementById("adminCalNext").addEventListener("click", () => {
      viewMonth++;
      if (viewMonth > 11) {
        viewMonth = 0;
        viewYear++;
      }
      renderAdminCal();
    });

    document.getElementById("exportAvail").addEventListener("click", () => {
      const blob = new Blob([Av.exportJSON()], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "almas-haven-stays.json";
      a.click();
      URL.revokeObjectURL(a.href);
      toast("Exported stays");
    });

    document.getElementById("importAvail").addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        Av.importJSON(await file.text());
        renderAdminCal();
        toast("Imported");
      } catch {
        toast("Import failed — use stays JSON export");
      }
      e.target.value = "";
    });

    document.getElementById("clearAvail").addEventListener("click", () => {
      if (confirm("Clear ALL guest stays for every room?")) {
        Av.clearAll();
        renderAdminCal();
        toast("All stays cleared");
      }
    });

    window.addEventListener("alma:availability-updated", renderAdminCal);
    window.addEventListener("alma:admin-notes-updated", renderAdminCal);
    renderAdminCal();
  }

  /* ---- Room prices ---- */
  function renderPriceList() {
    const list = document.getElementById("adminPriceList");
    const Prices = window.AlmaRoomPrices;
    const rooms = (window.ALMA_CONFIG && window.ALMA_CONFIG.rooms) || [];
    if (!list || !Prices) return;

    list.innerHTML = rooms
      .map((r) => {
        const price = Prices.getPrice(r.id);
        const def = Prices.getDefaultPrice(r.id);
        const custom = Prices.hasOverride(r.id);
        return `
        <article class="admin-price-card" data-price-room="${r.id}">
          <div class="admin-price-card__info">
            <strong>${escapeHtmlAdmin(r.name)}</strong>
            <span>${escapeHtmlAdmin(r.floor)} · up to ${r.pax} pax · ${r.count} room${r.count === 1 ? "" : "s"}</span>
            <span class="lp-note">Default: ₱${Number(def || 0).toLocaleString("en-PH")}${custom ? " · custom rate saved" : ""}</span>
          </div>
          <label class="admin-field admin-price-input">
            Price (₱ / night)
            <input type="number" min="0" step="100" inputmode="numeric" data-price-input="${r.id}" value="${price ?? ""}" />
          </label>
          <button type="button" class="btn btn-ghost" data-price-reset="${r.id}">Default</button>
        </article>`;
      })
      .join("");
  }

  function initPrices() {
    const Prices = window.AlmaRoomPrices;
    if (!Prices) return;

    renderPriceList();

    document.getElementById("adminPriceList")?.addEventListener("click", (e) => {
      const reset = e.target.closest("[data-price-reset]");
      if (!reset) return;
      const id = reset.getAttribute("data-price-reset");
      Prices.clearRoom(id);
      renderPriceList();
      toast("Price reset to default");
    });

    document.getElementById("priceSaveAll")?.addEventListener("click", () => {
      const map = {};
      document.querySelectorAll("[data-price-input]").forEach((input) => {
        map[input.getAttribute("data-price-input")] = input.value;
      });
      Prices.setMany(map);
      renderPriceList();
      toast("Prices saved — website shows updated rates");
    });

    document.getElementById("priceResetAll")?.addEventListener("click", () => {
      if (!confirm("Reset all room prices to defaults from rooms-config?")) return;
      Prices.clearAll();
      renderPriceList();
      toast("All prices reset to defaults");
    });

    window.addEventListener("alma:room-prices-updated", renderPriceList);
  }

  /* ---- Room photos (visual picker) ---- */
  const PHOTO_LIBRARY = [
    "Images/Couple room.jpg",
    "Images/Family room - 4pax.jpg",
    "Images/Family room - 4pax (01).jpg",
    "Images/Family room - 6pax.jpg",
    "Images/Family room - 6pax (01).jpg",
    "Images/Big room - 15pax.jpg",
    "Images/Big room - 15pax (01).jpg",
    "Images/Big room - 15pax (02).jpg",
    "Images/Kubo room - 5pax.jpg",
    "Images/Resort Exterior.jpg",
    "Images/Resort Exterior01.jpg",
    "Images/Homepage image.jpg",
    "Images/Homepage image01.jpg",
    "Images/Gallery Images.jpg",
    "Images/Gallery Images01.jpg",
    "Images/Gallery Images02.jpg",
  ];

  /** Working list of photo srcs for the selected room (before Save) */
  let photoDraft = [];

  function initPhotos() {
    const rooms = (window.ALMA_CONFIG && window.ALMA_CONFIG.rooms) || [];
    const select = document.getElementById("photoRoomSelect");
    if (!select) return;
    select.innerHTML = "";
    rooms.forEach((r) => {
      const opt = document.createElement("option");
      opt.value = r.id;
      opt.textContent = `${r.floor} · ${r.name}`;
      select.appendChild(opt);
    });

    select.addEventListener("change", loadPhotoEditor);
    document.getElementById("photoSave")?.addEventListener("click", () => {
      const id = select.value;
      window.AlmaRoomPhotos.setOverrides(id, photoDraft.slice());
      loadPhotoEditor();
      toast("Room photos saved — guests see them on the room card");
    });
    document.getElementById("photoReset")?.addEventListener("click", () => {
      const id = select.value;
      window.AlmaRoomPhotos.clearRoom(id);
      loadPhotoEditor();
      toast("Reset to default photos");
    });

    document.getElementById("photoSelected")?.addEventListener("click", (e) => {
      const rm = e.target.closest("[data-photo-remove]");
      if (!rm) return;
      const i = Number(rm.getAttribute("data-photo-remove"));
      if (!Number.isFinite(i)) return;
      photoDraft.splice(i, 1);
      renderPhotoUI();
    });

    document.getElementById("photoLibrary")?.addEventListener("click", (e) => {
      const add = e.target.closest("[data-photo-add]");
      if (!add) return;
      const src = add.getAttribute("data-photo-add");
      if (!src) return;
      if (photoDraft.includes(src)) {
        toast("Already selected");
        return;
      }
      photoDraft.push(src);
      renderPhotoUI();
    });

    document.getElementById("photoUpload")?.addEventListener("change", async (e) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      for (const file of files) {
        if (!file.type.startsWith("image/")) continue;
        try {
          const dataUrl = await readFileAsDataURL(file);
          photoDraft.push(dataUrl);
        } catch {
          toast("Could not read " + file.name);
        }
      }
      renderPhotoUI();
      e.target.value = "";
      toast("Image added — click Save photos to keep it");
    });

    loadPhotoEditor();
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function loadPhotoEditor() {
    const id = document.getElementById("photoRoomSelect")?.value;
    if (!id || !window.AlmaRoomPhotos) return;
    const over = window.AlmaRoomPhotos.getOverrides(id);
    const defaults = window.AlmaRoomPhotos.roomDefaults(id);
    photoDraft = (over.length ? over : defaults).slice();
    const hint = document.getElementById("photoDefaultsHint");
    if (hint) {
      hint.textContent = over.length
        ? "Showing custom photos saved in Admin."
        : "Showing default room photos. Change the selection and Save to override.";
    }
    renderPhotoUI();
  }

  function renderPhotoUI() {
    const selected = document.getElementById("photoSelected");
    const library = document.getElementById("photoLibrary");
    if (selected) {
      if (!photoDraft.length) {
        selected.innerHTML = '<p class="lp-note">No photos selected yet. Click images below to add.</p>';
      } else {
        selected.innerHTML = photoDraft
          .map((src, i) => {
            const label = src.startsWith("data:") ? `Upload ${i + 1}` : src.split("/").pop() || "Photo";
            return `
            <figure class="admin-photo-card is-selected">
              <img src="${imgSrcAdmin(src)}" alt="${escapeHtmlAdmin(label)}" loading="lazy" onerror="this.closest('figure').classList.add('is-broken')" />
              <button type="button" class="admin-photo-remove" data-photo-remove="${i}" title="Remove" aria-label="Remove photo">×</button>
              <figcaption>${escapeHtmlAdmin(label)}</figcaption>
            </figure>`;
          })
          .join("");
      }
    }

    if (library) {
      library.innerHTML = PHOTO_LIBRARY.map((src) => {
        const label = src.split("/").pop() || src;
        const active = photoDraft.includes(src) ? "is-in-list" : "";
        return `
          <button type="button" class="admin-photo-card admin-photo-pick ${active}" data-photo-add="${escapeHtmlAdmin(src)}" title="Add ${escapeHtmlAdmin(label)}">
            <img src="${imgSrcAdmin(src)}" alt="${escapeHtmlAdmin(label)}" loading="lazy" onerror="this.closest('button').classList.add('is-broken')" />
            <figcaption>${escapeHtmlAdmin(label)}</figcaption>
          </button>`;
      }).join("");
    }
  }

  /* ---- Inbox ---- */
  function initInbox() {
    const list = document.getElementById("inboxList");
    const rooms = (window.ALMA_CONFIG && window.ALMA_CONFIG.rooms) || [];

    function typeLabel(type) {
      if (type === "reservation") return "Reservation";
      if (type === "agent") return "Live agent";
      if (type === "live_chat_ended") return "Chat ended";
      if (type === "chat_followup") return "Chat follow-up";
      return type || "Message";
    }

    function formatWhen(iso) {
      try {
        return new Date(iso).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        });
      } catch {
        return iso;
      }
    }

    function escapeHtml(str) {
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    function roomLabel(id) {
      const r = rooms.find((x) => x.id === id);
      return r ? `${r.floor} · ${r.name}` : id || "";
    }

    function renderInbox() {
      if (!window.AlmaNotify) return;
      const items = window.AlmaNotify.loadInbox();
      const unread = items.filter((i) => !i.read).length;
      document.getElementById("statTotal").textContent = String(items.length);
      document.getElementById("statUnread").textContent = String(unread);
      document.getElementById("statReservations").textContent = String(
        items.filter((i) => i.type === "reservation").length
      );
      const tabUnread = document.getElementById("tabUnread");
      if (tabUnread) tabUnread.textContent = unread ? `(${unread})` : "";

      if (!items.length) {
        list.innerHTML =
          '<div class="inbox-empty"><p><strong>No requests yet.</strong></p></div>';
        return;
      }

      list.innerHTML = items
        .map((item) => {
          const details = [
            item.contact ? `<strong>Contact:</strong> ${escapeHtml(item.contact)}` : "",
            item.roomType ? `<strong>Room:</strong> ${escapeHtml(roomLabel(item.roomType))}` : "",
            item.checkin
              ? `<strong>Stay:</strong> ${escapeHtml(item.checkin)} → ${escapeHtml(item.checkout || "?")}`
              : "",
          ]
            .filter(Boolean)
            .join("<br/>");
          return `
          <article class="inbox-item ${item.read ? "" : "unread"}">
            <header>
              <div>
                <span class="type-pill ${item.type}">${typeLabel(item.type)}</span>
                <strong style="margin-left:0.5rem">${escapeHtml(item.name || "Guest")}</strong>
              </div>
              <span class="inbox-meta">${formatWhen(item.createdAt)}</span>
            </header>
            <div class="inbox-meta">${details}</div>
            <p>${escapeHtml(item.message || "")}</p>
            ${
              item.read
                ? ""
                : `<button type="button" class="btn btn-ghost" data-read="${item.id}">Mark read</button>`
            }
          </article>`;
        })
        .join("");
    }

    list.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-read]");
      if (btn) {
        window.AlmaNotify.markRead(btn.getAttribute("data-read"));
        renderInbox();
      }
    });

    document.getElementById("markAll")?.addEventListener("click", () => {
      window.AlmaNotify.markAllRead();
      renderInbox();
      toast("All marked read");
    });
    document.getElementById("clearAll")?.addEventListener("click", () => {
      if (confirm("Clear inbox?")) {
        window.AlmaNotify.clearInbox();
        renderInbox();
        toast("Inbox cleared");
      }
    });
    window.addEventListener("alma:inbox-updated", renderInbox);
    setInterval(renderInbox, 5000);
    renderInbox();
  }

  if (isLoggedIn()) {
    showApp(true);
    initAdminApp();
  } else {
    showApp(false);
  }
})();
