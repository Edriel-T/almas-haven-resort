# Alma's Haven Resort — Website

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
- Default password: set `adminPassword` in `js/config.js` (default `almasadmin`)
- **Availability:** pick room → set day to “Not available” → click calendar dates (red for guests)
- **Room photos:** paths under `Images/`, one per line — shown when guests click a room card

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
`https://almashavenresort.edrielcabansi.com`  
(static hosting is enough — no Node server required).

## Notes

- Rating and review copy are based on Google Maps public info (4.9★ · 24 reviews, Dasol).
- Add real phone/email/WhatsApp in `config.js` before going live.
- Photos: replace the CSS hero gradient with real resort images when you have assets.
