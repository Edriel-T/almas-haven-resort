# Alma's Haven Resort — Website

**Live site:** https://almashaven.edrielcabansi.com/

Multi-page marketing site for **Alma's Haven Resort** (Dasol, Pangasinan) with:

- Pages: Home, About, Rooms, Reviews, Location, Staff Admin
- **Book now** popup with room details + **availability calendar**
- **Admin calendar** to mark dates available / booked / blocked / pending
- **FAQ chatbot** + live agent handoff
- Reservation notifications in Staff Inbox (+ optional email/webhook/WhatsApp)

## Pages

| Path | Purpose |
|------|---------|
| `index.html` | Home (gallery, dates, about) — rooms preview only |
| `rooms.html` | **Full room listing** (review rates & photos here) |
| `about.html` | About & amenities |
| `reviews.html` | Guest reviews |
| `location.html` | Map & directions |
| `admin.html` | **Password-protected** — availability calendar, room photos, inbox (no public link) |

## Edit rooms & images (separate from home)

| Path | Purpose |
|------|---------|
| `js/rooms-config.js` | **All room data** — prices, pax, amenities, image paths |
| `Images/` | Photo files (e.g. `Couple room.jpg`) |
| `js/rooms-render.js` | How room cards are drawn |
| `js/config.js` | Site-wide settings + gallery (not room list) |

To change the couple room photo: replace `Images/Couple room.jpg` or update the path in `js/rooms-config.js` for `id: "1f-couple"`.

### Admin (private)

- URL: `admin.html` (not linked on the public site)
- **Production:** sign in with Firebase admin email/password (see [FIREBASE.md](FIREBASE.md))
- **Availability:** click a date → assign guests per room unit (check-in / check-out)
- Prices, room photos, and notes sync through Firebase when signed in

### Cloud sync

Homepage calendar and admin data use **Firebase Firestore** so phones, PCs, and guests see the same availability.  
Setup checklist: **[FIREBASE.md](FIREBASE.md)**. Auth passwords are never committed to this repository.

## SEO (make the site findable)

| File | Purpose |
|------|---------|
| `robots.txt` | Allows Google to index public pages; blocks admin |
| `sitemap.xml` | List of pages for search engines |
| Meta / Open Graph | Better titles, descriptions, Facebook/Twitter share previews |
| JSON-LD | Resort business data (home) + FAQ schema (faq page) |

### Submit to Google (recommended)
1. Go to [Google Search Console](https://search.google.com/search-console)
2. Add property: `https://almashaven.edrielcabansi.com/`
3. Submit sitemap: `https://almashaven.edrielcabansi.com/sitemap.xml`
4. Request indexing for the homepage

Also keep your **Google Business Profile** for the resort updated and linked — that helps local search (“resort Dasol”) more than the website alone.

## Other JS

| Path | Purpose |
|------|---------|
| `css/styles.css` | Styles |
| `js/availability.js` | Calendar availability storage |
| `js/booking.js` | Name + dates form → Facebook message |
| `js/admin.js` | Staff admin logic |
| `js/chatbot.js` | FAQ bot |
| `js/notifications.js` | Inbox + alerts |
| `js/site.js` | Shared nav / toast |

## Local preview

Open `index.html` in a browser, or serve the folder:

```bash
# Python
python -m http.server 8080

# Node
npx serve .
```

Then visit `http://localhost:8080` and the staff page at `/admin.html`.

## Configure notifications

Edit `js/config.js`:

1. **`whatsappNumber`** — PH number with country code, digits only (e.g. `63917xxxxxxx`). Enables WhatsApp handoff after a request.
2. **`contactEmail`** — shown in bot answers if set.
3. **`formspreeEndpoint`** — free form endpoint (e.g. `https://formspree.io/f/xxxx`) to email the team.
4. **`webhookUrl`** — Slack / Discord / Make.com / n8n URL for real-time alerts.

Requests are always stored in **browser `localStorage`** so `admin.html` works offline on the same device/browser. For multi-device staff alerts, use Formspree or a webhook.

## How the FAQ bot works

- Matches guest messages to a resort knowledge base (rates, check-in, location, amenities, bookings, reviews).
- Guests can say **“talk to a live agent”** or use **Request live agent**.
- That opens a short form; submitting creates an inbox item and fires optional webhooks/email/WhatsApp.
- Reservation form on the landing page does the same with type `reservation`.

## Deploy

Upload the whole folder to your host for  
`https://almashaven.edrielcabansi.com`  
(static hosting is enough — no Node server required).

## Notes

- Rating and review copy are based on Google Maps public info (4.9★ · 24 reviews, Dasol).
- Add real phone/email/WhatsApp in `config.js` before going live.
- Photos: replace the CSS hero gradient with real resort images when you have assets.
