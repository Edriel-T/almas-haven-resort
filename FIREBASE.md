# Firebase — Cloud Firestore sync

This site uses **Firebase Authentication** + **Cloud Firestore** (not Realtime Database).

---

## Firestore security rules (required)

Firebase Console → **Firestore Database → Rules** → Publish:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /almaHaven/{doc} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

- Everyone can **read** (homepage calendar)  
- Only signed-in admin can **write**

---

## Authentication

1. **Authentication → Sign-in method → Email/Password → Enable**  
2. **Authentication → Sign-in method → Anonymous → Enable**  
   (Required for live chat: guests write messages without a staff account)  
3. **Users → Add user** (admin email + password)  
4. **Authorized domains:** `almashaven.edrielcabansi.com`, `edriel-t.github.io`, `localhost`

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
| `FIREBASE_AUTH_DOMAIN` | `….firebaseapp.com` |
| `FIREBASE_PROJECT_ID` | `almas-haven-c1998` |
| `FIREBASE_STORAGE_BUCKET` | storage bucket |
| `FIREBASE_MESSAGING_SENDER_ID` | sender id |
| `FIREBASE_APP_ID` | app id |
| `FIREBASE_MEASUREMENT_ID` | optional |

`FIREBASE_DATABASE_URL` is **not** needed for Firestore (Realtime Database only).

Deploy workflow injects secrets into live `js/firebase-config.js` (see `docs/deploy-pages.yml.example`).

---

## Data layout in Firestore

Collection `almaHaven` documents:

- `stays` — guest occupancy  
- `prices` — room price overrides  
- `photos` — room photo overrides  
- `notes` — admin notes (if used)  
- `adminMeta` — first-login password flag  
- `livePresence` — live agent online / offline  
- `liveChats` — live agent queue and messages  

**Live chat:** Enable **Anonymous** sign-in so guests can send messages under the rule `allow write: if request.auth != null`.

---

## Optional: turn off Realtime Database

If you no longer use RTDB:

1. Firebase Console → **Realtime Database**  
2. You can leave it empty or disable / delete when ready  
3. Do **not** use RTDB rules for this website anymore  

---

## API key restriction (recommended)

Google Cloud → Credentials → Browser key → HTTP referrers:

- `https://almashaven.edrielcabansi.com/*`
- `https://edriel-t.github.io/*`
