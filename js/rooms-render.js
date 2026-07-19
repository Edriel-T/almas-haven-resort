/**
 * Room listing cards — clickable for more photos
 */
(function () {
  function amenityChips(room) {
    const chips = ["AC"];
    chips.push(room.privateCr ? "Private CR" : "No private CR");
    if (room.hasTv) chips.push("TV");
    if (room.hasRef) chips.push("Ref");
    if (room.hasBalcony) chips.push("Balcony (1 room)");
    chips.push("Free cottage");
    return chips.map((c) => `<li>${c}</li>`).join("");
  }

  function imgSrc(path) {
    if (!path) return "";
    return path
      .split("/")
      .map((part, i) => (i === 0 ? part : encodeURIComponent(part)))
      .join("/");
  }

  function getRoomImages(room) {
    if (window.AlmaRoomPhotos) return window.AlmaRoomPhotos.getImages(room.id);
    if (Array.isArray(room.images) && room.images.length) return room.images;
    if (room.image) return [room.image];
    return [];
  }

  function cardHTML(room) {
    const images = getRoomImages(room);
    const src = imgSrc(images[0] || room.image);
    const alt = room.name || "Room photo";
    const count = images.length;
    const media = src
      ? `<img src="${src}" alt="${alt}" loading="lazy" width="640" height="400" />`
      : `<div class="img-placeholder__fallback"><span class="img-placeholder__label">Photo soon</span></div>`;

    return `
      <article class="room-card reveal" data-room-card="${room.id}" tabindex="0" role="button" aria-label="View photos: ${room.name}">
        <div class="room-media">
          <figure class="room-photo">
            ${media}
          </figure>
          <span class="room-badge">${room.floor}</span>
          ${room.hasBalcony ? `<span class="room-badge room-badge-extra">Balcony available</span>` : ""}
          ${count > 1 ? `<span class="room-photo-count">${count} photos</span>` : `<span class="room-photo-count">View photos</span>`}
        </div>
        <div class="room-body">
          <div class="room-card-top">
            <h3>${room.name}</h3>
            <span class="room-count">${room.count}×</span>
          </div>
          <p class="room-pax">${room.pax} guests max${room.hasBalcony ? " · 1 room has balcony" : ""}</p>
          <p class="room-price"><span>₱</span>${room.price.toLocaleString("en-PH")}<small>/night</small></p>
          <ul class="room-facts">${amenityChips(room)}</ul>
          <button type="button" class="btn btn-ghost btn-block" data-view-room="${room.id}">
            View photos
          </button>
          <button type="button" class="btn btn-primary btn-block" data-book-room="${room.id}">
            Message to book
          </button>
        </div>
      </article>
    `;
  }

  let viewer;
  let viewerImages = [];
  let viewerIndex = 0;
  let viewerRoom = null;

  function ensureViewer() {
    if (document.getElementById("roomPhotoViewer")) {
      viewer = document.getElementById("roomPhotoViewer");
      return;
    }
    const el = document.createElement("div");
    el.id = "roomPhotoViewer";
    el.className = "room-viewer";
    el.hidden = true;
    el.innerHTML = `
      <div class="room-viewer__backdrop" data-rv-close></div>
      <div class="room-viewer__panel" role="dialog" aria-modal="true" aria-labelledby="roomViewerTitle">
        <header class="room-viewer__header">
          <div>
            <h2 id="roomViewerTitle">Room photos</h2>
            <p class="room-viewer__meta" id="roomViewerMeta"></p>
          </div>
          <button type="button" class="room-viewer__close" data-rv-close aria-label="Close">×</button>
        </header>
        <div class="room-viewer__stage">
          <button type="button" class="room-viewer__nav room-viewer__prev" data-rv-prev aria-label="Previous">‹</button>
          <figure class="room-viewer__figure">
            <img id="roomViewerImg" alt="" />
            <figcaption id="roomViewerCap"></figcaption>
          </figure>
          <button type="button" class="room-viewer__nav room-viewer__next" data-rv-next aria-label="Next">›</button>
        </div>
        <div class="room-viewer__thumbs" id="roomViewerThumbs"></div>
        <footer class="room-viewer__footer">
          <p class="room-viewer__count" id="roomViewerCount"></p>
          <button type="button" class="btn btn-primary" id="roomViewerBook">Message to book</button>
        </footer>
      </div>
    `;
    document.body.appendChild(el);
    viewer = el;

    el.querySelectorAll("[data-rv-close]").forEach((b) => b.addEventListener("click", closeViewer));
    el.querySelector("[data-rv-prev]").addEventListener("click", () => showViewer(viewerIndex - 1));
    el.querySelector("[data-rv-next]").addEventListener("click", () => showViewer(viewerIndex + 1));
    document.getElementById("roomViewerBook").addEventListener("click", () => {
      const id = viewerRoom;
      closeViewer();
      if (id && window.AlmaBooking) window.AlmaBooking.open(id);
    });

    document.addEventListener("keydown", (e) => {
      if (!viewer || viewer.hidden) return;
      if (e.key === "Escape") closeViewer();
      if (e.key === "ArrowLeft") showViewer(viewerIndex - 1);
      if (e.key === "ArrowRight") showViewer(viewerIndex + 1);
    });
  }

  function showViewer(i) {
    if (!viewerImages.length) return;
    viewerIndex = (i + viewerImages.length) % viewerImages.length;
    const path = viewerImages[viewerIndex];
    const img = document.getElementById("roomViewerImg");
    img.src = imgSrc(path);
    img.alt = viewerRoom || "Room photo";
    document.getElementById("roomViewerCap").textContent =
      path.split("/").pop() || "";
    document.getElementById("roomViewerCount").textContent =
      `${viewerIndex + 1} / ${viewerImages.length}`;

    document.querySelectorAll("#roomViewerThumbs button").forEach((b, idx) => {
      b.classList.toggle("is-active", idx === viewerIndex);
    });
  }

  function openViewer(roomId) {
    ensureViewer();
    const rooms = (window.ALMA_CONFIG && window.ALMA_CONFIG.rooms) || [];
    const room = rooms.find((r) => r.id === roomId);
    viewerRoom = roomId;
    viewerImages = getRoomImages(room || { id: roomId });
    if (!viewerImages.length) {
      window.AlmaUI?.toast?.("No photos for this room yet.");
      return;
    }

    document.getElementById("roomViewerTitle").textContent = room
      ? room.name
      : "Room photos";
    document.getElementById("roomViewerMeta").textContent = room
      ? `${room.floor} · ₱${room.price.toLocaleString("en-PH")} · up to ${room.pax} pax`
      : "";

    const thumbs = document.getElementById("roomViewerThumbs");
    thumbs.innerHTML = viewerImages
      .map(
        (path, i) =>
          `<button type="button" data-rv-thumb="${i}" class="${i === 0 ? "is-active" : ""}">
            <img src="${imgSrc(path)}" alt="" />
          </button>`
      )
      .join("");
    thumbs.querySelectorAll("[data-rv-thumb]").forEach((b) => {
      b.addEventListener("click", () => showViewer(Number(b.getAttribute("data-rv-thumb"))));
    });

    showViewer(0);
    viewer.hidden = false;
    document.body.classList.add("modal-open");
  }

  function closeViewer() {
    if (!viewer) return;
    viewer.hidden = true;
    document.body.classList.remove("modal-open");
  }

  function bindCards(root) {
    if (!root || root.dataset.roomCardsBound) return;
    root.dataset.roomCardsBound = "1";
    root.addEventListener("click", (e) => {
      if (e.target.closest("[data-book-room]")) return;
      const viewBtn = e.target.closest("[data-view-room]");
      if (viewBtn) {
        e.preventDefault();
        openViewer(viewBtn.getAttribute("data-view-room"));
        return;
      }
      const card = e.target.closest("[data-room-card]");
      if (card) {
        openViewer(card.getAttribute("data-room-card"));
      }
    });
    root.addEventListener("keydown", (e) => {
      const card = e.target.closest("[data-room-card]");
      if (!card) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openViewer(card.getAttribute("data-room-card"));
      }
    });
  }

  function renderInto(el, rooms) {
    if (!el) return;
    const list = rooms || (window.ALMA_CONFIG && window.ALMA_CONFIG.rooms) || [];
    el.innerHTML = list.map((r) => cardHTML(r)).join("");
    bindCards(el);
    if (window.AlmaReveal) window.AlmaReveal.refresh();
  }

  window.addEventListener("alma:room-photos-updated", () => {
    document.querySelectorAll(".room-grid").forEach((grid) => {
      if (grid.id) renderInto(grid);
    });
  });

  window.AlmaRooms = {
    cardHTML,
    renderInto,
    imgSrc,
    openViewer,
    closeViewer,
    getRoomImages,
  };
})();
