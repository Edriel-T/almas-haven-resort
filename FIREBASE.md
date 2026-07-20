# Firebase — Realtime Database cloud sync

This site uses **Firebase Authentication** + **Realtime Database** (not Firestore).

Your database URL:

`https://almas-haven-c1998-default-rtdb.asia-southeast1.firebasedatabase.app`

---

## Realtime Database rules (required)

Firebase Console → **Realtime Database → Rules** → Publish:

```json
{
  "rules": {
    "almaHaven": {
      ".read": true,
      ".write": "auth != null"
    }
  }
}
```

- Everyone can **read** (homepage calendar)  
- Only signed-in admin can **write**

---

## Authentication

1. **Authentication → Sign-in method → Email/Password → Enable**  
2. **Users → Add user** (admin email + password)  
3. **Authorized domains:** `almashaven.edrielcabansi.com`, `edriel-t.github.io`, `localhost`

---

## First admin sign-in

1. Open `admin.html`  
2. Sign in with Firebase email + password  
3. **Set a new password** (required once, min 8 characters)  
4. Badge should show **Cloud: synced**

---

## GitHub secrets

| Secret | Value |
|--------|--------|
| `FIREBASE_API_KEY` | from web config |
| `FIREBASE_AUTH_DOMAIN` | `…firebaseapp.com` |
| `FIREBASE_PROJECT_ID` | `almas-haven-c1998` |
| `FIREBASE_STORAGE_BUCKET` | storage bucket |
| `FIREBASE_MESSAGING_SENDER_ID` | sender id |
| `FIREBASE_APP_ID` | app id |
| `FIREBASE_MEASUREMENT_ID` | optional |
| `FIREBASE_DATABASE_URL` | `https://almas-haven-c1998-default-rtdb.asia-southeast1.firebasedatabase.app` |

Deploy workflow injects these into live `js/firebase-config.js` (see `docs/deploy-pages.yml.example`).

---

## Data layout in RTDB

```
almaHaven/
  stays/
  prices/
  photos/
  notes/
  adminMeta/
```

---

## API key restriction (recommended)

Google Cloud → Credentials → Browser key → HTTP referrers:

- `https://almashaven.edrielcabansi.com/*`
- `https://edriel-t.github.io/*`
