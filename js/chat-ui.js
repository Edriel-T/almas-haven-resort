/**
 * Inject shared chat launcher + panel markup if not present.
 */
(function () {
  if (document.getElementById("chatPanel")) return;

  const frag = document.createElement("div");
  frag.innerHTML = `
  <button type="button" class="chat-launcher" id="chatLauncher" aria-controls="chatPanel" aria-expanded="false">
    <span class="chat-launcher-icon" aria-hidden="true">💬</span>
    <span class="chat-launcher-label">FAQ &amp; help</span>
    <span class="chat-badge" id="chatBadge" hidden>1</span>
  </button>
  <div class="chat-panel" id="chatPanel" role="dialog" aria-labelledby="chatTitle" aria-modal="false" hidden>
    <header class="chat-header">
      <div>
        <h2 id="chatTitle">Alma's Haven Assistant</h2>
        <p class="chat-status" id="chatStatus"><span class="status-dot online"></span> FAQ bot · Checking live agent…</p>
      </div>
      <div class="chat-header-actions">
        <button type="button" class="icon-btn" id="chatMinimize" aria-label="Minimize chat">−</button>
        <button type="button" class="icon-btn" id="chatClose" aria-label="Close chat">×</button>
      </div>
    </header>
    <div class="chat-mode-bar" id="chatModeBar">
      <span id="modeLabel">Mode: FAQ Bot</span>
      <div class="chat-mode-actions">
        <button type="button" class="chip-btn" id="requestAgentBtn">Live agent</button>
        <button type="button" class="chip-btn chip-btn-danger" id="endLiveChatBtn" hidden>End chat</button>
      </div>
    </div>
    <div class="chat-messages" id="chatMessages" aria-live="polite"></div>
    <div class="chat-suggestions" id="chatSuggestions"></div>
    <form class="chat-input-row" id="chatForm">
      <label class="sr-only" for="chatInput">Type your message</label>
      <input type="text" id="chatInput" placeholder="Ask about rates, rooms, directions…" autocomplete="off" />
      <button type="submit" class="btn btn-primary chat-send" aria-label="Send">Send</button>
    </form>
  </div>
  <div class="modal" id="agentModal" hidden>
    <div class="modal-backdrop" data-close-modal></div>
    <div class="modal-card" role="dialog" aria-labelledby="agentModalTitle" aria-modal="true">
      <h3 id="agentModalTitle">No agent online right now</h3>
      <p id="agentModalLead">Fill in your details. We will prepare a message for you to send on Facebook.</p>
      <form id="agentForm">
        <label>Your name<input type="text" name="name" id="agentName" required placeholder="Full name" /></label>
        <label>What do you need help with?
          <select name="topic" id="agentTopic">
            <option value="reservation">Reservation / booking</option>
            <option value="availability">Room availability</option>
            <option value="directions">Directions &amp; arrival</option>
            <option value="rates">Rates &amp; packages</option>
            <option value="other">Other / general help</option>
          </select>
        </label>
        <label>Message<textarea name="message" id="agentMessage" rows="3" placeholder="Dates, guests, questions…" required></textarea></label>

        <div class="fb-instruct-box">
          <strong>How to message us on Facebook</strong>
          <ol class="fb-steps">
            <li>Review the <strong>message preview</strong> below (ready to copy).</li>
            <li>Tap <strong>Copy message</strong>.</li>
            <li>Tap <strong>Open Facebook</strong> — our page will open.</li>
            <li>On Facebook, tap <strong>Message</strong>.</li>
            <li><strong>Paste</strong> the message (Ctrl+V or long-press → Paste) and send.</li>
          </ol>
        </div>

        <div class="book-preview-box">
          <div class="preview-head">
            <strong>Message preview</strong>
            <button type="button" class="btn btn-ghost btn-sm" id="agentCopyPreview">Copy message</button>
          </div>
          <pre id="agentMessagePreview" class="fb-message-preview" tabindex="0" title="Click to select, then copy"></pre>
          <p class="form-note" id="agentCopyStatus" role="status"></p>
        </div>

        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          <button type="button" class="btn btn-ghost" id="agentCopyOnly">Copy message</button>
          <button type="submit" class="btn btn-primary">Copy &amp; open Facebook</button>
        </div>
      </form>
    </div>
  </div>
  `;
  while (frag.firstChild) document.body.appendChild(frag.firstChild);
})();
