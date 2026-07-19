/**
 * Notification + inbox system for reservations & live-agent requests.
 * Stores locally for the Staff Inbox page, and optionally posts to webhooks / Formspree / WhatsApp.
 */
(function () {
  const cfg = () => window.ALMA_CONFIG || {};
  const channelName = "almas-haven-inbox";

  function loadInbox() {
    try {
      const raw = localStorage.getItem(cfg().storageKey || "almas_haven_inbox_v1");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveInbox(items) {
    localStorage.setItem(cfg().storageKey || "almas_haven_inbox_v1", JSON.stringify(items));
    try {
      const bc = new BroadcastChannel(channelName);
      bc.postMessage({ type: "inbox-updated", items });
      bc.close();
    } catch {
      /* BroadcastChannel not available */
    }
    window.dispatchEvent(new CustomEvent("alma:inbox-updated", { detail: { items } }));
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
      id: uid(),
      type: data.type || "message",
      name: data.name || "",
      contact: data.contact || "",
      topic: data.topic || "",
      message: data.message || "",
      checkin: data.checkin || "",
      checkout: data.checkout || "",
      guests: data.guests || "",
      channel: data.channel || "",
      roomType: data.roomType || "",
      read: false,
      createdAt: new Date().toISOString(),
    };

    const inbox = loadInbox();
    inbox.unshift(item);
    saveInbox(inbox.slice(0, 200));

    showBrowserNotification(
      item.type === "reservation" ? "New reservation request" : "Live agent requested",
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
  };
})();
