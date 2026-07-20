# Production go-live checklist

Live site: **https://almashaven.edrielcabansi.com/**

## 1. Secrets (never commit)

GitHub → **Settings → Secrets and variables → Actions** must include:

| Secret | Required |
|--------|----------|
| `FIREBASE_API_KEY` | Yes |
| `FIREBASE_AUTH_DOMAIN` | Yes |
| `FIREBASE_PROJECT_ID` | Yes |
| `FIREBASE_STORAGE_BUCKET` | Yes |
| `FIREBASE_MESSAGING_SENDER_ID` | Yes |
| `FIREBASE_APP_ID` | Yes |
| `FIREBASE_MEASUREMENT_ID` | Optional |

Deploy injects these into `js/firebase-config.js` only on the live site.  
The git copy of `js/firebase-config.js` stays empty.

### Restrict the Firebase browser API key

Google Cloud Console → **APIs & Services → Credentials** → your browser key:

- Application restrictions: **HTTP referrers**
  - `https://almashaven.edrielcabansi.com/*`
  - `https://edriel-t.github.io/*` (if still used)
- API restrictions: enable only **Identity Toolkit**, **Token Service**, **Firebase** / Firestore APIs you use

Firebase web API keys are visible in the browser by design — restriction + Auth + Firestore rules is the real protection.

### Firestore rules (publish these)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /almaHaven/{doc} {
      allow read: if true;

      // Guests (anonymous): live chat + inbox only
      allow write: if request.auth != null &&
        doc in ['liveChats', 'livePresence', 'inbox'];

      // Staff (email/password): all resort data
      allow write: if request.auth != null &&
        request.auth.token.firebase.sign_in_provider != 'anonymous';
    }
  }
}
```

### Auth

- Email/Password enabled  
- Anonymous enabled (live chat)  
- Admin user created  
- Authorized domains: `almashaven.edrielcabansi.com`, `localhost`

## 2. Deploy

Push to `main` or run **Actions → Deploy GitHub Pages**.  
Build **fails** if Firebase secrets are missing (prevents shipping a broken cloud site).

Public deploy **excludes**: `FIREBASE.md`, `PRODUCTION.md`, `README.md`, `docs/`, example config.

## 3. SEO / Google ranking

1. [Google Search Console](https://search.google.com/search-console) → add property `https://almashaven.edrielcabansi.com/`
2. Verify ownership (DNS or HTML tag)
3. Submit sitemap: `https://almashaven.edrielcabansi.com/sitemap.xml`
4. Request indexing for `/`, `/rooms.html`, `/location.html`
5. Keep **Google Business Profile** for Alma's Haven Resort (Dasol) updated — local pack ranking depends on this more than the website alone
6. Share pages on Facebook (OG tags already set)

### What the site already does for SEO

- Unique titles & meta descriptions per page  
- Canonical URLs  
- Open Graph / Twitter cards  
- `robots.txt` allows public pages, blocks admin  
- `sitemap.xml` with priorities + image hints  
- JSON-LD: LodgingBusiness, WebSite, FAQ, rooms offers  
- Local geo meta (Pangasinan / Dasol)  
- Fast static hosting on HTTPS  

Ranking takes time; content + GBP + reviews drive “resort Dasol” queries.

## 4. Admin security

- No public nav link to admin  
- `noindex` + `robots.txt` disallow  
- Production login = **Firebase Auth only** (no shared local password on live site)  
- First sign-in forces password change  
- Sign out when done on shared devices  

## 5. Smoke test after deploy

- [ ] Homepage loads, calendar shows  
- [ ] Rooms / gallery / FAQ / location  
- [ ] Book on Facebook still works  
- [ ] Admin sign-in (Firebase)  
- [ ] Live agent online + guest chat  
- [ ] Ended chat appears in Inbox  
- [ ] View source: `firebase-config.js` has apiKey only from deploy (not in git history)  
