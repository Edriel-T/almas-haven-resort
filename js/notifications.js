/**
 * Notification + inbox system for reservations & live-agent requests.
 * Stores locally + syncs to Firestore when available (so admin sees ended chats from any device).
 */
(function () {
  const cfg = () => window.ALMA_CONFIG || {};
  const channelName = "almas-haven-inbox";
  const FS_INBOX = "inbox";
  let cloudListening = false;
  let applyingRemote = false;

  function loadInbox() {
    try {
      const raw = localStorage.getItem(cfg().storageKey || "almas_haven_inbox_v1");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveInbox(items, options) {
    const list = Array.isArray(items) ? items.slice(0, 200) : [];
    localStorage.setItem(cfg().storageKey || "almas_haven_inbox_v1", JSON.stringify(list));
    try {
      const bc = new BroadcastChannel(channelName);
      bc.postMessage({ type: "inbox-updated", items: list });
      bc.close();
    } catch {
      /* BroadcastChannel not available */
    }
    window.dispatchEvent(new CustomEvent("alma:inbox-updated", { detail: { items: list } }));
    if (!applyingRemote && !(options && options.skipCloud)) {
      pushInboxCloud(list);
    }
  }

  function cloudReady() {
    return (
      window.AlmaCloud &&
      window.AlmaCloud.isConfigured() &&
      typeof firebase !== "undefined" &&
      firebase.firestore
    );
  }

  async function ensureAuth() {
    if (!cloudReady()) return false;
    try {
      await window.AlmaCloud.init();
      if (!firebase.apps.length) return false;
      if (firebase.auth().currentUser) return true;
      if (window.AlmaCloud.waitForAuth) {
        const u = await window.AlmaCloud.waitForAuth(2000);
        if (u) return true;
      }
      await firebase.auth().signInAnonymously();
      return !!firebase.auth().currentUser;
    } catch {
      return false;
    }
  }

  function pushInboxCloud(items) {
    if (!cloudReady()) return;
    ensureAuth().then((ok) => {
      if (!ok) return;
      firebase
        .firestore()
        .collection("almaHaven")
        .doc(FS_INBOX)
        .set({
          data: items,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        })
        .catch((err) => console.warn("[Inbox] cloud push:", err.message));
    });
  }

  async function startCloudSync() {
    if (cloudListening || !cloudReady()) return;
    try {
      await window.AlmaCloud.init();
      if (!firebase.apps.length) return;
      cloudListening = true;
      firebase
        .firestore()
        .collection("almaHaven")
        .doc(FS_INBOX)
        .onSnapshot(
          (snap) => {
            if (!snap.exists) return;
            const payload = snap.data();
            const data = payload && payload.data !== undefined ? payload.data : payload;
            if (!Array.isArray(data)) return;
            applyingRemote = true;
            try {
              saveInbox(data, { skipCloud: true });
            } finally {
              applyingRemote = false;
            }
          },
          (err) => console.warn("[Inbox] listener:", err.message)
        );
    } catch (err) {
      console.warn("[Inbox] cloud sync failed:", err && err.message);
      cloudListening = false;
    }
  }

  function uid() {
    return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  async function postWebhook(payload) {
    const url = cfg().webhookUrl;
    if (!url) return { ok: false, skipped: true };
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return { ok: res.ok };
    } catch (err) {
      console.warn("Webhook failed", err);
      return { ok: false, error: err };
    }
  }

  async function postFormspree(payload) {
    const url = cfg().formspreeEndpoint;
    if (!url) return { ok: false, skipped: true };
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          _subject: `[Alma's Haven] ${payload.type}: ${payload.name || "Guest"}`,
          ...payload,
        }),
      });
      return { ok: res.ok };
    } catch (err) {
      console.warn("Formspree failed", err);
      return { ok: false, error: err };
    }
  }

  function openWhatsApp(payload) {
    const num = (cfg().whatsappNumber || "").replace(/\D/g, "");
    if (!num) return false;
    const lines = [
      `Hello Alma's Haven!`,
      `Type: ${payload.type}`,
      payload.name ? `Name: ${payload.name}` : null,
      payload.contact ? `Contact: ${payload.contact}` : null,
      payload.topic ? `Topic: ${payload.topic}` : null,
      payload.checkin ? `Check-in: ${payload.checkin}` : null,
      payload.checkout ? `Check-out: ${payload.checkout}` : null,
      payload.guests ? `Guests: ${payload.guests}` : null,
      payload.message ? `Message: ${payload.message}` : null,
    ].filter(Boolean);
    const text = encodeURIComponent(lines.join("\n"));
    window.open(`https://wa.me/${num}?text=${text}`, "_blank", "noopener");
    return true;
  }

  function requestBrowserPermission() {
    if (!("Notification" in window)) return Promise.resolve("unsupported");
    if (Notification.permission === "granted") return Promise.resolve("granted");
    if (Notification.permission === "denied") return Promise.resolve("denied");
    return Notification.requestPermission();
  }

  function showBrowserNotification(title, body) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    try {
      const n = new Notification(title, {
        body,
        icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏝️</text></svg>",
        tag: "almas-haven-alert",
      });
      setTimeout(() => n.close(), 8000);
    } catch {
      /* ignore */
    }
  }

  function playAlertSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 880;
      g.gain.value = 0.04;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      setTimeout(() => {
        o.frequency.value = 1175;
      }, 120);
      setTimeout(() => {
        o.stop();
        ctx.close();
      }, 280);
    } catch {
      /* autoplay / audio blocked */
    }
  }

  /**
   * Create an inbox item and fan out notifications.
   * @param {object} data
   * @returns {Promise<object>}
   */
  async function notifyStaff(data) {
    const item = {
      id: data.id || uid(),
      chatId: data.chatId || "",
      type: data.type || "message",
      name: data.name || "",
      firstName: data.firstName || "",
      lastName: data.lastName || "",
      contact: data.contact || data.email || "",
      email: data.email || data.contact || "",
      topic: data.topic || "",
      message: data.message || "",
      checkin: data.checkin || "",
      checkout: data.checkout || "",
      guests: data.guests || "",
      channel: data.channel || "",
      roomType: data.roomType || "",
      endedBy: data.endedBy || "",
      read: false,
      createdAt: new Date().toISOString(),
    };

    const inbox = loadInbox();
    // Skip duplicates by id or same live-chat (guest end + agent end race)
    if (
      inbox.some(
        (i) =>
          i.id === item.id ||
          (item.chatId && i.chatId && i.chatId === item.chatId && i.type === "live_chat_ended")
      )
    ) {
      return { item, skipped: true };
    }
    inbox.unshift(item);
    saveInbox(inbox.slice(0, 200));

    const title =
      item.type === "reservation"
        ? "New reservation request"
        : item.type === "live_chat_ended"
          ? item.endedBy === "agent"
            ? "Live chat ended by agent"
            : item.endedBy === "guest"
              ? "Live chat ended by guest"
              : "Live chat ended"
          : "New inbox message";
    showBrowserNotification(
      title,
      `${item.name || "Guest"} — ${item.topic || item.type}${item.contact ? ` · ${item.contact}` : ""}`
    );
    playAlertSound();

    const [webhook, formspree] = await Promise.all([
      postWebhook(item),
      postFormspree(item),
    ]);

    return {
      item,
      webhook,
      formspree,
      whatsappAvailable: Boolean((cfg().whatsappNumber || "").replace(/\D/g, "")),
    };
  }

  function markRead(id) {
    const inbox = loadInbox().map((i) => (i.id === id ? { ...i, read: true } : i));
    saveInbox(inbox);
  }

  function markAllRead() {
    const inbox = loadInbox().map((i) => ({ ...i, read: true }));
    saveInbox(inbox);
  }

  function clearInbox() {
    saveInbox([]);
  }

  function unreadCount() {
    return loadInbox().filter((i) => !i.read).length;
  }

  // Boot cloud inbox when Firebase is available
  function bootCloud() {
    if (!cloudReady()) {
      setTimeout(bootCloud, 500);
      return;
    }
    startCloudSync();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootCloud);
  } else {
    bootCloud();
  }

  window.AlmaNotify = {
    loadInbox,
    saveInbox,
    notifyStaff,
    markRead,
    markAllRead,
    clearInbox,
    unreadCount,
    requestBrowserPermission,
    openWhatsApp,
    channelName,
    startCloudSync,
  };
})();
