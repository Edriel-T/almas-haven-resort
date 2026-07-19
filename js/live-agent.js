/**
 * Live agent presence + queue + in-site chat.
 * Agent online in Admin; guests give name → need → join queue / connect.
 * Offline guests → Facebook form.
 */
(function () {
  const PRESENCE_KEY = "almas_haven_agent_presence_v1";
  const CHATS_KEY = "almas_haven_live_chats_v1";
  const GUEST_ID_KEY = "almas_haven_guest_id_v1";
  const CHANNEL = "almas-haven-live-agent";
  const HEARTBEAT_MS = 12000;
  const ONLINE_TTL_MS = 35000;

  /**
   * Ready messages for agents (label = button text, text = full reply).
   * Worded like the FAQ bot — clear, professional, easy to paste.
   */
  function buildRatesText() {
    const rooms = (window.ALMA_CONFIG && window.ALMA_CONFIG.rooms) || [];
    if (!rooms.length) {
      return [
        "Here are our room rates (per room, per night):",
        "",
        "• 1st floor — Couple Room: up to 2 guests · ₱2,500",
        "• 1st floor — Family Room: up to 4 guests · ₱3,500 (3 rooms)",
        "• 2nd floor — Family Room: up to 6 guests · ₱4,500 (4 rooms)",
        "• 3rd floor — Big Group Room: up to 15 guests · ₱9,500 (2 rooms; 1 has a balcony)",
        "• Kubo Room: up to 4 guests · ₱3,500 (no private CR)",
        "",
        "All rooms are air-conditioned and include a free cottage.",
        "Private CR on all rooms except the kubo. Parking is in front of your room.",
      ].join("\n");
    }
    const lines = rooms.map((r) => {
      const extras = [];
      if (!r.privateCr) extras.push("no private CR");
      if (r.hasBalcony) extras.push("1 room has balcony");
      if (r.hasTv) extras.push("TV");
      if (r.hasRef) extras.push("ref");
      const extra = extras.length ? ` (${extras.join(", ")})` : "";
      return `• ${r.floor} — ${r.name}: up to ${r.pax} guests · ₱${r.price.toLocaleString("en-PH")} · ${r.count} unit(s)${extra}`;
    });
    return [
      "Here are our room rates (per room, per night):",
      "",
      ...lines,
      "",
      "All rooms are air-conditioned and include a free cottage.",
      "Private CR on all rooms except the kubo. Parking is in front of your room.",
    ].join("\n");
  }

  const AGENT_TEMPLATES = [
    {
      label: "Greeting",
      text: "Hi! Thank you for waiting. How can I help you today?",
    },
    {
      label: "Welcome",
      text: "Welcome to Alma's Haven Resort in Dasol, Pangasinan. Which room type and dates are you interested in?",
    },
    {
      label: "Room rates",
      get text() {
        return buildRatesText();
      },
    },
    {
      label: "Room types",
      text: [
        "We have a 3-floor beachfront building plus one kubo:",
        "",
        "• 1st floor: 3 family rooms (4 guests) and 1 couple room",
        "• 2nd floor: 4 family rooms (6 guests)",
        "• 3rd floor: 2 big group rooms (15 guests) — one has a balcony",
        "• Kubo: 1 room for 4 guests (no private CR)",
        "",
        "Every booking includes a free cottage. All rooms are air-conditioned.",
      ].join("\n"),
    },
    {
      label: "Free cottage",
      text: "Yes — every room booking includes a free cottage. It is great for meals, hanging out, and shade near the beach.",
    },
    {
      label: "Ask dates",
      text: "Please share your preferred check-in date, check-out date, and number of guests so I can check availability.",
    },
    {
      label: "Checking…",
      text: "Thank you. I will check availability for those dates and get back to you shortly.",
    },
    {
      label: "Parking",
      text: "Yes, parking is available in front of your room — easy for loading bags and for families with kids.",
    },
    {
      label: "Location",
      text: "We are in Dasol, 2411 Pangasinan (Plus Code WQJJ+5M). You can open Google Maps and search Alma's Haven Resort, Dasol.",
    },
    {
      label: "Facebook backup",
      text: "If we get disconnected, please message us on our Facebook page. Thank you!",
    },
    {
      label: "Thank you",
      text: "You are welcome! We look forward to hosting you at Alma's Haven Resort.",
    },
  ];

  function getTemplateText(item) {
    if (!item) return "";
    if (typeof item.text === "function") return item.text();
    return item.text || "";
  }

  function uid(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function broadcast(type, payload) {
    try {
      const bc = new BroadcastChannel(CHANNEL);
      bc.postMessage({ type, payload, at: Date.now() });
      bc.close();
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new CustomEvent("alma:live-agent", { detail: { type, payload } }));
  }

  function loadPresence() {
    try {
      return JSON.parse(localStorage.getItem(PRESENCE_KEY) || "null");
    } catch {
      return null;
    }
  }

  function savePresence(p) {
    localStorage.setItem(PRESENCE_KEY, JSON.stringify(p));
    broadcast("presence", p);
  }

  function isAgentOnline() {
    const p = loadPresence();
    if (!p || !p.online) return false;
    return Date.now() - (p.lastSeen || 0) < ONLINE_TTL_MS;
  }

  function getAgentName() {
    const p = loadPresence();
    return (p && p.name) || "Live agent";
  }

  function goOnline(name) {
    savePresence({
      online: true,
      name: name || "Resort agent",
      lastSeen: Date.now(),
    });
  }

  function heartbeat() {
    const p = loadPresence();
    if (!p || !p.online) return;
    p.lastSeen = Date.now();
    savePresence(p);
  }

  function goOffline() {
    const p = loadPresence() || {};
    savePresence({ ...p, online: false, lastSeen: Date.now() });
  }

  function loadChats() {
    try {
      return JSON.parse(localStorage.getItem(CHATS_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function saveChats(chats) {
    localStorage.setItem(CHATS_KEY, JSON.stringify(chats));
    broadcast("chats", null);
  }

  function getGuestId() {
    try {
      let id = sessionStorage.getItem(GUEST_ID_KEY);
      if (!id) {
        id = uid("guest");
        sessionStorage.setItem(GUEST_ID_KEY, id);
      }
      return id;
    } catch {
      return uid("guest");
    }
  }

  function getChat(chatId) {
    return loadChats()[chatId] || null;
  }

  /** Queued guests, oldest first */
  function listQueued() {
    return Object.values(loadChats())
      .filter((c) => c.status === "queued")
      .sort((a, b) => (a.queuedAt || a.createdAt || 0) - (b.queuedAt || b.createdAt || 0));
  }

  /** Active chats (agent is talking) */
  function listActive() {
    return Object.values(loadChats())
      .filter((c) => c.status === "active")
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  function listOpenChats() {
    return Object.values(loadChats())
      .filter((c) => c.status === "active" || c.status === "queued")
      .sort((a, b) => {
        if (a.status === "active" && b.status !== "active") return -1;
        if (b.status === "active" && a.status !== "active") return 1;
        return (a.queuedAt || a.createdAt || 0) - (b.queuedAt || b.createdAt || 0);
      });
  }

  function countActive() {
    return listActive().length;
  }

  function queuePosition(chatId) {
    const q = listQueued();
    const idx = q.findIndex((c) => c.id === chatId);
    return idx < 0 ? 0 : idx + 1;
  }

  function promoteNextInQueue() {
    const chats = loadChats();
    // Only auto-promote if no active chats (single agent desk)
    const hasActive = Object.values(chats).some((c) => c.status === "active");
    if (hasActive) return null;

    const queued = Object.values(chats)
      .filter((c) => c.status === "queued")
      .sort((a, b) => (a.queuedAt || a.createdAt || 0) - (b.queuedAt || b.createdAt || 0));
    if (!queued.length) return null;

    const next = queued[0];
    next.status = "active";
    next.updatedAt = Date.now();
    next.messages = next.messages || [];
    next.messages.push({
      id: uid("m"),
      from: "system",
      text: "You're next! Connected to a live agent. Please wait for their reply.",
      at: Date.now(),
    });
    chats[next.id] = next;
    saveChats(chats);
    return next;
  }

  /**
   * Join live help after name + need collected.
   * If agent free → active; if busy → queued with position.
   */
  function joinQueue({ name, need, topic }) {
    const id = getGuestId();
    const chats = loadChats();
    const guestName = String(name || "Guest").trim() || "Guest";
    const needText = String(need || "").trim();
    const topicLabel = topic || "help";

    let chat = chats[id];
    if (chat && (chat.status === "active" || chat.status === "queued")) {
      chat.guestName = guestName;
      if (needText) {
        chat.need = needText;
        chat.messages.push({
          id: uid("m"),
          from: "guest",
          text: needText,
          at: Date.now(),
        });
      }
      chat.updatedAt = Date.now();
      chats[id] = chat;
      saveChats(chats);
      return { chat, position: queuePosition(id), promoted: chat.status === "active" };
    }

    const busy = countActive() > 0;
    const status = busy ? "queued" : "active";
    const now = Date.now();

    chat = {
      id,
      guestName,
      need: needText,
      topic: topicLabel,
      status,
      createdAt: now,
      queuedAt: now,
      updatedAt: now,
      messages: [],
    };

    if (status === "queued") {
      const pos = listQueued().length + 1; // will be after we add
      chat.messages.push({
        id: uid("m"),
        from: "system",
        text: `Hi ${guestName}! You're in the queue. An agent is helping someone else — we'll connect you shortly.`,
        at: now,
      });
    } else {
      chat.messages.push({
        id: uid("m"),
        from: "system",
        text: `Hi ${guestName}! You're connected to a live agent on the website. They can see what you need and will reply here.`,
        at: now,
      });
    }

    if (needText) {
      chat.messages.push({
        id: uid("m"),
        from: "guest",
        text: needText,
        at: now,
      });
    }

    chats[id] = chat;
    saveChats(chats);

    // Recompute position after save
    const position = status === "queued" ? queuePosition(id) : 0;
    if (status === "queued" && position > 0) {
      // Update queue message with exact position
      chat.messages[0].text = `Hi ${guestName}! You're #${position} in the queue. Please wait — an agent will take you when free.`;
      chats[id] = chat;
      saveChats(chats);
    }

    return { chat, position, promoted: status === "active" };
  }

  function addMessage(chatId, from, text) {
    const chats = loadChats();
    const chat = chats[chatId];
    if (!chat) return null;
    if (chat.status === "queued" && from === "guest") {
      // Guests in queue can still leave notes
    }
    if (chat.status === "closed") return chat;
    const msg = {
      id: uid("m"),
      from,
      text: String(text || "").trim(),
      at: Date.now(),
    };
    if (!msg.text) return chat;
    chat.messages.push(msg);
    chat.updatedAt = Date.now();
    chats[chatId] = chat;
    saveChats(chats);
    return chat;
  }

  function acceptChat(chatId) {
    const chats = loadChats();
    const chat = chats[chatId];
    if (!chat) return null;
    chat.status = "active";
    chat.updatedAt = Date.now();
    chat.messages.push({
      id: uid("m"),
      from: "system",
      text: "An agent accepted your chat. You're connected now.",
      at: Date.now(),
    });
    chats[chatId] = chat;
    saveChats(chats);
    return chat;
  }

  function formatChatTranscript(chat, who) {
    const lines = [
      "— Live chat ended —",
      `Ended by: ${who === "guest" ? "Guest" : "Agent"}`,
      `Guest name: ${chat.guestName || "Guest"}`,
      chat.need ? `What they needed: ${chat.need}` : null,
      chat.topic ? `Topic: ${chat.topic}` : null,
      `Chat ID: ${chat.id}`,
      "",
      "Transcript:",
    ].filter((x) => x !== null);

    (chat.messages || []).forEach((m) => {
      const from =
        m.from === "guest" ? "Guest" : m.from === "agent" ? "Agent" : "System";
      const time = m.at
        ? new Date(m.at).toLocaleString(undefined, {
            dateStyle: "short",
            timeStyle: "short",
          })
        : "";
      lines.push(`[${time}] ${from}: ${m.text}`);
    });
    return lines.join("\n");
  }

  function saveChatToInbox(chat, who) {
    if (!window.AlmaNotify || !chat) return;
    const transcript = formatChatTranscript(chat, who);
    window.AlmaNotify.notifyStaff({
      type: "live_chat_ended",
      name: chat.guestName || "Guest",
      contact: chat.guestContact || "(live website chat)",
      topic: chat.topic || "live_chat",
      message: transcript,
    }).catch(() => {
      /* ignore */
    });
  }

  function closeChat(chatId, by) {
    const chats = loadChats();
    if (!chats[chatId]) return;
    if (chats[chatId].status === "closed") return;
    const who = by === "guest" ? "guest" : "agent";
    chats[chatId].status = "closed";
    chats[chatId].updatedAt = Date.now();
    chats[chatId].messages.push({
      id: uid("m"),
      from: "system",
      text:
        who === "guest"
          ? "Live chat ended by the guest."
          : "Live chat ended by the agent.",
      at: Date.now(),
    });
    const closed = chats[chatId];
    saveChats(chats);
    // Save full conversation to staff inbox
    saveChatToInbox(closed, who);
    // Next in queue becomes active
    promoteNextInQueue();
  }

  function endChatByGuest(chatId) {
    closeChat(chatId, "guest");
  }

  function facebookPageUrl() {
    const c = window.ALMA_CONFIG || {};
    return (
      c.facebookPageUrl ||
      (c.facebookPageId
        ? `https://web.facebook.com/profile.php?id=${c.facebookPageId}`
        : "https://web.facebook.com/profile.php?id=100057130492638")
    );
  }

  async function copyText(message) {
    if (!message) return false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(message);
        return true;
      }
    } catch {
      /* fall through */
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = message;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }

  async function openFacebookWithMessage(message) {
    const copied = await copyText(message);
    window.open(facebookPageUrl(), "_blank", "noopener");
    return copied;
  }

  // Legacy createChat → joinQueue
  function createChat(opts) {
    const result = joinQueue({
      name: opts?.name,
      need: opts?.firstMessage || opts?.need,
      topic: opts?.topic,
    });
    return result.chat;
  }

  window.AlmaLiveAgent = {
    CHANNEL,
    HEARTBEAT_MS,
    ONLINE_TTL_MS,
    AGENT_TEMPLATES,
    getTemplateText,
    buildRatesText,
    isAgentOnline,
    getAgentName,
    goOnline,
    goOffline,
    heartbeat,
    loadPresence,
    getGuestId,
    getChat,
    listOpenChats,
    listQueued,
    listActive,
    queuePosition,
    joinQueue,
    createChat,
    addMessage,
    acceptChat,
    closeChat,
    endChatByGuest,
    promoteNextInQueue,
    openFacebookWithMessage,
    copyText,
    facebookPageUrl,
    formatChatTranscript,
    broadcast,
  };
})();
