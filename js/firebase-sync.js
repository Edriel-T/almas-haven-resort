/**
 * Firebase cloud sync for Alma's Haven.
 * Public: read-only listeners (availability, prices, photos).
 * Admin: after site login, signs into Firebase so writes sync to all devices.
 *
 * Falls back to localStorage only when Firebase is not configured or offline.
 */
(function () {
  const COLLECTION = "almaHaven";
  const DOC_KEYS = {
    stays: "stays",
    prices: "prices",
    photos: "photos",
    notes: "notes",
  };

  let app = null;
  let db = null;
  let auth = null;
  let ready = false;
  let writeReady = false;
  let initPromise = null;
  const unsubscribers = [];
  const applyingRemote = Object.create(null);

  function firebaseCfg() {
    return (window.ALMA_CONFIG && window.ALMA_CONFIG.firebase) || {};
  }

  function isConfigured() {
    const c = firebaseCfg();
    return Boolean(c && c.apiKey && c.projectId && c.appId);
  }

  function sdkReady() {
    return typeof firebase !== "undefined" && firebase.app && firebase.firestore && firebase.auth;
  }

  function status() {
    return {
      configured: isConfigured(),
      sdk: sdkReady(),
      ready,
      writeReady,
      user: auth && auth.currentUser ? auth.currentUser.email : null,
    };
  }

  function emitStatus() {
    window.dispatchEvent(new CustomEvent("alma:cloud-status", { detail: status() }));
  }

  async function init() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      if (!isConfigured()) {
        console.info("[AlmaCloud] Firebase not configured — using this browser only.");
        emitStatus();
        return false;
      }
      if (!sdkReady()) {
        console.warn("[AlmaCloud] Firebase SDK not loaded.");
        emitStatus();
        return false;
      }
      try {
        const c = firebaseCfg();
        if (!firebase.apps.length) {
          app = firebase.initializeApp({
            apiKey: c.apiKey,
            authDomain: c.authDomain,
            projectId: c.projectId,
            storageBucket: c.storageBucket || undefined,
            messagingSenderId: c.messagingSenderId || undefined,
            appId: c.appId,
          });
        } else {
          app = firebase.app();
        }
        db = firebase.firestore();
        auth = firebase.auth();
        // Optional: enable offline cache
        try {
          await db.enablePersistence({ synchronizeTabs: true });
        } catch {
          /* multi-tab or unsupported — ignore */
        }
        ready = true;
        startPublicListeners();
        emitStatus();
        console.info("[AlmaCloud] Connected — data syncs across devices.");
        return true;
      } catch (err) {
        console.error("[AlmaCloud] Init failed:", err);
        ready = false;
        emitStatus();
        return false;
      }
    })();
    return initPromise;
  }

  function startPublicListeners() {
    // Stays — homepage + admin calendar
    unsubscribers.push(
      listen(DOC_KEYS.stays, (data) => {
        if (!data || !Array.isArray(data.stays)) return;
        applyingRemote.stays = true;
        try {
          localStorage.setItem("almas_haven_stays_v1", JSON.stringify(data));
          window.dispatchEvent(new CustomEvent("alma:availability-updated"));
        } finally {
          applyingRemote.stays = false;
        }
      })
    );

    // Prices
    unsubscribers.push(
      listen(DOC_KEYS.prices, (data) => {
        if (!data || typeof data !== "object") return;
        applyingRemote.prices = true;
        try {
          localStorage.setItem("almas_haven_room_prices_v1", JSON.stringify(data));
          if (window.AlmaRoomPrices && window.AlmaRoomPrices.applyToConfig) {
            window.AlmaRoomPrices.applyToConfig();
          }
          window.dispatchEvent(new CustomEvent("alma:room-prices-updated"));
        } finally {
          applyingRemote.prices = false;
        }
      })
    );

    // Photos
    unsubscribers.push(
      listen(DOC_KEYS.photos, (data) => {
        if (!data || typeof data !== "object") return;
        applyingRemote.photos = true;
        try {
          localStorage.setItem("almas_haven_room_photos_v1", JSON.stringify(data));
          window.dispatchEvent(new CustomEvent("alma:room-photos-updated"));
        } finally {
          applyingRemote.photos = false;
        }
      })
    );

    // Admin notes (admin UI only needs this, but safe to cache everywhere)
    unsubscribers.push(
      listen(DOC_KEYS.notes, (data) => {
        if (!data || typeof data !== "object") return;
        applyingRemote.notes = true;
        try {
          localStorage.setItem("almas_haven_admin_notes_v1", JSON.stringify(data));
          window.dispatchEvent(new CustomEvent("alma:admin-notes-updated"));
        } finally {
          applyingRemote.notes = false;
        }
      })
    );
  }

  function listen(docId, onData) {
    if (!db) return () => {};
    return db
      .collection(COLLECTION)
      .doc(docId)
      .onSnapshot(
        (snap) => {
          if (!snap.exists) return;
          const payload = snap.data();
          if (payload && payload.data !== undefined) onData(payload.data);
        },
        (err) => console.warn("[AlmaCloud] Listener error:", docId, err.message)
      );
  }

  /**
   * Admin only — sign in so Firestore write rules allow updates.
   */
  async function signInAdmin() {
    await init();
    if (!ready || !auth) throw new Error("Firebase is not connected");
    const c = firebaseCfg();
    if (!c.adminEmail || !c.adminPassword) {
      throw new Error("Add firebase.adminEmail and firebase.adminPassword in js/config.js");
    }
    if (auth.currentUser && auth.currentUser.email === c.adminEmail) {
      writeReady = true;
      emitStatus();
      return auth.currentUser;
    }
    const cred = await auth.signInWithEmailAndPassword(c.adminEmail, c.adminPassword);
    writeReady = true;
    emitStatus();
    return cred.user;
  }

  async function signOutAdmin() {
    if (auth && auth.currentUser) {
      await auth.signOut();
    }
    writeReady = false;
    emitStatus();
  }

  /**
   * Push local document to Firestore (admin must be signed in).
   * Silent no-op if cloud not ready / applying remote / not signed in.
   */
  async function push(docId, data) {
    if (applyingRemote[docId]) return { ok: false, reason: "remote-apply" };
    if (!ready || !db) return { ok: false, reason: "not-ready" };
    if (!auth || !auth.currentUser) return { ok: false, reason: "not-signed-in" };
    try {
      await db
        .collection(COLLECTION)
        .doc(docId)
        .set(
          {
            data,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: auth.currentUser.email || "admin",
          },
          { merge: false }
        );
      return { ok: true };
    } catch (err) {
      console.error("[AlmaCloud] Push failed:", docId, err);
      return { ok: false, reason: err.message || "push-failed" };
    }
  }

  function pushStays(data) {
    return push(DOC_KEYS.stays, data);
  }
  function pushPrices(data) {
    return push(DOC_KEYS.prices, data);
  }
  function pushPhotos(data) {
    return push(DOC_KEYS.photos, data);
  }
  function pushNotes(data) {
    return push(DOC_KEYS.notes, data);
  }

  /** One-time upload of current local data after first admin cloud login */
  async function uploadLocalToCloud() {
    await signInAdmin();
    const results = {};
    try {
      const stays = localStorage.getItem("almas_haven_stays_v1");
      if (stays) results.stays = await pushStays(JSON.parse(stays));
    } catch {
      /* ignore */
    }
    try {
      const prices = localStorage.getItem("almas_haven_room_prices_v1");
      if (prices) results.prices = await pushPrices(JSON.parse(prices));
    } catch {
      /* ignore */
    }
    try {
      const photos = localStorage.getItem("almas_haven_room_photos_v1");
      if (photos) results.photos = await pushPhotos(JSON.parse(photos));
    } catch {
      /* ignore */
    }
    try {
      const notes = localStorage.getItem("almas_haven_admin_notes_v1");
      if (notes) results.notes = await pushNotes(JSON.parse(notes));
    } catch {
      /* ignore */
    }
    return results;
  }

  window.AlmaCloud = {
    COLLECTION,
    DOC_KEYS,
    init,
    isConfigured,
    status,
    signInAdmin,
    signOutAdmin,
    push,
    pushStays,
    pushPrices,
    pushPhotos,
    pushNotes,
    uploadLocalToCloud,
    isApplyingRemote(key) {
      return !!applyingRemote[key];
    },
  };

  // Auto-init for public + admin pages
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      init();
    });
  } else {
    init();
  }
})();
