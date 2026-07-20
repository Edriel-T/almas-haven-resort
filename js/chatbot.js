/**
 * FAQ chatbot for Alma's Haven Resort
 * - Answers common questions from a knowledge base
 * - Can hand off to a live human agent (with staff notification)
 */
(function () {
  const cfg = () => window.ALMA_CONFIG || {};

  const FAQ = [
    {
      id: "greeting",
      keywords: ["hi", "hello", "hey", "good morning", "good afternoon", "kumusta", "magandang"],
      answer:
        "Hello! Welcome to Alma's Haven Resort in Dasol, Pangasinan 🌊 I'm the FAQ assistant. Ask about rates, rooms, check-in, directions, or amenities — or request a live agent for reservations.",
    },
    {
      id: "rates",
      keywords: [
        "rate",
        "rates",
        "price",
        "prices",
        "how much",
        "magkano",
        "cost",
        "package",
        "affordable",
        "fee",
        "3500",
        "2500",
        "4500",
        "9500",
      ],
      answer: () => {
        if (window.AlmaLiveAgent && typeof window.AlmaLiveAgent.buildRatesText === "function") {
          return (
            window.AlmaLiveAgent.buildRatesText() +
            "\n\nMessage us on Facebook to book, or ask for a live agent if one is online."
          );
        }
        return [
          "Here are our room rates (price is per room, per night — not for all rooms combined):",
          "",
          "• 1st floor — Couple Room (up to 2 guests): ₱2,500 per room · 1 room available",
          "• 1st floor — Family Room (up to 5 guests): ₱3,500 per room · 3 rooms available",
          "• 2nd floor — Family Room (up to 7 guests): ₱4,000 per room · 4 rooms available",
          "• 3rd floor — Big Group Room (up to 15 guests): ₱9,000 per room · 2 rooms available (1 has a balcony)",
          "• Kubo Room (up to 5 guests): ₱3,500 per room · 1 room available (no private CR)",
          "",
          "All rooms are air-conditioned and include a free cottage.",
          "Private CR on all rooms except the kubo. Parking is in front of your room.",
        ].join("\n");
      },
    },
    {
      id: "rooms",
      keywords: [
        "floor",
        "floors",
        "building",
        "capacity",
        "pax",
        "couple",
        "family room",
        "big group",
        "kubo",
        "how many rooms",
        "room type",
        "types",
      ],
      answer: [
        "We have a 3-floor beachfront building plus one kubo:",
        "",
        "• 1st floor: 3 family rooms (5 guests each) and 1 couple room",
        "• 2nd floor: 4 family rooms (7 guests each)",
        "• 3rd floor: 2 big group rooms (15 guests each) — one has a balcony",
        "• Kubo: 1 room for 5 guests (no private CR)",
        "",
        "Every booking includes a free cottage. All rooms are air-conditioned.",
        "Prices are per room, per night. Ask “What are your room rates?” for full pricing.",
      ].join("\n"),
    },
    {
      id: "cottage",
      keywords: ["cottage", "cottages", "kubo cottage", "included", "free cottage"],
      answer:
        "Yes — every room booking includes a free cottage. It is great for meals, hanging out, and shade near the beach.",
    },
    {
      id: "ac",
      keywords: ["aircon", "air-con", "air condition", "ac", "airconditioned", "air-conditioned", "cooler"],
      answer:
        "All rooms are air-conditioned, including the kubo, so you stay cool after a day at the beach.",
    },
    {
      id: "cr",
      keywords: ["cr", "bathroom", "comfort room", "toilet", "private cr", "shower"],
      answer:
        "All rooms have a private CR except the kubo (the kubo has no private CR). For a private bathroom, choose a 1st, 2nd, or 3rd floor room.",
    },
    {
      id: "parking",
      keywords: ["parking", "park", "car", "vehicle", "sasakyan"],
      answer:
        "Yes, parking is available in front of your room — easy for loading bags and for families with kids.",
    },
    {
      id: "checkin",
      keywords: ["check-in", "check in", "checkout", "check-out", "check out", "arrival", "time", "schedule"],
      answer:
        "Please confirm check-in and check-out times when you reserve so we can prepare your room. Late arrivals are welcome — just message us ahead of time.",
    },
    {
      id: "location",
      keywords: [
        "where",
        "location",
        "address",
        "direction",
        "directions",
        "map",
        "how to get",
        "dasol",
        "pangasinan",
        "plus code",
      ],
      answer: () =>
        [
          `We are in ${cfg().location || "Dasol, 2411 Pangasinan"}.`,
          `Plus code: ${cfg().plusCode || "WQJJ+5M"}.`,
          "Search “Alma's Haven Resort, Dasol” on Google Maps for directions.",
          "Need more help? Ask for a live agent and tell us where you are coming from.",
        ].join("\n"),
    },
    {
      id: "amenities",
      keywords: [
        "amenit",
        "facility",
        "facilities",
        "beach",
        "sand",
        "water",
        "wifi",
        "pool",
        "clean",
        "what do you have",
        "beachfront",
        "white sand",
      ],
      answer:
        "Beachfront resort with all-AC rooms, private CR (except kubo), free cottage with every booking, and parking in front of your room. Check the public calendar (green = available), then message us on Facebook to book.",
    },
    {
      id: "colibra",
      keywords: ["colibra", "kalibra", "island", "island hop", "boat", "tour"],
      answer:
        "Planning Colibra Island? Guests share that you can ask the caretaker/staff for help arranging how to get there. For the latest tips and schedules, request a live agent and tell them your travel dates.",
    },
    {
      id: "store",
      keywords: ["sari-sari", "sari sari", "store", "shop", "tindahan", "snacks", "nearby"],
      answer:
        "Yes — there's a sari-sari store near the resort, which guests find handy for snacks and small essentials during their stay.",
    },
    {
      id: "groundfloor",
      keywords: ["ground", "baba", "downstairs", "first floor", "1st floor", "easy access", "stairs", "lower"],
      answer:
        "1st floor has easy access: 3 family rooms (up to 5 guests each) at ₱3,500 per room, and 1 couple room at ₱2,500 per room. All are AC with private CR, free cottage, and parking in front.",
    },
    {
      id: "reserve",
      keywords: [
        "reserve",
        "reservation",
        "book",
        "booking",
        "available",
        "availability",
        "vacancy",
        "slot",
        "date",
        "dates",
      ],
      answer: () => {
        const fb = cfg().facebookPageUrl || "https://web.facebook.com/profile.php?id=100057130492638";
        return `To reserve: check green dates on the calendar, choose a room, then Message to book — that opens our Facebook page. Bookings are manual. Facebook: ${fb}`;
      },
    },
    {
      id: "reviews",
      keywords: ["review", "rating", "stars", "feedback", "google"],
      answer: () =>
        `We're rated ${cfg().rating || "4.9"}★ from ${cfg().reviewCount || 24} Google reviews. Guests often mention friendly staff, clean rooms, clear water, peaceful vibe, white sand, and affordability. Many families and friends return year after year.`,
    },
    {
      id: "staff",
      keywords: ["staff", "owner", "caretaker", "friendly", "hospitable", "people", "accommodating", "aura", "smiling"],
      answer:
        "Owners and caretakers are known for a great aura — approachable, always smiling, easy to talk to, and hands-on with your needs. Guests repeatedly say “very accommodating” and “friendly staff” in Google reviews.",
    },
    {
      id: "contact",
      keywords: ["contact", "phone", "email", "whatsapp", "viber", "call", "message"],
      answer: () => {
        const parts = [
          "You can reach the team by requesting a live agent here (they'll get a notification), or by submitting the reservation form.",
        ];
        if (cfg().contactEmail) parts.push(`Email: ${cfg().contactEmail}`);
        if (cfg().whatsappNumber) parts.push("WhatsApp handoff is also available after you leave your details.");
        parts.push("Staff can open the Staff Inbox page on this site to see new requests.");
        return parts.join(" ");
      },
    },
    {
      id: "agent",
      keywords: [
        "agent",
        "human",
        "person",
        "staff",
        "talk to",
        "live",
        "help me",
        "representative",
        "operator",
        "real person",
      ],
      answer: "__REQUEST_AGENT__",
    },
    {
      id: "thanks",
      keywords: ["thank", "salamat", "thanks"],
      answer: "You're welcome! Looking forward to hosting you at Alma's Haven. Message anytime if you need more help 💙",
    },
  ];

  const SUGGESTIONS = [
    { label: "Room rates", text: "What are your room rates?" },
    { label: "Room types", text: "What rooms do you have by floor?" },
    { label: "Free cottage?", text: "Do rooms include a free cottage?" },
    { label: "Private CR?", text: "Do rooms have private CR?" },
    { label: "Reserve", text: "How do I make a reservation?" },
    { label: "Live agent", text: "I want to talk to a live agent" },
  ];

  let mode = "bot"; // bot | ask_name | ask_need | queued | live | offline_fb
  let panel,
    messagesEl,
    suggestionsEl,
    inputEl,
    formEl,
    statusEl,
    modeLabel,
    badgeEl,
    endLiveBtn,
    endLiveBtnFooter,
    liveEndBar,
    requestAgentBtn;
  let liveChatId = null;
  let livePollTimer = null;
  let lastLiveMsgCount = 0;
  let intakeName = "";
  let intakeNeed = "";

  function el(tag, className, html) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (html != null) node.innerHTML = html;
    return node;
  }

  function appendMessage(role, text, meta) {
    hideTyping();
    const wrap = el("div", `msg ${role}`);
    if (meta) {
      const m = el("span", "msg-meta");
      m.textContent = meta;
      wrap.appendChild(m);
    }
    const body = el("div");
    // Preserve line breaks in multi-line bot/agent replies (rates, lists)
    body.innerHTML = linkify(escapeHtml(text)).replace(/\n/g, "<br>");
    wrap.appendChild(body);
    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    persistChat();
  }

  function showTyping(meta) {
    if (!messagesEl) return;
    hideTyping();
    const wrap = el("div", "msg bot typing-msg");
    wrap.id = "botTypingIndicator";
    wrap.setAttribute("aria-live", "polite");
    wrap.setAttribute("aria-label", "Bot is typing");
    const m = el("span", "msg-meta");
    m.textContent = meta || "Alma's Haven Bot";
    wrap.appendChild(m);
    const dots = el("div", "typing-dots");
    dots.innerHTML = "<span></span><span></span><span></span>";
    wrap.appendChild(dots);
    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function hideTyping() {
    const node = document.getElementById("botTypingIndicator");
    if (node) node.remove();
  }

  function typingDelayFor(text) {
    const len = String(text || "").length;
    // Longer answers take a bit more time; keep within a natural range
    return Math.min(2400, Math.max(750, 500 + len * 14 + Math.random() * 350));
  }

  /** Show typing dots, wait, then post bot message */
  async function botReply(text, meta) {
    const label = meta || "Alma's Haven Bot";
    showTyping(label);
    await wait(typingDelayFor(text));
    hideTyping();
    appendMessage("bot", text, label);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function linkify(text) {
    return text.replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank" rel="noopener">$1</a>'
    );
  }

  function normalize(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^\w\s+]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function matchFaq(userText) {
    const n = normalize(userText);
    if (!n) return null;

    // Strong intent for agent
    if (
      /\b(live agent|talk to (a )?(human|person|agent|staff)|speak to|real person|customer service)\b/.test(
        n
      ) ||
      n === "agent" ||
      n.includes("tulong") && n.includes("tao")
    ) {
      return FAQ.find((f) => f.id === "agent");
    }

    let best = null;
    let bestScore = 0;
    for (const item of FAQ) {
      let score = 0;
      for (const kw of item.keywords) {
        if (n.includes(kw)) score += kw.length > 4 ? 2 : 1;
      }
      if (score > bestScore) {
        bestScore = score;
        best = item;
      }
    }
    return bestScore > 0 ? best : null;
  }

  function resolveAnswer(item) {
    if (!item) return null;
    const a = typeof item.answer === "function" ? item.answer() : item.answer;
    return a;
  }

  function agentOnline() {
    return window.AlmaLiveAgent && window.AlmaLiveAgent.isAgentOnline();
  }

  function updateLiveButtons() {
    const inLive = mode === "live" || mode === "queued";
    const inSetup = mode === "ask_name" || mode === "ask_need";
    const showEnd = inLive || inSetup;
    if (endLiveBtn) {
      endLiveBtn.hidden = !showEnd;
      endLiveBtn.textContent = inSetup ? "Cancel" : "End live chat";
    }
    if (endLiveBtnFooter) {
      endLiveBtnFooter.textContent = inSetup
        ? "Cancel live agent request"
        : "End live agent chat";
    }
    if (liveEndBar) liveEndBar.hidden = !showEnd;
    if (requestAgentBtn) requestAgentBtn.hidden = showEnd;
  }

  function setMode(next) {
    mode = next;
    if (!modeLabel || !statusEl) return;
    const online = agentOnline();
    if (mode === "live") {
      modeLabel.textContent = "Mode: Live chat";
      statusEl.innerHTML =
        '<span class="status-dot agent"></span> Connected · chat on this website';
      if (inputEl) inputEl.placeholder = "Message the agent…";
    } else if (mode === "queued") {
      modeLabel.textContent = "Mode: In queue";
      statusEl.innerHTML =
        '<span class="status-dot agent"></span> Waiting in queue for an agent…';
      if (inputEl) inputEl.placeholder = "Optional note while you wait…";
    } else if (mode === "ask_name") {
      modeLabel.textContent = "Mode: Live agent setup";
      statusEl.innerHTML =
        '<span class="status-dot agent"></span> Step 1 of 2 · Your name';
      if (inputEl) inputEl.placeholder = "Type your name…";
    } else if (mode === "ask_need") {
      modeLabel.textContent = "Mode: Live agent setup";
      statusEl.innerHTML =
        '<span class="status-dot agent"></span> Step 2 of 2 · What you need';
      if (inputEl) inputEl.placeholder = "What do you need help with?";
    } else if (mode === "bot") {
      modeLabel.textContent = "Mode: FAQ Bot";
      statusEl.innerHTML = online
        ? '<span class="status-dot online"></span> FAQ bot · Live agent online'
        : '<span class="status-dot" style="background:#ccc"></span> FAQ bot · No agent online';
      if (inputEl) inputEl.placeholder = "Ask about rates, rooms, directions…";
    } else {
      modeLabel.textContent = "Mode: FAQ Bot";
      statusEl.innerHTML =
        '<span class="status-dot" style="background:#ccc"></span> FAQ bot · Message us on Facebook';
    }
    updateLiveButtons();
  }

  function endLiveChatByUser() {
    // Cancel during name/need setup (not yet connected)
    if (mode === "ask_name" || mode === "ask_need") {
      const ok = confirm("Cancel the live agent request?");
      if (!ok) return;
      liveChatId = null;
      lastLiveMsgCount = 0;
      stopLivePoll();
      intakeName = "";
      intakeNeed = "";
      setMode("bot");
      appendMessage(
        "system",
        "Live agent request cancelled. You can use the FAQ bot, or request a live agent again anytime."
      );
      if (window.AlmaUI?.toast) window.AlmaUI.toast("Request cancelled");
      return;
    }

    if (mode !== "live" && mode !== "queued") return;
    const ok = confirm(
      mode === "queued"
        ? "Leave the queue and end this live agent request?"
        : "End your chat with the live agent?"
    );
    if (!ok) return;

    if (liveChatId && window.AlmaLiveAgent) {
      window.AlmaLiveAgent.endChatByGuest(liveChatId);
    }
    liveChatId = null;
    lastLiveMsgCount = 0;
    stopLivePoll();
    intakeName = "";
    intakeNeed = "";
    setMode("bot");
    appendMessage(
      "system",
      "You ended the live chat. You can keep using the FAQ bot, or request a live agent again anytime."
    );
    if (window.AlmaUI?.toast) {
      window.AlmaUI.toast("Live chat ended");
    }
  }

  function stopLivePoll() {
    if (livePollTimer) {
      clearInterval(livePollTimer);
      livePollTimer = null;
    }
  }

  function startLivePoll() {
    stopLivePoll();
    livePollTimer = setInterval(syncLiveMessages, 2000);
  }

  function syncLiveMessages() {
    if ((mode !== "live" && mode !== "queued") || !liveChatId || !window.AlmaLiveAgent) return;
    const chat = window.AlmaLiveAgent.getChat(liveChatId);
    if (!chat) return;

    if (chat.status === "closed") {
      appendMessage("system", "Live chat ended. You can still use the FAQ bot or Facebook.");
      liveChatId = null;
      setMode("bot");
      stopLivePoll();
      return;
    }

    // Promoted from queue → active
    if (mode === "queued" && chat.status === "active") {
      setMode("live");
      appendMessage(
        "system",
        `✓ You're connected now, ${chat.guestName || "guest"}! ${window.AlmaLiveAgent.getAgentName()} can reply here.`
      );
      if (window.AlmaUI?.toast) window.AlmaUI.toast("Connected to live agent");
    }

    if (mode === "queued" && chat.status === "queued") {
      const pos = window.AlmaLiveAgent.queuePosition(liveChatId);
      if (pos > 0 && modeLabel) {
        modeLabel.textContent = `Mode: Queue #${pos}`;
      }
    }

    const msgs = chat.messages || [];
    if (msgs.length <= lastLiveMsgCount) return;
    const newOnes = msgs.slice(lastLiveMsgCount);
    lastLiveMsgCount = msgs.length;
    newOnes.forEach((m) => {
      if (m.from === "guest") return;
      if (m.from === "agent") {
        appendMessage("agent", m.text, window.AlmaLiveAgent.getAgentName());
      } else if (m.from === "system") {
        appendMessage("system", m.text);
      }
    });
  }

  function finishIntakeAndConnect() {
    if (!window.AlmaLiveAgent) return;
    const result = window.AlmaLiveAgent.joinQueue({
      name: intakeName,
      need: intakeNeed,
      topic: "live_help",
    });
    const chat = result.chat;
    liveChatId = chat.id;
    lastLiveMsgCount = (chat.messages || []).length;

    if (result.promoted || chat.status === "active") {
      setMode("live");
      appendMessage(
        "system",
        `✓ ${intakeName}, you're connected. Agent: ${window.AlmaLiveAgent.getAgentName()}. They can see what you need.\n\nYou can end this chat anytime with the red “End live chat” button above, or “End live agent chat” below.`
      );
      if (window.AlmaUI?.toast) {
        window.AlmaUI.toast("Connected to live agent");
      }
    } else {
      setMode("queued");
      const pos = result.position || window.AlmaLiveAgent.queuePosition(liveChatId) || 1;
      appendMessage(
        "system",
        `✓ Thanks ${intakeName}! You're #${pos} in the queue. Please wait — we'll connect you when an agent is free.\n\nYou can leave the queue anytime with “End live chat”.`
      );
      if (window.AlmaUI?.toast) {
        window.AlmaUI.toast(`You're #${pos} in the live agent queue`);
      }
    }
    startLivePoll();
  }

  function beginLiveIntake() {
    intakeName = "";
    intakeNeed = "";
    openPanel();
    setMode("ask_name");
    appendMessage(
      "bot",
      "Sure — I'll connect you to a live agent. First, what is your name?",
      "Alma's Haven Bot"
    );
  }

  function requestLiveAgent() {
    openPanel();
    if (!agentOnline()) {
      appendMessage(
        "bot",
        "No live agent is online right now. Leave a short note and we'll open Facebook so you can message the resort page.",
        "Alma's Haven Bot"
      );
      openAgentModal("reservation");
      return;
    }
    // Online: name → need → queue/connect
    beginLiveIntake();
  }

  function renderSuggestions() {
    suggestionsEl.innerHTML = "";
    SUGGESTIONS.forEach((s) => {
      const b = el("button", "", s.label);
      b.type = "button";
      b.addEventListener("click", () => {
        inputEl.value = s.text;
        formEl.requestSubmit();
      });
      suggestionsEl.appendChild(b);
    });
  }

  function openAgentModal(prefillTopic) {
    const modal = document.getElementById("agentModal");
    if (!modal) return;
    modal.hidden = false;
    if (prefillTopic) {
      const sel = modal.querySelector('[name="topic"]');
      if (sel) sel.value = prefillTopic;
    }
    // Refresh message preview for copy
    const pre = document.getElementById("agentMessagePreview");
    if (pre) {
      const name =
        document.getElementById("agentName")?.value.trim() || "(your name)";
      const topic = document.getElementById("agentTopic")?.value || "help";
      const message =
        document.getElementById("agentMessage")?.value.trim() || "(your message)";
      pre.textContent = [
        "Hi Alma's Haven Resort!",
        `Name: ${name}`,
        `Topic: ${topic}`,
        `Message: ${message}`,
        "I'd like help from the team. Thank you!",
      ].join("\n");
    }
    const status = document.getElementById("agentCopyStatus");
    if (status) {
      status.textContent = "";
      status.className = "form-note";
    }
    const first = modal.querySelector("input, select, textarea");
    if (first) first.focus();
  }

  function closeAgentModal() {
    const modal = document.getElementById("agentModal");
    if (modal) modal.hidden = true;
  }

  async function handleUserMessage(text) {
    const trimmed = text.trim();
    if (!trimmed) return;

    appendMessage("user", trimmed);
    inputEl.value = "";

    // Step 1: collect name
    if (mode === "ask_name") {
      intakeName = trimmed.replace(/\s+/g, " ").slice(0, 60);
      setMode("ask_need");
      await botReply(
        `Thanks, ${intakeName}! What do you need help with? (e.g. booking dates, room type, directions)`
      );
      return;
    }

    // Step 2: collect need → join queue / connect
    if (mode === "ask_need") {
      intakeNeed = trimmed.slice(0, 500);
      if (!agentOnline()) {
        appendMessage(
          "system",
          "The agent went offline while we were setting up. You can message us on Facebook instead."
        );
        setMode("bot");
        openAgentModal();
        return;
      }
      showTyping();
      await wait(650 + Math.random() * 300);
      hideTyping();
      finishIntakeAndConnect();
      return;
    }

    // In queue — optional notes to agent
    if (mode === "queued" && liveChatId && window.AlmaLiveAgent) {
      window.AlmaLiveAgent.addMessage(liveChatId, "guest", trimmed);
      const chat = window.AlmaLiveAgent.getChat(liveChatId);
      lastLiveMsgCount = (chat?.messages || []).length;
      appendMessage("system", "Note saved. You're still in the queue — an agent will see this.");
      return;
    }

    // Live website chat with active agent (no bot typing — real agent replies)
    if (mode === "live" && liveChatId && window.AlmaLiveAgent) {
      if (!window.AlmaLiveAgent.isAgentOnline()) {
        appendMessage(
          "system",
          "The agent went offline. You can message us on Facebook instead."
        );
        setMode("bot");
        stopLivePoll();
        openAgentModal();
        return;
      }
      window.AlmaLiveAgent.addMessage(liveChatId, "guest", trimmed);
      const chat = window.AlmaLiveAgent.getChat(liveChatId);
      lastLiveMsgCount = (chat?.messages || []).length;
      return;
    }

    // FAQ bot — typing indicator + natural delay
    const hit = matchFaq(trimmed);
    const answer = resolveAnswer(hit);

    if (answer === "__REQUEST_AGENT__") {
      if (agentOnline()) {
        showTyping();
        await wait(700 + Math.random() * 400);
        hideTyping();
        beginLiveIntake();
      } else {
        await botReply(
          "No live agent is online at the moment. Leave a short note and we'll open Facebook so you can message the resort page."
        );
        openAgentModal("reservation");
      }
      return;
    }

    if (answer) {
      await botReply(answer);
      return;
    }

    await botReply(
      agentOnline()
        ? "I'm not sure about that yet. Try a suggested question, or tap Live agent — we'll ask your name, then what you need, then connect you."
        : "I'm not sure about that yet. Try a suggested question, or tap Live agent to message us on Facebook (no agent is online right now)."
    );
  }

  function wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function persistChat() {
    try {
      const nodes = [...messagesEl.querySelectorAll(".msg")].map((m) => ({
        role: m.classList.contains("user")
          ? "user"
          : m.classList.contains("system")
            ? "system"
            : m.classList.contains("agent")
              ? "agent"
              : "bot",
        text: m.innerText,
      }));
      sessionStorage.setItem(cfg().chatHistoryKey || "almas_haven_chat_v1", JSON.stringify(nodes.slice(-40)));
    } catch {
      /* ignore */
    }
  }

  function restoreChat() {
    try {
      const raw = sessionStorage.getItem(cfg().chatHistoryKey || "almas_haven_chat_v1");
      if (!raw) return false;
      const nodes = JSON.parse(raw);
      if (!Array.isArray(nodes) || !nodes.length) return false;
      nodes.forEach((n) => {
        const wrap = el("div", `msg ${n.role}`);
        wrap.textContent = n.text;
        messagesEl.appendChild(wrap);
      });
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return true;
    } catch {
      return false;
    }
  }

  function openPanel() {
    panel.hidden = false;
    document.getElementById("chatLauncher")?.setAttribute("aria-expanded", "true");
    if (badgeEl) badgeEl.hidden = true;
    inputEl?.focus();
  }

  function closePanel() {
    panel.hidden = true;
    document.getElementById("chatLauncher")?.setAttribute("aria-expanded", "false");
  }

  function togglePanel() {
    if (panel.hidden) openPanel();
    else closePanel();
  }

  function seedWelcome() {
    if (messagesEl.children.length) return;
    appendMessage(
      "bot",
      `Hi! I'm the FAQ assistant for ${cfg().resortName || "Alma's Haven Resort"}. Ask me anything about the resort, or request a live agent for bookings and special help.`,
      "Alma's Haven Bot"
    );
    appendMessage(
      "system",
      "Tip: say “talk to a live agent” or use the button above when you need a human."
    );
  }

  function askFaq(key) {
    const map = {
      rates: "What are your room rates?",
      rooms: "What rooms do you have by floor?",
      cottage: "Do rooms include a free cottage?",
      cr: "Do rooms have private CR?",
      parking: "Is there parking?",
      checkin: "What is check-in and check-out?",
      location: "How do I get to the resort?",
      amenities: "What amenities do you have?",
      reserve: "How do I make a reservation?",
      agent: "I want to talk to a live agent",
      directions: "How do I get there? I need directions.",
    };
    openPanel();
    if (!messagesEl.children.length) seedWelcome();
    const text = map[key] || key;
    handleUserMessage(text);
  }

  function bind() {
    panel = document.getElementById("chatPanel");
    messagesEl = document.getElementById("chatMessages");
    suggestionsEl = document.getElementById("chatSuggestions");
    inputEl = document.getElementById("chatInput");
    formEl = document.getElementById("chatForm");
    statusEl = document.getElementById("chatStatus");
    modeLabel = document.getElementById("modeLabel");
    badgeEl = document.getElementById("chatBadge");
    endLiveBtn = document.getElementById("endLiveChatBtn");
    endLiveBtnFooter = document.getElementById("endLiveChatBtnFooter");
    liveEndBar = document.getElementById("chatLiveEndBar");
    requestAgentBtn = document.getElementById("requestAgentBtn");

    if (!panel) return;

    document.getElementById("chatLauncher")?.addEventListener("click", () => {
      if (panel.hidden) {
        openPanel();
        if (!messagesEl.children.length) {
          if (!restoreChat()) seedWelcome();
        }
      } else {
        closePanel();
      }
    });

    document.getElementById("chatClose")?.addEventListener("click", closePanel);
    document.getElementById("chatMinimize")?.addEventListener("click", closePanel);

    document.getElementById("openChatFromHero")?.addEventListener("click", () => {
      openPanel();
      if (!messagesEl.children.length && !restoreChat()) seedWelcome();
    });

    document.querySelectorAll("[data-open-chat]").forEach((btn) => {
      btn.addEventListener("click", () => {
        openPanel();
        if (!messagesEl.children.length && !restoreChat()) seedWelcome();
        const intent = btn.getAttribute("data-chat-intent");
        if (intent) askFaq(intent);
      });
    });

    document.getElementById("faqChips")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-faq]");
      if (!btn) return;
      askFaq(btn.getAttribute("data-faq"));
    });

    requestAgentBtn?.addEventListener("click", () => {
      requestLiveAgent();
    });

    endLiveBtn?.addEventListener("click", () => {
      endLiveChatByUser();
    });
    endLiveBtnFooter?.addEventListener("click", () => {
      endLiveChatByUser();
    });

    formEl?.addEventListener("submit", (e) => {
      e.preventDefault();
      handleUserMessage(inputEl.value);
    });

    // Agent modal (offline → Facebook only)
    document.querySelectorAll("[data-close-modal]").forEach((node) => {
      node.addEventListener("click", closeAgentModal);
    });

    function buildAgentDraft() {
      const name =
        document.getElementById("agentName")?.value.trim() || "(your name)";
      const topic = document.getElementById("agentTopic")?.value || "help";
      const message =
        document.getElementById("agentMessage")?.value.trim() || "(your message)";
      return [
        "Hi Alma's Haven Resort!",
        `Name: ${name}`,
        `Topic: ${topic}`,
        `Message: ${message}`,
        "I'd like help from the team. Thank you!",
      ].join("\n");
    }

    function updateAgentPreview() {
      const pre = document.getElementById("agentMessagePreview");
      if (pre) pre.textContent = buildAgentDraft();
    }

    async function copyAgentPreview() {
      const msg = buildAgentDraft();
      const status = document.getElementById("agentCopyStatus");
      const ok = window.AlmaLiveAgent
        ? await window.AlmaLiveAgent.copyText(msg)
        : false;
      if (status) {
        status.textContent = ok
          ? "✓ Message copied. Next: Open Facebook → Message → Paste → Send."
          : "Could not copy. Click the preview box, then Ctrl+C (or long-press → Copy).";
        status.className = ok ? "form-note success" : "form-note error";
      }
      if (ok) window.AlmaUI?.toast?.("Message copied — paste it on Facebook Message");
      return ok;
    }

    ["agentName", "agentTopic", "agentMessage"].forEach((id) => {
      document.getElementById(id)?.addEventListener("input", updateAgentPreview);
      document.getElementById(id)?.addEventListener("change", updateAgentPreview);
    });
    document.getElementById("agentMessagePreview")?.addEventListener("click", function () {
      const range = document.createRange();
      range.selectNodeContents(this);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });
    document.getElementById("agentCopyPreview")?.addEventListener("click", (e) => {
      e.preventDefault();
      copyAgentPreview();
    });
    document.getElementById("agentCopyOnly")?.addEventListener("click", (e) => {
      e.preventDefault();
      copyAgentPreview();
    });

    document.getElementById("agentForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      // If agent came online while form open → start name/need intake on site
      if (agentOnline()) {
        closeAgentModal();
        const fd = new FormData(e.target);
        intakeName = String(fd.get("name") || "").trim();
        intakeNeed = String(fd.get("message") || "").trim();
        openPanel();
        if (intakeName && intakeNeed) {
          finishIntakeAndConnect();
        } else if (intakeName) {
          setMode("ask_need");
          appendMessage(
            "bot",
            `Thanks, ${intakeName}! An agent is online. What do you need help with?`,
            "Alma's Haven Bot"
          );
        } else {
          beginLiveIntake();
        }
        e.target.reset();
        return;
      }

      const draft = buildAgentDraft();
      const pre = document.getElementById("agentMessagePreview");
      if (pre) pre.textContent = draft;

      const copied = window.AlmaLiveAgent
        ? await window.AlmaLiveAgent.openFacebookWithMessage(draft)
        : false;

      closeAgentModal();
      openPanel();
      appendMessage(
        "system",
        copied
          ? "✓ Message copied and Facebook opened.\n\nOn Facebook:\n1. Tap Message\n2. Paste (Ctrl+V or long-press → Paste)\n3. Send"
          : "Facebook opened. Copy the message from the form if needed, then paste in Message on Facebook."
      );
      if (window.AlmaUI?.toast) {
        window.AlmaUI.toast(
          copied
            ? "Message copied! Facebook: Message → Paste → Send"
            : "Facebook opened — copy the preview, then paste in Message"
        );
      }
      e.target.reset();
      updateAgentPreview();
      setMode("bot");
    });

    renderSuggestions();
    setMode("bot");

    window.addEventListener("alma:live-agent", (ev) => {
      if (mode === "bot") setMode("bot");
      if ((mode === "live" || mode === "queued") && ev.detail?.type === "chats") {
        syncLiveMessages();
      }
      if (
        (mode === "live" || mode === "queued") &&
        ev.detail?.type === "presence" &&
        !agentOnline()
      ) {
        appendMessage(
          "system",
          "The live agent went offline. You can use Facebook if you still need help."
        );
        setMode("bot");
        stopLivePoll();
      }
    });
    setInterval(() => {
      if (mode === "bot") setMode("bot");
      if (mode === "queued" || mode === "live") syncLiveMessages();
    }, 4000);

    try {
      if (!sessionStorage.getItem("alma_chat_seen")) {
        if (badgeEl) badgeEl.hidden = false;
        sessionStorage.setItem("alma_chat_seen", "1");
      }
    } catch {
      /* ignore */
    }
  }

  window.AlmaChat = {
    open: openPanel,
    close: closePanel,
    toggle: togglePanel,
    ask: askFaq,
    openAgentModal,
    requestLiveAgent,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
