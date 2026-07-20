/**
 * ============================================================
 * ROOMS CONFIG — staff/dev only (not shown to website visitors)
 * ============================================================
 * Load after js/config.js
 */
(function () {
  const rooms = [
    {
      id: "1f-4pax",
      floor: "1st floor",
      name: "Family Room (5 pax)",
      count: 3,
      pax: 5,
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
      name: "Family Room (7 pax)",
      count: 4,
      pax: 7,
      price: 4000,
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
      price: 9000,
      privateCr: true,
      hasTv: true,
      hasRef: true,
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
        "TV",
        "Refrigerator",
        "Free cottage",
        "1 room has balcony",
        "Parking in front",
      ],
    },
    {
      id: "kubo-4pax",
      floor: "Kubo",
      name: "Kubo Room (5 pax)",
      count: 1,
      pax: 5,
      price: 3500,
      privateCr: false,
      hasTv: false,
      hasRef: false,
      notes: "No private CR · air-conditioned",
      image: "Images/Kubo room - 5pax.jpg",
      images: ["Images/Kubo room - 5pax.jpg"],
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
