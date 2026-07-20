/**
 * Firebase cloud sync for Alma's Haven (Realtime Database).
 * Public: read-only listeners (availability, prices, photos).
 * Admin: after sign-in, writes sync to all devices.
 *
 * Falls back to localStorage when Firebase is not configured or offline.
 */
(function () {
  const ROOT = "almaHaven";
  const DOC_KEYS = {
    stays: "stays",
    prices: "prices",
    photos: "photos",
    notes: "notes",
    adminMeta: "adminMeta",
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
    const injected = window.ALMA_FIREBASE || {};
    const fromConfig = (window.ALMA_CONFIG && window.ALMA_CONFIG.firebase) || {};
    return Object.assign({}, fromConfig, injected);
  }

  function isConfigured() {
    const c = firebaseCfg();
    return Boolean(c && c.apiKey && c.projectId && c.appId);
  }

  function sdkReady() {
    return (
      typeof firebase !== "undefined" &&
      firebase.app &&
      firebase.database &&
      firebase.auth
    );
  }

  function status() {
    return {
      configured: isConfigured(),
      sdk: sdkReady(),
      ready,
      writeReady,
      user: auth && auth.currentUser ? auth.currentUser.email : null,
      engine: "rtdb",
    };
  }

  function emitStatus() {
    window.dispatchEvent(new CustomEvent("alma:cloud-status", { detail: status() }));
  }

  function pathFor(key) {
    return `${ROOT}/${key}`;
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
        console.warn("[AlmaCloud] Firebase Auth/Database SDK not loaded.");
        emitStatus();
        return false;
      }
      try {
        const c = firebaseCfg();
        const databaseURL =
          c.databaseURL ||
          (c.projectId
            ? `https://${c.projectId}-default-rtdb.asia-southeast1.firebasedatabase.app`
            : "");
        if (!firebase.apps.length) {
          app = firebase.initializeApp({
            apiKey: c.apiKey,
            authDomain: c.authDomain,
            projectId: c.projectId,
            storageBucket: c.storageBucket || undefined,
            messagingSenderId: c.messagingSenderId || undefined,
            appId: c.appId,
            databaseURL: databaseURL || undefined,
            measurementId: c.measurementId || undefined,
          });
        } else {
          app = firebase.app();
        }
        db = firebase.database();
        auth = firebase.auth();
        ready = true;
        startPublicListeners();
        emitStatus();
        console.info("[AlmaCloud] Connected to Realtime Database — data syncs across devices.");
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

  function listen(key, onData) {
    if (!db) return () => {};
    const ref = db.ref(pathFor(key));
    const handler = (snap) => {
      const payload = snap.val();
      if (payload == null) return;
      if (payload.data !== undefined) onData(payload.data);
      else onData(payload);
    };
    ref.on("value", handler, (err) => {
      console.warn("[AlmaCloud] Listener error:", key, err && err.message);
    });
    return () => ref.off("value", handler);
  }

  async function signInAdmin(email, password) {
    await init();
    if (!ready || !auth) throw new Error("Firebase is not connected");
    const mail = String(email || "").trim();
    const pass = String(password || "");
    if (!mail || !pass) {
      throw new Error("Enter your Firebase admin email and password");
    }
    if (auth.currentUser && auth.currentUser.email === mail) {
      writeReady = true;
      emitStatus();
      return auth.currentUser;
    }
    const cred = await auth.signInWithEmailAndPassword(mail, pass);
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

  async function mustChangePassword() {
    if (!ready || !db || !auth || !auth.currentUser) return false;
    try {
      const snap = await db.ref(pathFor(DOC_KEYS.adminMeta)).once("value");
      if (!snap.exists()) return true;
      const payload = snap.val();
      const data = payload && payload.data !== undefined ? payload.data : payload;
      return !(data && data.passwordChanged === true);
    } catch (err) {
      console.warn("[AlmaCloud] mustChangePassword check failed:", err.message);
      return true;
    }
  }

  async function changeAdminPassword(newPassword) {
    if (!auth || !auth.currentUser) throw new Error("Not signed in");
    const pass = String(newPassword || "");
    if (pass.length < 8) throw new Error("Password must be at least 8 characters");
    await auth.currentUser.updatePassword(pass);
    writeReady = true;
    if (db) {
      await db.ref(pathFor(DOC_KEYS.adminMeta)).set({
        data: {
          passwordChanged: true,
          changedAt: new Date().toISOString(),
          changedBy: auth.currentUser.email || "admin",
        },
        updatedAt: Date.now(),
        updatedBy: auth.currentUser.email || "admin",
      });
    }
    emitStatus();
    return true;
  }

  async function push(key, data) {
    if (applyingRemote[key]) return { ok: false, reason: "remote-apply" };
    if (!ready || !db) return { ok: false, reason: "not-ready" };
    if (!auth || !auth.currentUser) return { ok: false, reason: "not-signed-in" };
    try {
      await db.ref(pathFor(key)).set({
        data,
        updatedAt: Date.now(),
        updatedBy: auth.currentUser.email || "admin",
      });
      return { ok: true };
    } catch (err) {
      console.error("[AlmaCloud] Push failed:", key, err);
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

  async function uploadLocalToCloud() {
    if (!auth || !auth.currentUser) {
      throw new Error("Sign in as admin first");
    }
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
    ROOT,
    COLLECTION: ROOT,
    DOC_KEYS,
    init,
    isConfigured,
    status,
    signInAdmin,
    signOutAdmin,
    mustChangePassword,
    changeAdminPassword,
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      init();
    });
  } else {
    init();
  }
})();
