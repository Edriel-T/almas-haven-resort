/**
 * Message to book → form (name + when) → Facebook with message draft
 */
(function () {
  const cfg = () => window.ALMA_CONFIG || {};
  let modal;
  let currentRoomId = "";

  function roomById(id) {
    return (cfg().rooms || []).find((r) => r.id === id) || null;
  }

  function todayStr() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
  }

  function formatDisplayDate(iso) {
    if (!iso) return "";
    try {
      const [y, m, d] = iso.split("-").map(Number);
      return new Date(y, m - 1, d).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return iso;
    }
  }

  function buildMessage({ name, checkin, checkout, guests, roomId }) {
    const r = roomById(roomId);
    const lines = [
      `Hi Alma's Haven Resort!`,
      `I'd like to book a room.`,
      ``,
      `Name: ${name}`,
      `When: ${formatDisplayDate(checkin)} → ${formatDisplayDate(checkout)}`,
      `Check-in: ${checkin}`,
      `Check-out: ${checkout}`,
    ];
    if (guests) lines.push(`Guests: ${guests}`);
    if (r) {
      lines.push(`Room: ${r.floor} · ${r.name}`);
      lines.push(`Rate: ₱${r.price.toLocaleString("en-PH")} (up to ${r.pax} pax)`);
      if (r.hasBalcony) lines.push(`Note: 1 of 2 big rooms has a balcony (please confirm)`);
    } else if (roomId) {
      lines.push(`Room: ${roomId}`);
    }
    lines.push(``, `Please confirm availability. Thank you!`);
    return lines.join("\n");
  }

  async function copyMessage(message) {
    if (window.AlmaLiveAgent?.copyText) {
      return window.AlmaLiveAgent.copyText(message);
    }
    try {
      await navigator.clipboard.writeText(message);
      return true;
    } catch {
      return false;
    }
  }

  async function openFacebook(message) {
    const c = cfg();
    const page =
      c.facebookPageUrl ||
      (c.facebookPageId
        ? `https://web.facebook.com/profile.php?id=${c.facebookPageId}`
        : "https://web.facebook.com/profile.php?id=100057130492638");

    const copied = await copyMessage(message);
    window.open(page, "_blank", "noopener");
    window.AlmaUI?.toast?.(
      copied
        ? "Message copied! On Facebook: tap Message, then paste and send."
        : "Facebook opened. Select the preview, copy it, then paste in Message."
    );
    return copied;
  }

  function ensureModal() {
    if (document.getElementById("bookFormModal")) {
      modal = document.getElementById("bookFormModal");
      return;
    }

    const wrap = document.createElement("div");
    wrap.id = "bookFormModal";
    wrap.className = "modal book-form-modal";
    wrap.hidden = true;
    wrap.innerHTML = `
      <div class="modal-backdrop" data-book-close></div>
      <div class="modal-card book-form-card" role="dialog" aria-labelledby="bookFormTitle" aria-modal="true">
        <button type="button" class="booking-close" data-book-close aria-label="Close">×</button>
        <p class="lp-kicker" style="margin-bottom:0.35rem">Message to book</p>
        <h2 id="bookFormTitle">Book a room</h2>
        <p class="book-form-room" id="bookFormRoom"></p>
        <p class="book-form-lead">Fill in your name and dates. Copy the message preview, then open Facebook and paste it in Message.</p>
        <form id="bookForm" novalidate>
          <label>
            Your name
            <input type="text" name="name" id="bookName" required autocomplete="name" placeholder="Full name" />
          </label>
          <div class="form-row">
            <label>
              Check-in
              <input type="date" name="checkin" id="bookCheckin" required />
            </label>
            <label>
              Check-out
              <input type="date" name="checkout" id="bookCheckout" required />
            </label>
          </div>
          <label>
            Guests <span class="optional">(optional)</span>
            <input type="number" name="guests" id="bookGuests" min="1" max="50" placeholder="e.g. 4" />
          </label>
          <div class="fb-instruct-box">
            <strong>How to message us on Facebook</strong>
            <ol class="fb-steps">
              <li>Check the <strong>message preview</strong> below (ready to copy).</li>
              <li>Tap <strong>Copy message</strong>.</li>
              <li>Tap <strong>Copy &amp; open Facebook</strong> (or open Facebook yourself).</li>
              <li>On Facebook, tap <strong>Message</strong>.</li>
              <li><strong>Paste</strong> the text and send.</li>
            </ol>
          </div>
          <div class="book-preview-box">
            <div class="preview-head">
              <strong>Message preview</strong>
              <button type="button" class="btn btn-ghost btn-sm" id="bookCopyPreview">Copy message</button>
            </div>
            <pre id="bookMessagePreview" class="fb-message-preview" tabindex="0" title="Click to select, then copy"></pre>
          </div>
          <p class="form-note" id="bookFormStatus" role="status"></p>
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" data-book-close>Cancel</button>
            <button type="button" class="btn btn-ghost" id="bookCopyOnly">Copy message</button>
            <button type="submit" class="btn btn-primary" id="bookFormSubmit">Copy &amp; open Facebook</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(wrap);
    modal = wrap;

    wrap.querySelectorAll("[data-book-close]").forEach((el) => {
      el.addEventListener("click", close);
    });

    const checkin = document.getElementById("bookCheckin");
    const checkout = document.getElementById("bookCheckout");
    const today = todayStr();
    checkin.min = today;
    checkout.min = today;

    checkin.addEventListener("change", () => {
      checkout.min = checkin.value || today;
      if (checkout.value && checkout.value < checkout.min) checkout.value = checkout.min;
      updatePreview();
    });
    checkout.addEventListener("change", updatePreview);
    document.getElementById("bookName").addEventListener("input", updatePreview);
    document.getElementById("bookGuests").addEventListener("input", updatePreview);

    document.getElementById("bookMessagePreview")?.addEventListener("click", function () {
      const range = document.createRange();
      range.selectNodeContents(this);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });

    async function copyPreviewOnly() {
      const msg = document.getElementById("bookMessagePreview")?.textContent || "";
      const status = document.getElementById("bookFormStatus");
      const ok = await copyMessage(msg);
      if (status) {
        status.textContent = ok
          ? "✓ Message copied. Open Facebook → Message → Paste → Send."
          : "Could not copy automatically. Click the preview, Ctrl+C (or long-press → Copy).";
        status.className = ok ? "form-note success" : "form-note error";
      }
      if (ok) window.AlmaUI?.toast?.("Message copied — paste it on Facebook Message");
    }

    document.getElementById("bookCopyPreview")?.addEventListener("click", copyPreviewOnly);
    document.getElementById("bookCopyOnly")?.addEventListener("click", copyPreviewOnly);

    document.getElementById("bookForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("bookName").value.trim();
      const cin = document.getElementById("bookCheckin").value;
      const cout = document.getElementById("bookCheckout").value;
      const guests = document.getElementById("bookGuests").value;
      const status = document.getElementById("bookFormStatus");

      if (!name) {
        status.textContent = "Please enter your name.";
        status.className = "form-note error";
        return;
      }
      if (!cin || !cout) {
        status.textContent = "Please choose check-in and check-out dates.";
        status.className = "form-note error";
        return;
      }
      if (cout <= cin) {
        status.textContent = "Check-out must be after check-in.";
        status.className = "form-note error";
        return;
      }

      const message = buildMessage({
        name,
        checkin: cin,
        checkout: cout,
        guests,
        roomId: currentRoomId,
      });

      const pre = document.getElementById("bookMessagePreview");
      if (pre) pre.textContent = message;

      const copied = await openFacebook(message);
      status.textContent = copied
        ? "✓ Message copied. Facebook opened — tap Message, paste, and send."
        : "Facebook opened. Click preview → Copy, then paste in Message.";
      status.className = "form-note success";
      setTimeout(close, 1200);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal && !modal.hidden) close();
    });
  }

  function updatePreview() {
    const name = document.getElementById("bookName")?.value.trim() || "(your name)";
    const cin = document.getElementById("bookCheckin")?.value;
    const cout = document.getElementById("bookCheckout")?.value;
    const guests = document.getElementById("bookGuests")?.value;
    const pre = document.getElementById("bookMessagePreview");
    if (!pre) return;
    pre.textContent = buildMessage({
      name: name || "(your name)",
      checkin: cin || "____-__-__",
      checkout: cout || "____-__-__",
      guests,
      roomId: currentRoomId,
    });
  }

  function open(roomId) {
    ensureModal();
    currentRoomId = roomId || "";
    const room = roomById(currentRoomId);
    const title = document.getElementById("bookFormTitle");
    const roomLine = document.getElementById("bookFormRoom");

    if (room) {
      title.textContent = "Message to book";
      roomLine.textContent = `${room.floor} · ${room.name} · ₱${room.price.toLocaleString("en-PH")} · up to ${room.pax} pax`;
      document.getElementById("bookGuests").max = room.pax;
      if (!document.getElementById("bookGuests").value) {
        document.getElementById("bookGuests").value = Math.min(room.pax, room.pax === 2 ? 2 : 4);
      }
    } else {
      title.textContent = "Message to book";
      roomLine.textContent = "Tell us which room you want in Facebook if needed.";
    }

    const today = todayStr();
    document.getElementById("bookCheckin").min = today;
    document.getElementById("bookCheckout").min = today;
    document.getElementById("bookFormStatus").textContent = "";
    document.getElementById("bookFormStatus").className = "form-note";

    updatePreview();
    modal.hidden = false;
    document.body.classList.add("modal-open");
    document.getElementById("bookName").focus();
  }

  function close() {
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove("modal-open");
  }

  function bookRoom(roomId) {
    open(roomId);
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-book-room]");
    if (!btn) return;
    e.preventDefault();
    open(btn.getAttribute("data-book-room"));
  });

  window.AlmaBooking = {
    open,
    close,
    bookRoom,
    openFacebook,
    buildMessage,
  };
})();
