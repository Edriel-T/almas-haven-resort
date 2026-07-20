# Firebase — production cloud sync

Availability, prices, room photos, and admin notes sync across devices via **Firestore**.

- **Public site** → read-only cloud data (homepage calendar)
- **Admin** → sign in with Firebase **Email/Password** (not stored in the repo)

---

## One-time console setup

### 1. Authentication
1. Firebase Console → **Authentication** → Email/Password → **Enable**
2. **Users → Add user** → create your admin email + password  
   Keep this password private. You type it on `admin.html` only.

### 2. Firestore
1. **Firestore Database → Create** (production mode)
2. **Rules → Publish:**

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

### 3. Authorized domains
**Authentication → Settings → Authorized domains** — add:
- `almashaven.edrielcabansi.com`
- `edriel-t.github.io`
- `localhost` (for local testing)

### 4. API key restriction (recommended)
Google Cloud Console → APIs & Services → Credentials → your browser key:
- Application restrictions: **HTTP referrers**
- Allow: `https://almashaven.edrielcabansi.com/*` and `https://edriel-t.github.io/*`

---

## How staff use admin

1. Open `https://almashaven.edrielcabansi.com/admin.html`
2. Enter **Firebase admin email + password**
3. Badge shows **Cloud: synced**
4. Assign rooms / prices / photos — other devices update automatically

No passwords are written into the website source code.

---

## What is in the repo (public)

Only the normal Firebase **web app config** (`apiKey`, `projectId`, `appId`, …).  
That is expected for client apps. Security comes from **Auth + Firestore rules**, not from hiding the apiKey.

**Never commit:** Auth passwords, service account JSON, or private keys.

---

## Local-only fallback

If Firebase config is removed, admin falls back to the local site password in `config.js` (this browser only).
