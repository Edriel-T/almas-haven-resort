/**
 * Firebase cloud sync for Alma's Haven (Cloud Firestore).
 * Public: read-only listeners (availability, prices, photos).
 * Admin: after sign-in, writes sync to all devices.
 *
 * Falls back to localStorage when Firebase is not configured or offline.
 */
(function () {
  const COLLECTION = "almaHaven";
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
      firebase.firestore &&
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
      engine: "firestore",
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
        console.warn("[AlmaCloud] Firebase Auth/Firestore SDK not loaded.");
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
            measurementId: c.measurementId || undefined,
          });
        } else {
          app = firebase.app();
        }
        db = firebase.firestore();
        auth = firebase.auth();
        // Keep admin signed in across page refresh
        try {
          await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        } catch {
          /* ignore */
        }
        try {
          await db.enablePersistence({ synchronizeTabs: true });
        } catch {
          /* multi-tab / unsupported */
        }
        // Restore write access if Auth session still valid
        auth.onAuthStateChanged((user) => {
          writeReady = !!user;
          emitStatus();
        });
        ready = true;
        startPublicListeners();
        startLiveRefreshHooks();
        emitStatus();
        console.info("[AlmaCloud] Connected to Firestore — live sync across devices.");
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

  function notifyLocal(channelName, eventName) {
    window.dispatchEvent(new CustomEvent(eventName));
    try {
      const bc = new BroadcastChannel(channelName);
      bc.postMessage({ type: eventName });
      bc.close();
    } catch {
      /* ignore */
    }
  }

  function startPublicListeners() {
    unsubscribers.push(
      listen(DOC_KEYS.stays, (data) => {
        if (!data || !Array.isArray(data.stays)) return;
        applyingRemote.stays = true;
        try {
          localStorage.setItem("almas_haven_stays_v1", JSON.stringify(data));
          notifyLocal("almas-haven-availability", "alma:availability-updated");
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
          notifyLocal("almas-haven-prices", "alma:room-prices-updated");
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
          notifyLocal("almas-haven-photos", "alma:room-photos-updated");
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
          notifyLocal("almas-haven-notes", "alma:admin-notes-updated");
        } finally {
          applyingRemote.notes = false;
        }
      })
    );
  }

  /** Soft re-pull when tab becomes visible (covers rare listener gaps) */
  function startLiveRefreshHooks() {
    if (startLiveRefreshHooks._done) return;
    startLiveRefreshHooks._done = true;

    async function pullDoc(key, apply) {
      if (!db || !ready) return;
      try {
        const snap = await db.collection(COLLECTION).doc(key).get();
        if (!snap.exists) return;
        const payload = snap.data();
        const data = payload && payload.data !== undefined ? payload.data : payload;
        apply(data);
      } catch (err) {
        console.warn("[AlmaCloud] Refresh pull failed:", key, err.message);
      }
    }

    function refreshFromCloud() {
      pullDoc(DOC_KEYS.stays, (data) => {
        if (!data || !Array.isArray(data.stays)) return;
        applyingRemote.stays = true;
        try {
          localStorage.setItem("almas_haven_stays_v1", JSON.stringify(data));
          notifyLocal("almas-haven-availability", "alma:availability-updated");
        } finally {
          applyingRemote.stays = false;
        }
      });
      pullDoc(DOC_KEYS.prices, (data) => {
        if (!data || typeof data !== "object") return;
        applyingRemote.prices = true;
        try {
          localStorage.setItem("almas_haven_room_prices_v1", JSON.stringify(data));
          if (window.AlmaRoomPrices && window.AlmaRoomPrices.applyToConfig) {
            window.AlmaRoomPrices.applyToConfig();
          }
          notifyLocal("almas-haven-prices", "alma:room-prices-updated");
        } finally {
          applyingRemote.prices = false;
        }
      });
      pullDoc(DOC_KEYS.photos, (data) => {
        if (!data || typeof data !== "object") return;
        applyingRemote.photos = true;
        try {
          localStorage.setItem("almas_haven_room_photos_v1", JSON.stringify(data));
          notifyLocal("almas-haven-photos", "alma:room-photos-updated");
        } finally {
          applyingRemote.photos = false;
        }
      });
    }

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") refreshFromCloud();
    });
    window.addEventListener("online", refreshFromCloud);
    // Light safety net every 45s while page is open
    setInterval(() => {
      if (document.visibilityState === "visible") refreshFromCloud();
    }, 45000);
  }

  /**
   * Wait for Firebase Auth to restore persisted session (after refresh).
   */
  function waitForAuth(timeoutMs) {
    const ms = typeof timeoutMs === "number" ? timeoutMs : 8000;
    return new Promise((resolve) => {
      if (!auth) {
        resolve(null);
        return;
      }
      if (auth.currentUser) {
        writeReady = true;
        emitStatus();
        resolve(auth.currentUser);
        return;
      }
      let done = false;
      const finish = (user) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        unsub();
        writeReady = !!user;
        emitStatus();
        resolve(user || null);
      };
      const unsub = auth.onAuthStateChanged((user) => finish(user));
      const timer = setTimeout(() => finish(auth.currentUser || null), ms);
    });
  }

  function getCurrentUser() {
    return (auth && auth.currentUser) || null;
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
          else onData(payload);
        },
        (err) => console.warn("[AlmaCloud] Listener error:", docId, err && err.message)
      );
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
      const snap = await db.collection(COLLECTION).doc(DOC_KEYS.adminMeta).get();
      if (!snap.exists) return true;
      const payload = snap.data();
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
      await db
        .collection(COLLECTION)
        .doc(DOC_KEYS.adminMeta)
        .set({
          data: {
            passwordChanged: true,
            changedAt: new Date().toISOString(),
            changedBy: auth.currentUser.email || "admin",
          },
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedBy: auth.currentUser.email || "admin",
        });
    }
    emitStatus();
    return true;
  }

  async function push(docId, data) {
    if (applyingRemote[docId]) return { ok: false, reason: "remote-apply" };
    if (!ready || !db) return { ok: false, reason: "not-ready" };
    if (!auth || !auth.currentUser) return { ok: false, reason: "not-signed-in" };
    try {
      await db
        .collection(COLLECTION)
        .doc(docId)
        .set({
          data,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedBy: auth.currentUser.email || "admin",
        });
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
    COLLECTION,
    DOC_KEYS,
    init,
    isConfigured,
    status,
    signInAdmin,
    signOutAdmin,
    waitForAuth,
    getCurrentUser,
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
