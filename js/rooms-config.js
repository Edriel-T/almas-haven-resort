/**
 * ============================================================
 * ROOMS CONFIG — edit this file to update room listings & photos
 * ============================================================
 * Used by: rooms.html (full list) and booking / calendar / FAQ.
 *
 * How to change a room photo:
 *  1. Put the file in /Images (e.g. Images/Couple room.jpg)
 *  2. Update the "image" path below (and "images" array if needed)
 *
 * How to change price / pax / amenities:
 *  Edit the matching room object only — leave "id" the same.
 *
 * Load order: after js/config.js
 * ============================================================
 */
(function () {
  const rooms = [
    {
      id: "1f-4pax",
      floor: "1st floor",
      name: "Family Room (4 pax)",
      count: 3,
      pax: 4,
      price: 3500,
      privateCr: true,
      hasTv: false,
      hasRef: false,
      notes: "Easy ground-floor access",
      image: "Images/Family room - 4pax.jpg",
      images: [
        "Images/Family room - 4pax.jpg",
        "Images/Family room - 4pax (01).jpg",
      ],
      amenities: [
        "Air-conditioned",
        "Private CR",
        "Free cottage",
        "Parking in front",
      ],
    },
    {
      id: "1f-couple",
      floor: "1st floor",
      name: "Couple Room",
      count: 1,
      pax: 2,
      price: 2500,
      privateCr: true,
      hasTv: false,
      hasRef: false,
      notes: "Perfect for couples · ground floor",
      // Updated couple room photo
      image: "Images/Couple room.jpg",
      images: ["Images/Couple room.jpg"],
      amenities: [
        "Air-conditioned",
        "Private CR",
        "Free cottage",
        "Parking in front",
      ],
    },
    {
      id: "2f-6pax",
      floor: "2nd floor",
      name: "Family Room (6 pax)",
      count: 4,
      pax: 6,
      price: 4500,
      privateCr: true,
      hasTv: false,
      hasRef: false,
      notes: "Spacious for families & friends",
      image: "Images/Family room - 6pax.jpg",
      images: [
        "Images/Family room - 6pax.jpg",
        "Images/Family room - 6pax (01).jpg",
      ],
      amenities: [
        "Air-conditioned",
        "Private CR",
        "Free cottage",
        "Parking in front",
      ],
    },
    {
      id: "3f-15pax",
      floor: "3rd floor",
      name: "Big Group Room (15 pax)",
      count: 2,
      pax: 15,
      price: 9500,
      privateCr: true,
      hasTv: false,
      hasRef: false,
      hasBalcony: true,
      notes: "Ideal for large groups & barkada · 1 of 2 rooms has a balcony",
      image: "Images/Big room - 15pax.jpg",
      images: [
        "Images/Big room - 15pax.jpg",
        "Images/Big room - 15pax (01).jpg",
        "Images/Big room - 15pax (02).jpg",
      ],
      amenities: [
        "Air-conditioned",
        "Private CR",
        "Free cottage",
        "1 room has balcony",
        "Parking in front",
      ],
    },
    {
      id: "kubo-4pax",
      floor: "Kubo",
      name: "Kubo Room (4 pax)",
      count: 1,
      pax: 4,
      price: 3500,
      privateCr: false,
      hasTv: false,
      hasRef: false,
      notes: "No private CR · air-conditioned",
      // No dedicated kubo photo yet — using exterior. Replace when you add Images/Kubo room.jpg
      image: "Images/Resort Exterior01.jpg",
      images: ["Images/Resort Exterior01.jpg", "Images/Gallery Images.jpg"],
      amenities: [
        "Air-conditioned",
        "No private CR",
        "Free cottage",
        "Parking in front",
      ],
    },
  ];

  window.ALMA_CONFIG = window.ALMA_CONFIG || {};
  window.ALMA_CONFIG.rooms = rooms;
})();
