/**
 * Live agent presence + queue + in-site chat.
 * Syncs via Firestore when Firebase is configured (works across devices).
 * Falls back to localStorage on the same browser only.
 *
 * Agent goes online in Admin; guests: name → need → queue / connect.
 * Offline guests → Facebook form.
 */
(function () {
  const PRESENCE_KEY = "almas_haven_agent_presence_v1";
  const CHATS_KEY = "almas_haven_live_chats_v1";
  const GUEST_ID_KEY = "almas_haven_guest_id_v1";
  const CHANNEL = "almas-haven-live-agent";
  const HEARTBEAT_MS = 12000;
  const ONLINE_TTL_MS = 35000;
  const FS_PRESENCE = "livePresence";
  const FS_CHATS = "liveChats";

  /** In-memory mirrors updated by Firestore listeners */
  let cloudPresence = null;
  let cloudChats = null;
  let cloudListening = false;
  let pushChatsTimer = null;
  let pushPresenceTimer = null;
  let lastPresencePushAt = 0;

  function buildRatesText() {
    const rooms = (window.ALMA_CONFIG && window.ALMA_CONFIG.rooms) || [];
    if (!rooms.length) {
      return [
        "Here are our room rates (price is per room, per night — not for all rooms combined):",
        "",
        "• 1st floor — Couple Room (up to 2 guests): ₱2,500 per room · 1 room available",
        "• 1st floor — Family Room (up to 5 guests): ₱3,500 per room · 3 rooms available",
        "• 2nd floor — Family Room (up to 7 guests): ₱4,000 per room · 4 rooms available",
        "• 3rd floor — Big Group Room (up to 15 guests): ₱9,000 per room · 2 rooms available (1 has a balcony)",
        "• Kubo Room (up to 5 guests): ₱3,500 per room · 1 room available (no private CR)",
        "",
        "All rooms are air-conditioned and include a free cottage.",
        "Private CR on all rooms except the kubo. Parking is in front of your room.",
      ].join("\n");
    }
    const lines = rooms.map((r) => {
      const extras = [];
      if (!r.privateCr) extras.push("no private CR");
      if (r.hasBalcony) extras.push("1 of these has a balcony");
      if (r.hasTv) extras.push("TV");
      if (r.hasRef) extras.push("refrigerator");
      const extra = extras.length ? ` · ${extras.join(", ")}` : "";
      const units =
        r.count === 1 ? "1 room available" : `${r.count} rooms available`;
      return `• ${r.floor} — ${r.name} (up to ${r.pax} guests): ₱${r.price.toLocaleString("en-PH")} per room · ${units}${extra}`;
    });
    return [
      "Here are our room rates (price is per room, per night — not for all rooms combined):",
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
        "• 1st floor: 3 family rooms (5 guests) and 1 couple room",
        "• 2nd floor: 4 family rooms (7 guests)",
        "• 3rd floor: 2 big group rooms (15 guests) — one has a balcony",
        "• Kubo: 1 room for 5 guests (no private CR)",
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

  function cloudReady() {
    return (
      window.AlmaCloud &&
      window.AlmaCloud.isConfigured() &&
      typeof firebase !== "undefined" &&
      firebase.firestore &&
      firebase.auth
    );
  }

  function getDb() {
    return firebase.firestore();
  }

  async function ensureAuthForWrite() {
    if (!cloudReady()) return false;
    try {
      await window.AlmaCloud.init();
      if (!firebase.apps.length) return false;
      const auth = firebase.auth();
      // Prefer existing session (admin email/password or guest anonymous)
      if (auth.currentUser) return true;
      // Wait briefly for restored admin session after refresh
      if (window.AlmaCloud.waitForAuth) {
        const user = await window.AlmaCloud.waitForAuth(2500);
        if (user) return true;
      }
      // Guests: anonymous auth so Firestore rules (auth != null) allow chat writes
      await auth.signInAnonymously();
      return !!auth.currentUser;
    } catch (err) {
      console.warn("[LiveAgent] Auth for cloud write failed:", err && err.message);
      return false;
    }
  }

  async function startCloudSync() {
    if (!cloudReady()) return false;
    try {
      await window.AlmaCloud.init();
      if (!firebase.apps.length) return false;
      const db = getDb();

      if (!cloudListening) {
        cloudListening = true;

        db.collection("almaHaven")
          .doc(FS_PRESENCE)
          .onSnapshot(
            (snap) => {
              if (!snap.exists) {
                // No presence doc yet — treat as offline until an agent goes online
                return;
              }
              const payload = snap.data();
              const p = payload && payload.data !== undefined ? payload.data : payload;
              if (!p || typeof p !== "object") return;
              cloudPresence = p;
              try {
                localStorage.setItem(PRESENCE_KEY, JSON.stringify(p));
              } catch {
                /* ignore */
              }
              broadcast("presence", p);
            },
            (err) => console.warn("[LiveAgent] Presence listener:", err.message)
          );

        db.collection("almaHaven")
          .doc(FS_CHATS)
          .onSnapshot(
            (snap) => {
              if (!snap.exists) return;
              const payload = snap.data();
              const chats =
                payload && payload.data !== undefined ? payload.data : payload;
              if (!chats || typeof chats !== "object") return;
              cloudChats = chats;
              try {
                localStorage.setItem(CHATS_KEY, JSON.stringify(chats));
              } catch {
                /* ignore */
              }
              broadcast("chats", null);
            },
            (err) => console.warn("[LiveAgent] Chats listener:", err.message)
          );

        console.info("[LiveAgent] Cloud sync active");
      }

      // One-time pull so a newly opened admin/guest page gets current status fast
      try {
        const snap = await db.collection("almaHaven").doc(FS_PRESENCE).get();
        if (snap.exists) {
          const payload = snap.data();
          const p = payload && payload.data !== undefined ? payload.data : payload;
          if (p && typeof p === "object") {
            cloudPresence = p;
            localStorage.setItem(PRESENCE_KEY, JSON.stringify(p));
            broadcast("presence", p);
          }
        }
      } catch (err) {
        console.warn("[LiveAgent] Presence pull:", err.message);
      }

      return true;
    } catch (err) {
      console.warn("[LiveAgent] Cloud sync failed:", err && err.message);
      cloudListening = false;
      return false;
    }
  }

  function pushPresenceCloud(p, immediate) {
    if (!cloudReady()) return;
    const run = () => {
      lastPresencePushAt = Date.now();
      ensureAuthForWrite().then((ok) => {
        if (!ok) {
          console.warn("[LiveAgent] Presence not pushed — not signed in");
          return;
        }
        getDb()
          .collection("almaHaven")
          .doc(FS_PRESENCE)
          .set({
            data: {
              online: !!p.online,
              name: p.name || "Resort agent",
              lastSeen: p.lastSeen || Date.now(),
            },
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          })
          .then(() => {
            /* ok */
          })
          .catch((err) => console.warn("[LiveAgent] Presence push:", err.message));
      });
    };
    if (immediate) {
      clearTimeout(pushPresenceTimer);
      run();
      return;
    }
    // Heartbeats: throttle cloud writes (still update local instantly)
    clearTimeout(pushPresenceTimer);
    const wait = Math.max(0, 4000 - (Date.now() - lastPresencePushAt));
    pushPresenceTimer = setTimeout(run, wait);
  }

  function pushChatsCloud(chats) {
    if (!cloudReady()) return;
    clearTimeout(pushChatsTimer);
    pushChatsTimer = setTimeout(() => {
      ensureAuthForWrite().then((ok) => {
        if (!ok) return;
        getDb()
          .collection("almaHaven")
          .doc(FS_CHATS)
          .set({
            data: chats,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          })
          .catch((err) => console.warn("[LiveAgent] Chats push:", err.message));
      });
    }, 120);
  }

  function loadPresence() {
    if (cloudPresence) return cloudPresence;
    try {
      return JSON.parse(localStorage.getItem(PRESENCE_KEY) || "null");
    } catch {
      return null;
    }
  }

  function savePresence(p, options) {
    const immediate = options && options.immediate;
    cloudPresence = p;
    try {
      localStorage.setItem(PRESENCE_KEY, JSON.stringify(p));
    } catch {
      /* ignore */
    }
    broadcast("presence", p);
    pushPresenceCloud(p, immediate);
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
    savePresence(
      {
        online: true,
        name: name || "Resort agent",
        lastSeen: Date.now(),
      },
      { immediate: true }
    );
    // Ensure listeners are running on this device
    startCloudSync();
  }

  function heartbeat() {
    const p = loadPresence();
    if (!p || !p.online) return;
    p.lastSeen = Date.now();
    // Throttled cloud write so all devices keep TTL fresh without spam
    savePresence(p, { immediate: false });
  }

  function goOffline() {
    const p = loadPresence() || {};
    savePresence(
      {
        ...p,
        online: false,
        lastSeen: Date.now(),
      },
      { immediate: true }
    );
  }

  function loadChats() {
    if (cloudChats && typeof cloudChats === "object") {
      return JSON.parse(JSON.stringify(cloudChats));
    }
    try {
      return JSON.parse(localStorage.getItem(CHATS_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function saveChats(chats) {
    cloudChats = chats;
    try {
      localStorage.setItem(CHATS_KEY, JSON.stringify(chats));
    } catch {
      /* ignore */
    }
    broadcast("chats", null);
    pushChatsCloud(chats);
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

  function listQueued() {
    return Object.values(loadChats())
      .filter((c) => c.status === "queued")
      .sort((a, b) => (a.queuedAt || a.createdAt || 0) - (b.queuedAt || b.createdAt || 0));
  }

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

  function joinQueue({ name, firstName, lastName, email, need, topic }) {
    // Kick off guest auth early so cloud writes work
    ensureAuthForWrite();

    const id = getGuestId();
    const chats = loadChats();
    const first = String(firstName || "").trim();
    const last = String(lastName || "").trim();
    const guestEmail = String(email || "").trim();
    const guestName =
      [first, last].filter(Boolean).join(" ") ||
      String(name || "Guest").trim() ||
      "Guest";
    const needText = String(need || "").trim();
    const topicLabel = topic || "help";

    let chat = chats[id];
    if (chat && (chat.status === "active" || chat.status === "queued")) {
      chat.guestName = guestName;
      chat.firstName = first || chat.firstName || "";
      chat.lastName = last || chat.lastName || "";
      chat.email = guestEmail || chat.email || "";
      chat.guestContact = guestEmail || chat.guestContact || "";
      if (needText) {
        chat.need = needText;
        chat.messages = chat.messages || [];
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
      firstName: first,
      lastName: last,
      email: guestEmail,
      guestContact: guestEmail,
      need: needText,
      topic: topicLabel,
      status,
      createdAt: now,
      queuedAt: now,
      updatedAt: now,
      messages: [],
    };

    if (status === "queued") {
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

    const position = status === "queued" ? queuePosition(id) : 0;
    if (status === "queued" && position > 0) {
      chat.messages[0].text = `Hi ${guestName}! You're #${position} in the queue. Please wait — an agent will take you when free.`;
      chats[id] = chat;
      saveChats(chats);
    }

    return { chat, position, promoted: status === "active" };
  }

  function addMessage(chatId, from, text) {
    ensureAuthForWrite();
    const chats = loadChats();
    const chat = chats[chatId];
    if (!chat) return null;
    if (chat.status === "closed") return chat;
    const msg = {
      id: uid("m"),
      from,
      text: String(text || "").trim(),
      at: Date.now(),
    };
    if (!msg.text) return chat;
    chat.messages = chat.messages || [];
    chat.messages.push(msg);
    chat.updatedAt = Date.now();
    chats[chatId] = chat;
    saveChats(chats);
    return chat;
  }

  function acceptChat(chatId) {
    ensureAuthForWrite();
    const chats = loadChats();
    const chat = chats[chatId];
    if (!chat) return null;
    chat.status = "active";
    chat.updatedAt = Date.now();
    chat.messages = chat.messages || [];
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
    const fullName =
      [chat.firstName, chat.lastName].filter(Boolean).join(" ") ||
      chat.guestName ||
      "Guest";
    const lines = [
      "— Live chat ended —",
      `Ended by: ${who === "guest" ? "Guest" : "Agent"}`,
      `Guest name: ${fullName}`,
      chat.firstName ? `First name: ${chat.firstName}` : null,
      chat.lastName ? `Last name: ${chat.lastName}` : null,
      chat.email || chat.guestContact
        ? `Email: ${chat.email || chat.guestContact}`
        : null,
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
    // Avoid duplicate inbox rows if both guest and agent devices close the same chat
    const inboxId = `live_end_${chat.id}`;
    try {
      const existing = window.AlmaNotify.loadInbox() || [];
      if (existing.some((i) => i.id === inboxId || i.chatId === chat.id)) return;
    } catch {
      /* ignore */
    }
    const transcript = formatChatTranscript(chat, who);
    const fullName =
      [chat.firstName, chat.lastName].filter(Boolean).join(" ") ||
      chat.guestName ||
      "Guest";
    window.AlmaNotify
      .notifyStaff({
        id: inboxId,
        chatId: chat.id,
        type: "live_chat_ended",
        name: fullName,
        firstName: chat.firstName || "",
        lastName: chat.lastName || "",
        contact: chat.email || chat.guestContact || "",
        email: chat.email || chat.guestContact || "",
        topic: chat.topic || "live_chat",
        message: transcript,
        channel: "live_chat",
      })
      .catch(() => {
        /* ignore */
      });
  }

  function closeChat(chatId, by) {
    ensureAuthForWrite();
    const chats = loadChats();
    if (!chats[chatId]) return;
    if (chats[chatId].status === "closed") return;
    const who = by === "guest" ? "guest" : "agent";
    chats[chatId].status = "closed";
    chats[chatId].updatedAt = Date.now();
    chats[chatId].messages = chats[chatId].messages || [];
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
    saveChatToInbox(closed, who);
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

  function createChat(opts) {
    const result = joinQueue({
      name: opts?.name,
      need: opts?.firstMessage || opts?.need,
      topic: opts?.topic,
    });
    return result.chat;
  }

  // Boot cloud listeners when Firebase is ready (retry until config/SDK load)
  let bootAttempts = 0;
  function bootCloud() {
    bootAttempts += 1;
    if (!cloudReady()) {
      if (bootAttempts < 40) setTimeout(bootCloud, 400);
      return;
    }
    startCloudSync();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootCloud);
  } else {
    bootCloud();
  }
  // Also retry after window load (firebase-config may inject late on some hosts)
  window.addEventListener("load", () => {
    setTimeout(bootCloud, 300);
  });

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
    startCloudSync,
  };
})();
