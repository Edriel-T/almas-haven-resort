# Firebase — production cloud sync

Availability, prices, room photos, and admin notes sync via **Firestore**.

- **Public site** → read-only cloud data  
- **Admin** → Firebase Email/Password on `admin.html` (never stored in git)

---

## Secrets (required — not in the repo)

GitHub blocks committed API keys. Values live only in **GitHub Actions secrets**.

### Add repository secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**

| Secret name | Value (from Firebase web config) |
|-------------|----------------------------------|
| `FIREBASE_API_KEY` | `apiKey` |
| `FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `FIREBASE_PROJECT_ID` | `projectId` |
| `FIREBASE_STORAGE_BUCKET` | `storageBucket` |
| `FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `FIREBASE_APP_ID` | `appId` |
| `FIREBASE_MEASUREMENT_ID` | `measurementId` (optional) |

On each push to `main`, the **Deploy GitHub Pages** workflow writes `js/firebase-config.js` into the deploy artifact only (not into git history).

### CLI (optional)

```bash
gh secret set FIREBASE_API_KEY
gh secret set FIREBASE_AUTH_DOMAIN
gh secret set FIREBASE_PROJECT_ID
gh secret set FIREBASE_STORAGE_BUCKET
gh secret set FIREBASE_MESSAGING_SENDER_ID
gh secret set FIREBASE_APP_ID
gh secret set FIREBASE_MEASUREMENT_ID
```

---

## Firebase Console checklist

1. **Authentication** → Email/Password enabled → create admin user  
2. **Firestore** rules:

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

3. **Authorized domains:** `almashaven.edrielcabansi.com`, `edriel-t.github.io`, `localhost`  
4. **Pages source:** GitHub Actions (workflow `deploy-pages.yml`)  
5. Restrict API key HTTP referrers to your domains (Google Cloud Console)

---

## Local testing

1. Copy `js/firebase-config.example.js` → fill values into `js/firebase-config.js`  
2. Do **not** commit real keys (`git status` should stay clean; empty stub is what git tracks)  
3. Prefer `git update-index --skip-worktree js/firebase-config.js` if you keep local keys in that file

---

## If GitHub reports a leaked secret

1. Remove keys from the repo (done via secrets + empty config)  
2. **Rotate** the key in Google Cloud Console if it was ever committed  
3. In GitHub Security alert: mark as **revoked** / resolved after rotate  
4. History may still be purged; rotate is the important step
