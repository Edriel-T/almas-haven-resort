/**
 * Admin: password gate, first-login password change, availability, photos, inbox
 */
(function () {
  const SESSION_KEY = "almas_haven_admin_session";
  const LOCAL_PW_KEY = "almas_haven_admin_local_pw_v1";
  const LOCAL_PW_CHANGED_KEY = "almas_haven_admin_local_pw_changed_v1";
  const toastEl = document.getElementById("toast");
  let toastTimer;
  let pendingLocalMode = false;

  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toastEl.hidden = true), 3500);
  }

  function defaultLocalPassword() {
    return (window.ALMA_CONFIG && window.ALMA_CONFIG.adminPassword) || "almasadmin";
  }

  function expectedLocalPassword() {
    try {
      const stored = localStorage.getItem(LOCAL_PW_KEY);
      if (stored) return stored;
    } catch {
      /* ignore */
    }
    return defaultLocalPassword();
  }

  function localPasswordNeedsChange() {
    try {
      return localStorage.getItem(LOCAL_PW_CHANGED_KEY) !== "1";
    } catch {
      return true;
    }
  }

  function saveLocalPassword(newPw) {
    localStorage.setItem(LOCAL_PW_KEY, newPw);
    localStorage.setItem(LOCAL_PW_CHANGED_KEY, "1");
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

  function showScreen(which) {
    const login = document.getElementById("adminLogin");
    const change = document.getElementById("adminChangePw");
    const app = document.getElementById("adminApp");
    if (login) login.hidden = which !== "login";
    if (change) change.hidden = which !== "change";
    if (app) app.hidden = which !== "app";
  }

  function cloudEnabled() {
    return window.AlmaCloud && window.AlmaCloud.isConfigured();
  }

  function setupLoginFormMode() {
    const lead = document.getElementById("adminLoginLead");
    const emailLabel = document.getElementById("adminEmailLabel");
    const emailInput = document.getElementById("adminEmailInput");
    if (cloudEnabled()) {
      if (lead) {
        lead.textContent =
          "Sign in with your Firebase admin email and password. On first sign-in you will create a new password.";
      }
      if (emailLabel) emailLabel.hidden = false;
      if (emailInput) {
        emailInput.required = true;
        emailInput.hidden = false;
      }
    } else {
      if (lead) {
        lead.textContent =
          "Cloud is not configured. Enter the local admin password. You will create a new password on first sign-in.";
      }
      if (emailLabel) emailLabel.hidden = true;
      if (emailInput) {
        emailInput.required = false;
        emailInput.hidden = true;
      }
    }
  }

  async function enterAdminAfterAuth(opts) {
    const { localMode, skipPwCheck } = opts || {};
    pendingLocalMode = !!localMode;

    if (!skipPwCheck) {
      let mustChange = false;
      if (localMode) {
        mustChange = localPasswordNeedsChange();
      } else if (window.AlmaCloud) {
        mustChange = await window.AlmaCloud.mustChangePassword();
      }
      if (mustChange) {
        setLoggedIn(true);
        showScreen("change");
        document.getElementById("adminNewPw")?.focus();
        toast("Please create a new password to continue");
        return;
      }
    }

    setLoggedIn(true);
    showScreen("app");
    initAdminApp();
    if (!localMode && window.AlmaCloud) {
      toast("Signed in. Cloud sync is on.");
      try {
        await window.AlmaCloud.uploadLocalToCloud();
      } catch {
        /* optional */
      }
    } else {
      toast("Signed in");
    }
  }

  /* ---- Login ---- */
  document.getElementById("adminLoginForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const emailInput = document.getElementById("adminEmailInput");
    const passInput = document.getElementById("adminPasswordInput");
    const err = document.getElementById("adminLoginError");
    const submitBtn = document.getElementById("adminLoginSubmit");
    err.hidden = true;
    err.textContent = "Incorrect email or password.";

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Signing in…";
    }

    try {
      if (cloudEnabled()) {
        await window.AlmaCloud.signInAdmin(emailInput.value, passInput.value);
        await enterAdminAfterAuth({ localMode: false });
      } else if (passInput.value === expectedLocalPassword()) {
        await enterAdminAfterAuth({ localMode: true });
      } else {
        err.hidden = false;
        passInput.focus();
      }
    } catch (ex) {
      console.error(ex);
      err.textContent = ex.message || "Sign-in failed. Check email, password, and Firebase Auth.";
      err.hidden = false;
      passInput.focus();
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Sign in";
      }
      if (passInput) passInput.value = "";
    }
  });

  /* ---- First login password change ---- */
  document.getElementById("adminChangePwForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const p1 = document.getElementById("adminNewPw");
    const p2 = document.getElementById("adminNewPw2");
    const err = document.getElementById("adminChangePwError");
    const btn = document.getElementById("adminChangePwSubmit");
    err.hidden = true;

    const a = (p1.value || "").trim();
    const b = (p2.value || "").trim();
    if (a.length < 8) {
      err.textContent = "Password must be at least 8 characters.";
      err.hidden = false;
      return;
    }
    if (a !== b) {
      err.textContent = "Passwords do not match.";
      err.hidden = false;
      return;
    }
    if (a === defaultLocalPassword() || a.toLowerCase() === "almasadmin") {
      err.textContent = "Choose a different password than the default.";
      err.hidden = false;
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = "Saving…";
    }

    try {
      if (pendingLocalMode || !cloudEnabled()) {
        saveLocalPassword(a);
        toast("Password saved for this browser");
        await enterAdminAfterAuth({ localMode: true, skipPwCheck: true });
      } else {
        await window.AlmaCloud.changeAdminPassword(a);
        toast("Password saved. Use it the next time you sign in.");
        await enterAdminAfterAuth({ localMode: false, skipPwCheck: true });
      }
      p1.value = "";
      p2.value = "";
    } catch (ex) {
      console.error(ex);
      err.textContent = ex.message || "Could not update password.";
      err.hidden = false;
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Save new password";
      }
    }
  });

  document.getElementById("adminLogout")?.addEventListener("click", async () => {
    if (window.AlmaLiveAgent) window.AlmaLiveAgent.goOffline();
    if (window.AlmaCloud) {
      try {
        await window.AlmaCloud.signOutAdmin();
      } catch {
        /* ignore */
      }
    }
    setLoggedIn(false);
    pendingLocalMode = false;
    showScreen("login");
    const passInput = document.getElementById("adminPasswordInput");
    const emailInput = document.getElementById("adminEmailInput");
    if (passInput) passInput.value = "";
    if (emailInput) emailInput.value = "";
    toast("Logged out");
  });

  let appReady = false;

  function initAdminApp() {
    if (appReady) return;
    appReady = true;
    initTabs();
    initCloudBadge();
    initLiveAgentDesk();
    initAvailability();
    initPrices();
    initPhotos();
    initInbox();
    updateCloudBadge();
  }

  function updateCloudBadge(detail) {
    const el = document.getElementById("adminCloudBadge");
    if (!el) return;
    const s = detail || (window.AlmaCloud && window.AlmaCloud.status()) || {};
    el.classList.remove("is-ok", "is-warn", "is-off");
    if (!s.configured) {
      el.textContent = "Cloud: offline";
      el.classList.add("is-off");
      el.title = "Cloud is not configured";
    } else if (s.writeReady) {
      el.textContent = "Cloud: connected";
      el.classList.add("is-ok");
      el.title = s.user ? `Signed in as ${s.user}` : "Cloud writes enabled";
    } else if (s.ready) {
      el.textContent = "Cloud: view only";
      el.classList.add("is-warn");
      el.title = "Connected for reading. Sign in again to save changes.";
    } else {
      el.textContent = "Cloud: connecting…";
      el.classList.add("is-warn");
      el.title = "Connecting to cloud…";
    }
  }

  function initCloudBadge() {
    updateCloudBadge();
    window.addEventListener("alma:cloud-status", (e) => updateCloudBadge(e.detail));
  }

  /* ---- Live agent desk ---- */
  let activeLiveChatId = null;
  let agentHbTimer = null;

  function initLiveAgentDesk() {
    const Live = window.AlmaLiveAgent;
    if (!Live) return;

    const toggle = document.getElementById("agentOnlineToggle");
    const label = document.getElementById("agentOnlineLabel");
    let applyingRemotePresence = false;

    function syncToggleUI() {
      const on = Live.isAgentOnline();
      if (toggle && toggle.checked !== on) {
        applyingRemotePresence = true;
        toggle.checked = on;
        applyingRemotePresence = false;
      } else if (toggle) {
        toggle.checked = on;
      }
      if (label) label.textContent = on ? "● Online" : "Go online";
      // Any admin device that sees "online" should help keep the heartbeat alive
      if (on) startHeartbeat();
      else stopHeartbeat();
    }

    function startHeartbeat() {
      if (agentHbTimer) return;
      agentHbTimer = setInterval(() => Live.heartbeat(), Live.HEARTBEAT_MS);
    }

    function stopHeartbeat() {
      if (agentHbTimer) {
        clearInterval(agentHbTimer);
        agentHbTimer = null;
      }
    }

    toggle?.addEventListener("change", () => {
      if (applyingRemotePresence) return;
      if (toggle.checked) {
        Live.goOnline("Alma's Haven agent");
        startHeartbeat();
        toast("You are online on all devices. Guests can chat on the website.");
      } else {
        Live.goOffline();
        stopHeartbeat();
        toast("You are offline on all devices. Guests will use Facebook.");
      }
      syncToggleUI();
    });

    // Connect cloud presence ASAP so other devices see the same online status
    if (typeof Live.startCloudSync === "function") {
      Live.startCloudSync().then(() => {
        syncToggleUI();
        if (Live.isAgentOnline()) {
          Live.heartbeat();
          startHeartbeat();
        }
      });
    }

    // Resume online if presence already active (this device or another)
    if (Live.isAgentOnline()) {
      if (toggle) toggle.checked = true;
      Live.heartbeat();
      startHeartbeat();
    }
    syncToggleUI();

    document.getElementById("liveChatForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!activeLiveChatId) return;
      const chat = Live.getChat(activeLiveChatId);
      if (chat && chat.status === "queued") {
        toast("Accept this guest from the queue first.");
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
      toast("Guest accepted. You can chat now.");
    });

    document.getElementById("liveChatEnd")?.addEventListener("click", () => {
      if (!activeLiveChatId) return;
      if (!confirm("End this chat? The next guest in the queue will be connected.")) return;
      Live.closeChat(activeLiveChatId);
      activeLiveChatId = null;
      renderLiveList();
      renderLiveThread(null);
      toast("Chat ended.");
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

    window.addEventListener("alma:live-agent", (ev) => {
      renderLiveList();
      if (activeLiveChatId) renderLiveThread(activeLiveChatId);
      // Presence updates from other devices → keep toggle in sync
      syncToggleUI();
      const type = ev && ev.detail && ev.detail.type;
      if (type === "presence" && Live.isAgentOnline() && !agentHbTimer) {
        startHeartbeat();
      }
    });

    setInterval(() => {
      // Keep shared online status fresh while any admin tab is open and online
      if (Live.isAgentOnline()) Live.heartbeat();
      syncToggleUI();
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
      tab.textContent = chats.length ? `(${a} active · ${q} waiting)` : "";
    }

    if (!chats.length) {
      list.innerHTML =
        '<p class="lp-note" style="padding:1rem">No active chats. Go online so guests can message you on the website.</p>';
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
        const email = c.email || c.guestContact || "";
        return `
        <button type="button" class="live-chat-item ${c.id === activeLiveChatId ? "is-active" : ""}" data-live-id="${c.id}">
          <strong>${escapeHtmlAdmin(c.guestName || "Guest")} ${badge}</strong>
          <span>${escapeHtmlAdmin(email || need)}</span>
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

    function setAcceptVisible(show) {
      if (!acceptBtn) return;
      acceptBtn.hidden = !show;
      // Force hide even if something re-toggles attributes incorrectly
      acceptBtn.style.display = show ? "" : "none";
      acceptBtn.setAttribute("aria-hidden", show ? "false" : "true");
    }

    if (!chatId) {
      head.textContent = "Select a conversation";
      if (needEl) {
        needEl.hidden = true;
        needEl.textContent = "";
      }
      box.innerHTML = "";
      form.hidden = true;
      setAcceptVisible(false);
      if (tplBox) tplBox.hidden = true;
      return;
    }

    const chat = Live.getChat(chatId);
    if (!chat) {
      head.textContent = "Conversation not found";
      box.innerHTML = "";
      form.hidden = true;
      setAcceptVisible(false);
      if (tplBox) tplBox.hidden = true;
      return;
    }

    const isQueued = chat.status === "queued";
    const isActive = chat.status === "active";
    const isClosed = chat.status === "closed";

    const statusLabel = isQueued
      ? `Queue #${Live.queuePosition(chat.id)}`
      : isActive
        ? "Active"
        : chat.status;
    head.textContent = `${chat.guestName || "Guest"} · ${statusLabel}`;
    if (needEl) {
      const bits = [];
      if (chat.firstName || chat.lastName) {
        bits.push(
          `Name: ${[chat.firstName, chat.lastName].filter(Boolean).join(" ") || chat.guestName || "Guest"}`
        );
      }
      if (chat.email || chat.guestContact) {
        bits.push(`Email: ${chat.email || chat.guestContact}`);
      }
      if (chat.need) bits.push(`Need: ${chat.need}`);
      needEl.hidden = !bits.length;
      needEl.textContent = bits.join(" · ");
    }
    form.hidden = isClosed;
    // Accept only for queued guests — never when already active or closed
    setAcceptVisible(isQueued);
    if (tplBox) {
      tplBox.hidden = isClosed;
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
  function initAvailability() {
    const Av = window.AlmaAvailability;
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
                ${
                  row.stay.adminNote
                    ? `<p class="lp-note"><strong>Note:</strong> ${escapeHtmlAdmin(row.stay.adminNote)}</p>`
                    : ""
                }
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
                <p class="lp-note">Up to ${row.pax} guests · ₱${Number(row.price || 0).toLocaleString("en-PH")} per night</p>
              </div>
              <button type="button" class="btn btn-primary btn-sm" data-assign-unit
                data-room="${row.roomTypeId}" data-unit="${row.unit}" data-label="${escapeHtmlAdmin(row.label)}">Assign guest</button>
            </article>`;
        }
      });
      list.innerHTML = html || '<p class="lp-note">No rooms configured.</p>';
    }

    /** Gold dot when any room stay on this date has a private note */
    function dateHasRoomNote(dateStr) {
      const day = Av.getDayOccupancy(dateStr);
      return day.rows.some((r) => r.occupied && r.stay && r.stay.adminNote);
    }

    function updateDayPanel() {
      const title = document.getElementById("adminDayTitle");
      const sub = document.getElementById("adminDaySub");
      const controls = document.getElementById("adminDayControls");
      const statusEl = document.getElementById("adminDayStatus");

      if (!selectedDate) {
        title.textContent = "Select a date";
        sub.textContent = "Click a day to view room occupancy.";
        controls.hidden = true;
        hideAssignBox();
        return;
      }

      const day = Av.getDayOccupancy(selectedDate);
      title.textContent = formatNiceDate(selectedDate);
      sub.textContent = `${day.free} available · ${day.occupied} reserved · ${day.total} total units`;
      controls.hidden = false;

      let pill = "is-open";
      let label = "Available";
      if (day.level === "partial") {
        pill = "is-partial";
        label = "Limited availability";
      } else if (day.level === "full") {
        pill = "is-closed";
        label = "Fully booked";
      }
      statusEl.innerHTML = `<span class="admin-status-pill ${pill}">${label}</span>`;
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
          const hasNote = dateHasRoomNote(dateStr);
          const selected = dateStr === selectedDate ? "is-selected" : "";
          const title = `${dateStr} · ${day.free} available / ${day.occupied} reserved${hasNote ? " · room note" : ""}`;
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
        toast(stayId ? "Stay updated." : "Guest assigned.");
      } catch (err) {
        toast(err.message || "Could not save this stay.");
      }
    });

    document.getElementById("assignCancel")?.addEventListener("click", hideAssignBox);

    document.getElementById("assignRemove")?.addEventListener("click", () => {
      const stayId = document.getElementById("assignStayId").value;
      if (!stayId) return;
      if (!confirm("Remove this stay? The room will become available on those dates.")) return;
      Av.removeStay(stayId);
      hideAssignBox();
      renderAdminCal();
      toast("Stay removed.");
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
      toast("Data exported.");
    });

    document.getElementById("importAvail").addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        Av.importJSON(await file.text());
        renderAdminCal();
        toast("Data imported.");
      } catch {
        toast("Import failed. Use a valid stays export file.");
      }
      e.target.value = "";
    });

    document.getElementById("clearAvail").addEventListener("click", () => {
      if (confirm("Clear all guest stays for every room?")) {
        Av.clearAll();
        renderAdminCal();
        toast("All stays cleared.");
      }
    });

    window.addEventListener("alma:availability-updated", renderAdminCal);
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
            <span class="lp-note">Default: ₱${Number(def || 0).toLocaleString("en-PH")}${custom ? " · custom rate active" : ""}</span>
          </div>
          <label class="admin-field admin-price-input">
            Rate (₱ / night)
            <input type="number" min="0" step="100" inputmode="numeric" data-price-input="${r.id}" value="${price ?? ""}" />
          </label>
          <button type="button" class="btn btn-ghost" data-price-reset="${r.id}">Reset</button>
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
      toast("Rate reset to default.");
    });

    document.getElementById("priceSaveAll")?.addEventListener("click", () => {
      const map = {};
      document.querySelectorAll("[data-price-input]").forEach((input) => {
        map[input.getAttribute("data-price-input")] = input.value;
      });
      Prices.setMany(map);
      renderPriceList();
      toast("Rates saved.");
    });

    document.getElementById("priceResetAll")?.addEventListener("click", () => {
      if (!confirm("Reset all room rates to the default amounts?")) return;
      Prices.clearAll();
      renderPriceList();
      toast("All rates reset to defaults.");
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
      toast("Room photos saved.");
    });
    document.getElementById("photoReset")?.addEventListener("click", () => {
      const id = select.value;
      window.AlmaRoomPhotos.clearRoom(id);
      loadPhotoEditor();
      toast("Photos reset to defaults.");
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
      toast("Image added. Click Save photos to keep it.");
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
        ? "Using custom photos saved in Admin."
        : "Using default room photos. Change the selection and save to override.";
    }
    renderPhotoUI();
  }

  function friendlyPhotoLabel(src, i) {
    if (!src) return `Photo ${i + 1}`;
    if (src.startsWith("data:")) return `Upload ${i + 1}`;
    const name = (src.split("/").pop() || "").replace(/\.[^.]+$/, "");
    // Prefer short readable labels without raw file extensions
    if (/couple/i.test(name)) return "Couple room";
    if (/family.*4|4pax|5 pax/i.test(name)) return "Family room";
    if (/family.*6|6pax|7 pax/i.test(name)) return "Family room";
    if (/big|15pax|15 pax/i.test(name)) return "Big room";
    if (/kubo/i.test(name)) return "Kubo room";
    if (/exterior/i.test(name)) return "Exterior";
    if (/homepage|gallery/i.test(name)) return "Resort";
    return `Photo ${i + 1}`;
  }

  function renderPhotoUI() {
    const selected = document.getElementById("photoSelected");
    const library = document.getElementById("photoLibrary");
    if (selected) {
      if (!photoDraft.length) {
        selected.innerHTML = '<p class="lp-note">No photos selected. Choose images from the library below.</p>';
      } else {
        selected.innerHTML = photoDraft
          .map((src, i) => {
            const label = friendlyPhotoLabel(src, i);
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
      library.innerHTML = PHOTO_LIBRARY.map((src, i) => {
        const label = friendlyPhotoLabel(src, i);
        const active = photoDraft.includes(src) ? "is-in-list" : "";
        return `
          <button type="button" class="admin-photo-card admin-photo-pick ${active}" data-photo-add="${escapeHtmlAdmin(src)}" title="Add photo">
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
            item.firstName || item.lastName
              ? `<strong>Name:</strong> ${escapeHtml(
                  [item.firstName, item.lastName].filter(Boolean).join(" ") || item.name || "Guest"
                )}`
              : "",
            item.email || item.contact
              ? `<strong>Email:</strong> ${escapeHtml(item.email || item.contact)}`
              : "",
            item.contact && item.contact !== item.email
              ? `<strong>Contact:</strong> ${escapeHtml(item.contact)}`
              : "",
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
            <p class="inbox-message">${escapeHtml(item.message || "")}</p>
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

  // Restore session after refresh (Firebase Auth persistence + local session)
  async function bootAdmin() {
    setupLoginFormMode();

    if (cloudEnabled() && window.AlmaCloud) {
      try {
        await window.AlmaCloud.init();
        const user = await window.AlmaCloud.waitForAuth(8000);
        if (user) {
          setLoggedIn(true);
          pendingLocalMode = false;
          const mustChange = await window.AlmaCloud.mustChangePassword();
          if (mustChange) {
            showScreen("change");
            toast("Please create a new password to continue");
          } else {
            showScreen("app");
            initAdminApp();
            updateCloudBadge();
          }
          return;
        }
      } catch (err) {
        console.warn("Admin session restore failed:", err);
      }
      setLoggedIn(false);
      showScreen("login");
      return;
    }

    // Local-only mode (no Firebase)
    if (isLoggedIn()) {
      if (localPasswordNeedsChange()) {
        pendingLocalMode = true;
        showScreen("change");
      } else {
        showScreen("app");
        initAdminApp();
      }
    } else {
      showScreen("login");
    }
  }

  if (window.AlmaCloud) {
    window.AlmaCloud.init().finally(() => {
      bootAdmin();
    });
  } else {
    bootAdmin();
  }
})();
