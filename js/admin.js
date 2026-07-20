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
        const panels = ["live", "availability", "photos", "inbox"];
        panels.forEach((p) => {
          const el = document.getElementById(`panel-${p}`);
          if (el) el.hidden = p !== id;
        });
        if (id === "photos") loadPhotoEditor();
        if (id === "live") renderLiveList();
      });
    });
  }

  /* ---- Availability (click to toggle with confirm) ---- */
  function initAvailability() {
    const Av = window.AlmaAvailability;
    const rooms = (window.ALMA_CONFIG && window.ALMA_CONFIG.rooms) || [];
    const roomSelect = document.getElementById("adminRoomSelect");
    const calLabel = document.getElementById("adminCalLabel");
    const calGrid = document.getElementById("adminCalGrid");

    let viewYear = new Date().getFullYear();
    let viewMonth = new Date().getMonth();

    roomSelect.innerHTML = "";
    rooms.forEach((r) => {
      const opt = document.createElement("option");
      opt.value = r.id;
      opt.textContent = `${r.floor} · ${r.name}`;
      roomSelect.appendChild(opt);
    });

    function formatNiceDate(iso) {
      try {
        const [y, m, d] = iso.split("-").map(Number);
        return new Date(y, m - 1, d).toLocaleDateString(undefined, {
          weekday: "short",
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      } catch {
        return iso;
      }
    }

    function roomName(id) {
      const r = rooms.find((x) => x.id === id);
      return r ? r.name : id;
    }

    function onDayClick(dateStr, roomId) {
      const status = Av.getStatus(roomId, dateStr);
      const isOpen = status === "available";
      const nice = formatNiceDate(dateStr);
      const room = roomName(roomId);

      if (isOpen) {
        // Green → mark not available (with confirm)
        const ok = confirm(
          `Mark this date as NOT AVAILABLE?\n\nRoom: ${room}\nDate: ${nice}\n\nGuests will see this day as red (closed).`
        );
        if (!ok) return;
        Av.setStatus(roomId, dateStr, "blocked");
        renderAdminCal();
        toast(`${nice} → not available (red)`);
      } else {
        // Red → undo / make available again (with confirm)
        const ok = confirm(
          `Make this date AVAILABLE again?\n\nRoom: ${room}\nDate: ${nice}\n\nThis undoes the block. Guests will see green.`
        );
        if (!ok) return;
        Av.setStatus(roomId, dateStr, "available");
        renderAdminCal();
        toast(`${nice} → available (green)`);
      }
    }

    function renderAdminCal() {
      if (!Av) return;
      const roomId = roomSelect.value;
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
          const status = Av.getStatus(roomId, dateStr);
          const past = dateStr < today;
          const dayNum = Number(dateStr.slice(-2));
          const open = status === "available";
          const title = open
            ? `${dateStr} · Available — click to mark not available`
            : `${dateStr} · Not available — click to make available again`;
          html += `<button type="button" class="cal-day ${open ? "available" : "unavailable"} ${status} ${past ? "past" : ""} admin-day" data-date="${dateStr}" title="${title}">${dayNum}</button>`;
        });
        html += `</div>`;
      });
      calGrid.innerHTML = html;
      calGrid.querySelectorAll(".admin-day").forEach((btn) => {
        btn.addEventListener("click", () => {
          onDayClick(btn.getAttribute("data-date"), roomId);
        });
      });
    }

    roomSelect.addEventListener("change", renderAdminCal);
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
      a.download = "almas-haven-availability.json";
      a.click();
      URL.revokeObjectURL(a.href);
      toast("Exported");
    });

    document.getElementById("importAvail").addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        Av.importJSON(await file.text());
        renderAdminCal();
        toast("Imported");
      } catch {
        toast("Import failed");
      }
      e.target.value = "";
    });

    document.getElementById("clearAvail").addEventListener("click", () => {
      if (confirm("Clear ALL availability marks for every room?")) {
        Av.clearAll();
        renderAdminCal();
        toast("Cleared");
      }
    });

    window.addEventListener("alma:availability-updated", renderAdminCal);
    renderAdminCal();
  }

  /* ---- Room photos ---- */
  function initPhotos() {
    const rooms = (window.ALMA_CONFIG && window.ALMA_CONFIG.rooms) || [];
    const select = document.getElementById("photoRoomSelect");
    select.innerHTML = "";
    rooms.forEach((r) => {
      const opt = document.createElement("option");
      opt.value = r.id;
      opt.textContent = `${r.floor} · ${r.name}`;
      select.appendChild(opt);
    });

    select.addEventListener("change", loadPhotoEditor);
    document.getElementById("photoSave").addEventListener("click", () => {
      const id = select.value;
      const raw = document.getElementById("photoPathsInput").value;
      const paths = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      window.AlmaRoomPhotos.setOverrides(id, paths);
      loadPhotoEditor();
      toast("Room photos saved — guests see them when they click the card");
    });
    document.getElementById("photoReset").addEventListener("click", () => {
      const id = select.value;
      window.AlmaRoomPhotos.clearRoom(id);
      loadPhotoEditor();
      toast("Reset to default photos");
    });
    document.getElementById("photoPathsInput").addEventListener("input", previewPhotos);
    loadPhotoEditor();
  }

  function loadPhotoEditor() {
    const id = document.getElementById("photoRoomSelect").value;
    if (!id || !window.AlmaRoomPhotos) return;
    const over = window.AlmaRoomPhotos.getOverrides(id);
    const defaults = window.AlmaRoomPhotos.roomDefaults(id);
    const using = over.length ? over : defaults;
    document.getElementById("photoPathsInput").value = using.join("\n");
    document.getElementById("photoDefaultsHint").textContent = over.length
      ? "Using custom list from Admin (overrides defaults)."
      : "Using default photos. Save a custom list to override.";
    previewPhotos();
  }

  function previewPhotos() {
    const box = document.getElementById("photoPreview");
    const raw = document.getElementById("photoPathsInput").value;
    const paths = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (!paths.length) {
      box.innerHTML = "<p class='lp-note'>No paths yet.</p>";
      return;
    }
    const enc = (p) =>
      p
        .split("/")
        .map((part, i) => (i === 0 ? part : encodeURIComponent(part)))
        .join("/");
    box.innerHTML = paths
      .map(
        (p) =>
          `<figure class="admin-photo-thumb"><img src="${enc(p)}" alt="" onerror="this.parentElement.classList.add('is-broken')"/><figcaption>${p}</figcaption></figure>`
      )
      .join("");
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
