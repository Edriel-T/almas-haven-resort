# Firebase setup — Alma's Haven (cloud sync)

This connects **availability, prices, room photos, and admin notes** so every phone and computer sees the same data on the live site.

Without Firebase, data stays only in that browser.

---

## 1. Create a Firebase project

1. Open [Firebase Console](https://console.firebase.google.com/)
2. **Add project** → name it e.g. `almas-haven`
3. Google Analytics: optional (you can disable)
4. Create the project

---

## 2. Register a Web app

1. Project Overview → **</> Web**
2. App nickname: `Alma Haven site`
3. Copy the `firebaseConfig` values (apiKey, authDomain, projectId, …)

---

## 3. Enable Authentication

1. **Build → Authentication → Get started**
2. Sign-in method → **Email/Password** → Enable → Save
3. **Users → Add user**
   - Email: e.g. `admin@yourdomain.com` (can be any email you control)
   - Password: choose a strong password  
   - Save these — you will put them in `js/config.js`

---

## 4. Create Firestore database

1. **Build → Firestore Database → Create database**
2. Start in **production mode**
3. Pick a region close to the Philippines (e.g. `asia-southeast1` if available)

### Security rules

Open **Firestore → Rules** and paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /almaHaven/{doc} {
      // Anyone can read (homepage calendar)
      allow read: if true;
      // Only signed-in admin can write
      allow write: if request.auth != null;
    }
  }
}
```

Click **Publish**.

---

## 5. Paste config into the site

Edit `js/config.js` → `firebase` section:

```js
firebase: {
  apiKey: "AIza…",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc…",
  adminEmail: "admin@yourdomain.com",
  adminPassword: "your-firebase-auth-password",
},
```

Then commit and push so GitHub Pages updates.

---

## 6. How to use day to day

1. Open **admin.html** on any device  
2. Sign in with the site password (`almasadmin` unless you changed it)  
3. Wait for badge: **Cloud: synced**  
4. Assign guests / edit prices / photos as usual  
5. Open the **homepage on another phone** → calendar should match  

Public visitors only **read** cloud data. They never need a password.

---

## Status badge (admin)

| Badge | Meaning |
|--------|---------|
| Cloud: synced | Admin can write; all devices get updates |
| Cloud: off (local only) | Firebase not configured in `config.js` |
| Cloud: connecting… | Still loading |
| Toast: sign-in failed | Wrong `adminEmail` / `adminPassword` or Auth not enabled |

---

## Storage / cost

- Booking records are tiny text (kilobytes)
- Firebase free Spark plan is enough for a resort site
- Avoid uploading many huge base64 photos (prefer files under `Images/`)

---

## Privacy note

`adminEmail` / `adminPassword` live in the public JS file. That is normal for a simple static site, but:

- Use a **dedicated** email only for this
- Use a **unique** password (not your personal Google password)
- Firestore rules still block anonymous writes without Auth

For stronger security later, move admin writes to a small backend.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Other devices not updating | Confirm badge **Cloud: synced** when saving in admin |
| Permission denied | Publish the security rules above; create Auth user |
| Still local only | `apiKey` empty or not pushed to GitHub |
| Calendar empty on new phone | Admin must save at least once while **Cloud: synced** |
