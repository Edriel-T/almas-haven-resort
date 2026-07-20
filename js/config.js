/**
 * Alma's Haven Resort — site configuration (home, gallery, Facebook, etc.)
 *
 * Room listings & room photos → edit js/rooms-config.js instead.
 * Load rooms-config.js AFTER this file on every page that needs rooms.
 */
window.ALMA_CONFIG = {
  resortName: "Alma's Haven Resort",
  location: "Dasol, 2411 Pangasinan",
  plusCode: "WQJJ+5M Dasol, Pangasinan",
  website: "https://almashaven.edrielcabansi.com",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=WQJJ%2B5M+Dasol+Pangasinan",
  rating: "4.9",
  reviewCount: 24,

  /**
   * Bookings are confirmed manually via Facebook Page messages.
   */
  facebookPageUrl: "https://web.facebook.com/profile.php?id=100057130492638",
  facebookPageId: "100057130492638",
  /**
   * Prefer Facebook profile Message (not m.me — Messenger app often fails/shuts down).
   * Guest opens the page, taps Message, pastes the copied booking text.
   */
  facebookMessengerUrl: "",

  /**
   * Admin panel password (admin.html).
   * Change this value — session lasts until browser tab is closed / log out.
   * Note: client-side only; for stronger security use a real backend later.
   */
  adminPassword: "almasadmin",

  /** Homepage hero photos */
  heroImages: [
    { src: "Images/Homepage image.jpg", alt: "Alma's Haven Resort beachfront" },
    { src: "Images/Homepage image01.jpg", alt: "Alma's Haven Resort view" },
  ],

  /**
   * Gallery browser — resort photos (home page).
   * Room-only photos are also listed here for browsing.
   */
  gallery: [
    { src: "Images/Homepage image.jpg", alt: "Resort beachfront", label: "Beachfront" },
    { src: "Images/Homepage image01.jpg", alt: "Resort shoreline", label: "Shore" },
    { src: "Images/Resort Exterior.jpg", alt: "Resort exterior", label: "Exterior" },
    { src: "Images/Resort Exterior01.jpg", alt: "Resort building", label: "Building" },
    { src: "Images/Gallery Images.jpg", alt: "Resort gallery", label: "Resort" },
    { src: "Images/Gallery Images01.jpg", alt: "Resort grounds", label: "Grounds" },
    { src: "Images/Gallery Images02.jpg", alt: "Resort surroundings", label: "Around the resort" },
    { src: "Images/Couple room.jpg", alt: "Couple room", label: "Couple room" },
    { src: "Images/Family room - 4pax.jpg", alt: "Family room 5 pax", label: "Family 5 pax" },
    { src: "Images/Family room - 4pax (01).jpg", alt: "Family room 5 pax interior", label: "Family 5 pax" },
    { src: "Images/Family room - 6pax.jpg", alt: "Family room 7 pax", label: "Family 7 pax" },
    { src: "Images/Family room - 6pax (01).jpg", alt: "Family room 7 pax interior", label: "Family 7 pax" },
    { src: "Images/Big room - 15pax.jpg", alt: "Big group room 15 pax", label: "Big room 15 pax" },
    { src: "Images/Big room - 15pax (01).jpg", alt: "Big group room interior", label: "Big room" },
    { src: "Images/Big room - 15pax (02).jpg", alt: "Big group room with balcony", label: "Big room · balcony" },
    { src: "Images/Kubo room - 5pax.jpg", alt: "Kubo room 5 pax", label: "Kubo room" },
  ],

  building: {
    floors: 3,
    notes: [
      "All rooms are air-conditioned",
      "Free cottage with every room booking",
      "Private CR on all rooms except Kubo",
      "Beachfront property",
      "Parking is in front of your room",
      "1 of the 2 big rooms has a balcony",
    ],
  },

  /** Filled by js/rooms-config.js — do not list rooms here */
  rooms: [],

  whatsappNumber: "",
  contactEmail: "",
  formspreeEndpoint: "",
  webhookUrl: "",

  storageKey: "almas_haven_inbox_v1",
  chatHistoryKey: "almas_haven_chat_v1",
};
