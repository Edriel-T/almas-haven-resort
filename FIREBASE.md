# Firebase â€” production cloud sync

Availability, prices, room photos, and admin notes sync via **Firestore**.

- **Public site** â†’ read-only cloud data  
- **Admin** â†’ Firebase Email/Password on `admin.html` (never stored in git)

---

## Secrets (required â€” not in the repo)

GitHub blocks committed API keys. Values live only in **GitHub Actions secrets**.

### Add repository secrets

Repo â†’ **Settings â†’ Secrets and variables â†’ Actions â†’ New repository secret**

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

1. **Authentication** â†’ Email/Password enabled â†’ create admin user  
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

### First admin sign-in

1. Open `admin.html`
2. Sign in with your Firebase Authentication user
3. You **must set a new password** (minimum 8 characters) on first access
4. That becomes your permanent login password

### Deploy workflow example

Copy `docs/deploy-pages.yml.example` to `.github/workflows/deploy-pages.yml` on GitHub (web UI), then set Pages source to **GitHub Actions**. Secrets are already stored in the repo.

## Local testing

1. Copy `js/firebase-config.example.js` â†’ fill values into `js/firebase-config.js`  
2. Do **not** commit real keys (`git status` should stay clean; empty stub is what git tracks)  
3. Prefer `git update-index --skip-worktree js/firebase-config.js` if you keep local keys in that file

---

## If GitHub reports a leaked secret

1. Remove keys from the repo (done via secrets + empty config)  
2. **Rotate** the key in Google Cloud Console if it was ever committed  
3. In GitHub Security alert: mark as **revoked** / resolved after rotate  
4. History may still be purged; rotate is the important step

