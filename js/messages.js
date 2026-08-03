"use strict";

(function createConnectedApps() {
  const trackEvent = (name, properties = {}, options = {}) =>
    window.GISAnalytics?.trackEvent(name, properties, options);
  const THREAD_URLS = ["data/messages/amber.json", "data/messages/naomi.json", "data/messages/chase-bank.json", "data/messages/selina.json", "data/messages/ghost-supply.json", "data/messages/fi-ent.json", "data/messages/tracey.json"];
  const DATA_URL = THREAD_URLS[0];
  const MUSIC_DATA_URL = "data/music/recently-deleted.json";
  let dataPromise = null;
  let threadsPromise = null;
  let musicPromise = null;
  let amberEnginePromise = null;
  let mapInstance = null;
  let mapSearchMarker = null;
  let lastGeocodeRequestAt = 0;
  const replyTimers = new Map();
  const SELINA_REPLIES = [
    { match: "where are you", reply: "Why?", delay: 35 },
    { match: "what are you doing", reply: "Getting ready to go to sleep.", delay: 16 },
    { match: "you up", reply: "Barely.", delay: 85 },
    { match: "can we talk", reply: "We’ve talked.", delay: 7 },
    { match: "i miss you", reply: "That doesn’t change anything.", delay: 38 },
    { match: "my bad", reply: "I know.", delay: 26 },
    { match: "you mad", reply: "I’m not mad anymore.", delay: 67 },
    { match: "call me", reply: "I don’t think that’s a good idea.", delay: 18 },
    { match: "good morning", reply: "Morning.", delay: 6 }
  ];
  const NAOMI_REPLIES = [
    { match: "where are you", reply: "Why, you coming to get me?", delay: 2 },
    { match: "what are you doing", reply: "Thinking about minding my business.", delay: 3 },
    { match: "you up", reply: "You know I am.", delay: 2 },
    { match: "come over", reply: "Send the address ...", delay: 3 },
    { match: "i miss you", reply: "Then act like it.", delay: 13 },
    { match: "call me", reply: "Can't right now, I'm with him", delay: 12 },
    { match: "my bad", reply: "Your bad always turns into my problem.", delay: 24 },
    { match: "you mad", reply: "Should I be?", delay: 3 },
    { match: "good morning", reply: "Don’t “good morning” me like you didn’t disappear last night.", delay: 14 }
  ];
  const REPLY_PROFILES = {
    selina: { rules: SELINA_REPLIES, fallback: { reply: "What do you want, Ed?", delay: 7 } },
    naomi: { rules: NAOMI_REPLIES, fallback: { reply: "Here you go starting again.", delay: 3 } }
  };
  const TRACEY_SEQUENCE = [
    { reply: "...Ed?", minDelay: 3, maxDelay: 8 },
    { reply: "Oh...\n\nThis definitely isn't Ed.\n\nHe lost his phone a little while ago.", minDelay: 6, maxDelay: 12 },
    { reply: "😂 He's actually been looking everywhere for it.\n\nI'll let him know someone found his phone.", minDelay: 8, maxDelay: 15 }
  ];

  function escapeHtml(value) {
    const node = document.createElement("div");
    node.textContent = String(value ?? "");
    return node.innerHTML;
  }

  function displayMessageDate(value) {
    return String(value || "").replace(/^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday),\s+/i, "");
  }

  function renderMessageText(value) {
    return escapeHtml(value)
      .replace(/(https:\/\/[^\s<]+)/g, '<a class="message-link" href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/\n/g, "<br>");
  }

  function contactVisual(contact, className = "") {
    return contact.photo
      ? `<img class="${className}" src="${escapeHtml(contact.photo)}" alt="">`
      : `<span class="contact-initials ${className}" aria-hidden="true">${escapeHtml(contact.initials || contact.name.charAt(0))}</span>`;
  }

  function getData() {
    if (!dataPromise) {
      dataPromise = fetch(DATA_URL).then((response) => {
        if (!response.ok) throw new Error("Messages could not be loaded.");
        return response.json();
      });
    }
    return dataPromise;
  }

  function readKey(threadId) {
    return `myphone.messages.${threadId}.read`;
  }

  function unreadKey(threadId) { return `myphone.messages.${threadId}.unread`; }
  function customKey(threadId) { return `myphone.messages.${threadId}.custom`; }
  function pendingKey(threadId) { return `myphone.messages.${threadId}.pending`; }
  function responseStateKey(threadId) { return `myphone.messages.${threadId}.response-state`; }

  function readStored(key) {
    try { const value = JSON.parse(localStorage.getItem(key)); return Array.isArray(value) ? value : []; }
    catch { return []; }
  }

  function readResponseState(threadId) {
    try {
      const state = JSON.parse(localStorage.getItem(responseStateKey(threadId)) || "{}");
      return state && typeof state === "object" ? state : {};
    } catch { return {}; }
  }

  function saveResponseState(threadId, state) {
    localStorage.setItem(responseStateKey(threadId), JSON.stringify(state));
  }

  function getAmberEngine(thread) {
    if (!amberEnginePromise) {
      amberEnginePromise = fetch(thread.responseEngine).then((response) => {
        if (!response.ok) throw new Error("Amber's response library could not be loaded.");
        return response.json();
      });
    }
    return amberEnginePromise;
  }

  function messagesForThread(thread) {
    materializeDueReplies(thread);
    return [...thread.messages, ...readStored(customKey(thread.threadId))];
  }

  function randomSeconds(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

  function nowMessage(sender, text) {
    const now = new Date();
    return {
      date: now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
      time: now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      sender,
      type: "text",
      text,
      ...(sender === "Ed" ? { receipt: "Read" } : {})
    };
  }

  function materializeDueReplies(thread) {
    const stored = readStored(customKey(thread.threadId));
    const updated = stored.map((message) => message.readAt && message.readAt <= Date.now()
      ? { ...message, receipt: "Read", readAt: undefined }
      : message);
    if (JSON.stringify(updated) !== JSON.stringify(stored)) localStorage.setItem(customKey(thread.threadId), JSON.stringify(updated));
    const pending = readStored(pendingKey(thread.threadId));
    const due = pending.filter((item) => item.dueAt <= Date.now());
    if (!due.length) return false;
    localStorage.setItem(customKey(thread.threadId), JSON.stringify([...updated, ...due.map((item) => nowMessage(thread.contact.name, item.reply))]));
    localStorage.setItem(pendingKey(thread.threadId), JSON.stringify(pending.filter((item) => item.dueAt > Date.now())));
    localStorage.setItem(unreadKey(thread.threadId), "1");
    return true;
  }

  function scheduleReplies(host, thread) {
    const existing = replyTimers.get(thread.threadId);
    if (existing) window.clearTimeout(existing);
    const pending = readStored(pendingKey(thread.threadId)).sort((a, b) => a.dueAt - b.dueAt);
    const receiptDue = readStored(customKey(thread.threadId)).filter((message) => message.readAt).map((message) => message.readAt);
    const nextDue = Math.min(...pending.map((item) => item.dueAt), ...receiptDue);
    if (!Number.isFinite(nextDue)) return;
    const timer = window.setTimeout(() => {
      const receivedNewMessage = materializeDueReplies(thread);
      replyTimers.delete(thread.threadId);
      if (host.querySelector(`[data-thread-id="${thread.threadId}"]`)) openThread(host, thread);
      else {
        if (receivedNewMessage) syncUnreadBadge();
        scheduleReplies(host, thread);
      }
    }, Math.max(0, nextDue - Date.now()));
    replyTimers.set(thread.threadId, timer);
  }

  function normalizeMessage(text) {
    return String(text || "").toLowerCase().replace(/[.,?!'"’]/g, "").replace(/\s+/g, " ").trim();
  }

  function categoryById(engine, id) {
    return engine.categories.find((category) => category.id === id);
  }

  function activeAmberCategory(engine, state) {
    if (!state.activeActivity || Number(state.activityUntil || 0) <= Date.now()) return null;
    return categoryById(engine, state.activeActivity);
  }

  function messageMatchesTrigger(normalized, trigger) {
    const value = normalizeMessage(trigger);
    if (!value) return false;
    if (normalized === value) return true;
    if (/[^\w\s]/.test(value)) return normalized.includes(value);
    return new RegExp(`(?:^|\\s)${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|\\s)`).test(normalized);
  }

  function matchingAmberCategory(engine, normalized, state) {
    const active = activeAmberCategory(engine, state);
    const contextQuestion = /^(where are you|what are you doing|wyd|busy|can you talk|why arent you replying)$/.test(normalized);
    if (active && contextQuestion) return active;
    const matches = engine.categories.filter((category) =>
      (category.triggers || []).some((trigger) => messageMatchesTrigger(normalized, trigger)));
    if (matches.length) {
      return matches.sort((left, right) => Math.max(...right.triggers.map((item) => item.length)) -
        Math.max(...left.triggers.map((item) => item.length)))[0];
    }
    const followUp = /^(why|how|where|when|what happened|you okay|are you okay|really|and then|then what)$/.test(normalized);
    if (followUp && state.lastCategory && Date.now() - Number(state.lastTopicAt || 0) < 15 * 60 * 1000) {
      return categoryById(engine, state.lastCategory);
    }
    return null;
  }

  function chooseAmberResponse(options, state) {
    const recent = Array.isArray(state.recentResponses) ? state.recentResponses : [];
    const available = options.filter((response) => !recent.includes(response));
    const pool = available.length ? available : options;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function persistAmberActivity(engine, category, response, state) {
    let activityCategory = category;
    if (category.id === "wyd" && /\bdriving\b/.test(response)) activityCategory = categoryById(engine, "driving");
    const activity = activityCategory?.activity;
    if (!activity) return;
    const durationMinutes = randomSeconds(activity.minMinutes, activity.maxMinutes);
    state.activeActivity = activityCategory.id;
    state.activityStartedAt = Date.now();
    state.activityUntil = Date.now() + durationMinutes * 60 * 1000;
  }

  function cleanRememberedValue(value) {
    return String(value || "").replace(/[.!?]+$/, "").trim().slice(0, 100);
  }

  function rememberAmberContext(text, normalized, state) {
    const facts = state.facts && typeof state.facts === "object" ? state.facts : {};
    const result = { kind: "", value: "", reply: "" };
    const patterns = [
      ["name", /\bmy name is ([a-z][a-z '-]{1,40})/i],
      ["location", /\bi live in ([a-z0-9][a-z0-9 ,.'-]{1,60})/i],
      ["workplace", /\bi work at ([a-z0-9][a-z0-9 &.'-]{1,60})/i],
      ["favorite", /\bmy favorite (?:thing|food|song|movie|show|place)?\s*(?:is|=)\s*([^.!?]{2,80})/i],
      ["like", /\bi (?:really )?(?:like|love) ([^.!?]{2,80})/i],
      ["dislike", /\bi (?:really )?(?:hate|dont like|don't like) ([^.!?]{2,80})/i]
    ];
    for (const [key, pattern] of patterns) {
      const match = text.match(pattern);
      if (!match) continue;
      const value = cleanRememberedValue(match[1]);
      facts[key] = value;
      result.kind = key;
      result.value = value;
      result.reply = key === "name" ? `okay ${value}. i got you.`
        : key === "location" ? `okay. how do you like living in ${value}?`
        : key === "workplace" ? `okay. how long have you been at ${value}?`
        : key === "dislike" ? "noted 😂 what don't you like about it?"
        : "okay noted 😂 what do you like about it?";
      break;
    }

    const emotion = normalized.match(/\b(?:im|i am|ive been|i feel) (happy|good|great|excited|proud|tired|exhausted|sad|upset|angry|mad|stressed|anxious|worried|sick|hurt|lonely)\b/);
    if (!result.kind && emotion) {
      const value = emotion[1];
      facts.lastFeeling = value;
      result.kind = "feeling";
      result.value = value;
      result.reply = /happy|good|great|excited|proud/.test(value)
        ? "okayyy i love that for you 😂 what happened?"
        : /tired|exhausted|sick/.test(value)
          ? "you need to slow down for a minute. you okay?"
          : "what happened? you wanna talk about it?";
    }

    const sharedActivities = [
      ["work", /\b(?:im|i am) (?:at work|working)\b/, "how's work been today?"],
      ["gym", /\b(?:im|i am) (?:at the gym|working out)\b/, "you almost done or just getting started?"],
      ["food", /\b(?:im|i am) (?:eating|getting food|making food)\b/, "what'd you get?"],
      ["driving", /\b(?:im|i am) (?:driving|in the car|on the road)\b/, "okay text me when you stop. where you headed?"],
      ["shopping", /\b(?:im|i am) (?:shopping|at the store|at the mall)\b/, "what are you looking for?"],
      ["watching-tv", /\b(?:im|i am) watching\b/, "what are you watching?"],
      ["travel", /\b(?:im|i am) (?:traveling|out of town|on a trip)\b/, "okay where'd you go?"],
      ["plan", /\b(?:im|i am|were|we are) (?:going to|gonna|planning to) ([^.!?]{2,100})/i, "okay. how do you feel about it?"]
    ];
    if (!result.kind) {
      for (const [kind, pattern, reply] of sharedActivities) {
        const match = normalized.match(pattern);
        if (!match) continue;
        result.kind = kind;
        result.value = cleanRememberedValue(match[1] || kind);
        result.reply = reply;
        facts.lastUserActivity = result.value;
        break;
      }
    }

    state.facts = facts;
    state.recentUserMessages = [...(state.recentUserMessages || []), {
      text: text.slice(0, 500),
      at: Date.now(),
      topic: result.kind || state.lastCategory || "conversation"
    }].slice(-12);
    return result;
  }

  function recalledAmberReply(state) {
    const facts = state.facts || {};
    const details = [
      facts.name ? `your name is ${facts.name}` : "",
      facts.location ? `you live in ${facts.location}` : "",
      facts.workplace ? `you work at ${facts.workplace}` : "",
      facts.favorite ? `your favorite is ${facts.favorite}` : "",
      facts.like ? `you like ${facts.like}` : "",
      facts.dislike ? `you don't like ${facts.dislike}` : "",
      facts.lastFeeling ? `you said you were feeling ${facts.lastFeeling}` : "",
      facts.lastUserActivity ? `last you told me, you were ${facts.lastUserActivity}` : ""
    ].filter(Boolean);
    if (!details.length) return "i remember what we talk about. you just haven't told me much about you yet 😂";
    return `yeah i remember. ${details.slice(0, 3).join(", and ")}.`;
  }

  function contextualAmberReply(text, normalized, state, sharedContext) {
    if (/\b(remember|what do you know about me|what did i tell you|do you know my)\b/.test(normalized)) {
      return recalledAmberReply(state);
    }
    if (sharedContext.reply) return sharedContext.reply;
    if (state.awaitingAnswer && !text.includes("?") && Date.now() - Number(state.questionAskedAt || 0) < 15 * 60 * 1000) {
      state.awaitingAnswer = false;
      return chooseAmberResponse([
        "okay. that makes sense.",
        "i hear you. how do you feel about it though?",
        "okay wait... tell me the rest.",
        "yeah i get what you mean.",
        "see that makes more sense now."
      ], state);
    }
    if (text.includes("?")) {
      return chooseAmberResponse([
        "hmm. why do you ask?",
        "honestly i'm not sure yet. what do you think?",
        "maybe. i need more context 😂",
        "wait what made you think about that?",
        "i can answer that but you gotta tell me what happened first."
      ], state);
    }
    if (/^(yes|yeah|yep|no|nah|maybe|idk|i dont know|i don't know|okay|ok)$/.test(normalized)) {
      return chooseAmberResponse(["fair enough 😂", "okay.", "mmhmm.", "i hear you.", "that's what i thought."], state);
    }
    return chooseAmberResponse([
      "okay wait... tell me more.",
      "yeah i can see that. what happened after?",
      "i'm listening.",
      "that makes sense honestly.",
      "okay. how do you feel about it?",
      "and what are you gonna do?",
      "see now i need the whole story 😂"
    ], state);
  }

  async function queueAmberReply(host, thread, text) {
    const engine = await getAmberEngine(thread);
    const normalized = normalizeMessage(text);
    const state = readResponseState(thread.threadId);
    const previousUserAt = Number(state.lastUserAt || 0);
    const active = activeAmberCategory(engine, state);
    const doubleText = previousUserAt && Date.now() - previousUserAt < 45 * 1000;
    localStorage.setItem(pendingKey(thread.threadId), JSON.stringify([]));
    state.lastUserAt = Date.now();
    state.lastUserMessage = text.slice(0, 500);
    state.messageCount = Number(state.messageCount || 0) + 1;

    const canLeaveOnRead = active && ["driving", "work", "shopping", "gym", "travel", "sleep"].includes(active.id);
    if ((active?.id === "sleep" && Math.random() < 0.8) ||
        (canLeaveOnRead && doubleText && Math.random() < Number(engine.leaveOnReadChance || 0))) {
      state.leftOnReadAt = Date.now();
      saveResponseState(thread.threadId, state);
      return;
    }

    const sharedContext = rememberAmberContext(text, normalized, state);
    const memoryQuestion = /\b(remember|what do you know about me|what did i tell you|do you know my)\b/.test(normalized);
    const category = sharedContext.kind || memoryQuestion ? null : matchingAmberCategory(engine, normalized, state);
    const responses = category?.responses || [];
    const reply = category && responses.length
      ? chooseAmberResponse(responses, state)
      : contextualAmberReply(text, normalized, state, sharedContext);
    if (!reply) return;
    const triggerDelay = category?.triggerDelays?.[normalized];
    const delay = Number(triggerDelay ?? category?.delaySeconds ?? engine.defaultDelaySeconds ?? 4);
    persistAmberActivity(engine, category || { id: "fallback" }, reply, state);
    state.lastCategory = category?.id || sharedContext.kind || state.lastCategory || "conversation";
    state.lastTopicAt = Date.now();
    state.lastResponse = reply;
    state.awaitingAnswer = reply.trim().endsWith("?");
    state.questionAskedAt = state.awaitingAnswer ? Date.now() : Number(state.questionAskedAt || 0);
    state.recentResponses = [...(state.recentResponses || []), reply].slice(-5);
    saveResponseState(thread.threadId, state);

    const pending = readStored(pendingKey(thread.threadId));
    const bubbles = reply.split(/\n{2,}/).map((bubble) => bubble.trim()).filter(Boolean).slice(0, 2);
    let dueAt = Date.now() + delay * 1000;
    const queued = bubbles.map((bubble, index) => {
      if (index) dueAt += randomSeconds(1, 3) * 1000;
      return { reply: bubble, dueAt };
    });
    localStorage.setItem(pendingKey(thread.threadId), JSON.stringify([...pending, ...queued]));
    scheduleReplies(host, thread);
  }

  async function queueReply(host, thread, text) {
    if (thread.threadId === "tracey") {
      const storedReplies = readStored(customKey(thread.threadId)).filter((message) => message.sender === thread.contact.name && TRACEY_SEQUENCE.some((step) => step.reply === message.text)).length;
      const pending = readStored(pendingKey(thread.threadId));
      const stage = storedReplies + pending.filter((item) => TRACEY_SEQUENCE.some((step) => step.reply === item.reply)).length;
      if (stage >= TRACEY_SEQUENCE.length) return;
      const step = TRACEY_SEQUENCE[stage];
      const naturalDueAt = Date.now() + randomSeconds(step.minDelay, step.maxDelay) * 1000;
      const previousDueAt = pending.reduce((latest, item) => Math.max(latest, item.dueAt || 0), 0);
      localStorage.setItem(pendingKey(thread.threadId), JSON.stringify([...pending, { reply: step.reply, dueAt: Math.max(naturalDueAt, previousDueAt + 1000) }]));
      scheduleReplies(host, thread);
      return;
    }
    if (thread.threadId === "amber") {
      await queueAmberReply(host, thread, text);
      return;
    }
    const profile = REPLY_PROFILES[thread.threadId];
    if (!profile) return;
    const normalized = normalizeMessage(text);
    let rule = profile.rules.find((item) => item.match === normalized);
    if (!rule) {
      const fallbackUsedKey = `myphone.messages.${thread.threadId}.fallback-used`;
      const fallbackAlreadyStored = readStored(customKey(thread.threadId)).some((message) => message.text === profile.fallback.reply)
        || readStored(pendingKey(thread.threadId)).some((item) => item.reply === profile.fallback.reply);
      if (localStorage.getItem(fallbackUsedKey) === "1" || fallbackAlreadyStored) {
        localStorage.setItem(fallbackUsedKey, "1");
        return;
      }
      localStorage.setItem(fallbackUsedKey, "1");
      rule = profile.fallback;
    }
    const pending = readStored(pendingKey(thread.threadId));
    localStorage.setItem(pendingKey(thread.threadId), JSON.stringify([...pending, { reply: rule.reply, dueAt: Date.now() + rule.delay * 1000 }]));
    scheduleReplies(host, thread);
  }

  function isUnread(thread) {
    return localStorage.getItem(unreadKey(thread.threadId)) === "1"
      || (thread.initiallyUnread !== false && localStorage.getItem(readKey(thread.threadId)) !== "1");
  }

  function getThreads() {
    if (!threadsPromise) {
      threadsPromise = Promise.all(THREAD_URLS.map((url) => fetch(url).then((response) => {
        if (!response.ok) throw new Error("Messages could not be loaded.");
        return response.json();
      })));
    }
    return threadsPromise;
  }

  function getMusicData() {
    if (!musicPromise) {
      musicPromise = fetch(MUSIC_DATA_URL).then((response) => {
        if (!response.ok) throw new Error("Album artwork could not be loaded.");
        return response.json();
      });
    }
    return musicPromise;
  }

  async function syncUnreadBadge() {
    try {
      const threads = await getThreads();
      const hasUnread = localStorage.getItem("myphone.settings.notifications") !== "0" && threads.some(isUnread);
      document.querySelectorAll("[data-messages-unread]").forEach((badge) => { badge.hidden = !hasUnread; });
    } catch { /* The app view will show the loading error if opened. */ }
  }

  function photoById(data, id) {
    return data.photos.find((photo) => photo.id === id);
  }

  function locationById(data, id) {
    return data.locations.find((location) => location.id === id);
  }

  function latestReceived(thread) {
    let currentDate = "";
    let currentTime = "12:00 AM";
    const messages = messagesForThread(thread);
    let latest = { timestamp: 0, time: "", message: messages.at(-1) };

    messages.forEach((message) => {
      if (message.date) currentDate = message.date;
      if (message.time) currentTime = message.time;
      if (message.sender === "Ed" || message.sender === "You" || !currentDate) return;
      const timestamp = Date.parse(`${currentDate} ${currentTime}`);
      if (!Number.isNaN(timestamp) && timestamp >= latest.timestamp) {
        latest = { timestamp, time: currentTime, message };
      }
    });

    return latest;
  }

  async function openMessages(host) {
    trackEvent("section_viewed", { app_name: "messages", section: "threads" });
    host.innerHTML = `<p class="app-loading">Loading Messages…</p>`;
    try {
      const threads = [...await getThreads()].sort((a, b) => latestReceived(b).timestamp - latestReceived(a).timestamp);
      host.innerHTML = `
        <section class="messages-list-view">
          <div class="messages-list-heading"><h2>Messages</h2><button type="button" aria-label="Compose message">•••</button></div>
          ${threads.map((thread) => {
            const last = latestReceived(thread);
            return `<button class="message-thread-row" type="button" data-open-thread="${escapeHtml(thread.threadId)}">
              <span class="thread-unread-dot" ${isUnread(thread) ? "" : "hidden"}></span>
              ${contactVisual(thread.contact)}
              <span class="thread-summary"><strong>${escapeHtml(thread.contact.name)}</strong><small>${escapeHtml(last.time)}</small><p>${escapeHtml(last.message?.text || thread.preview || "")}</p></span>
              <span class="thread-chevron">›</span>
            </button>`;
          }).join("")}
        </section>`;
      syncUnreadBadge();
      host.querySelectorAll("[data-open-thread]").forEach((button) => button.addEventListener("click", () => {
        const thread = threads.find((item) => item.threadId === button.dataset.openThread);
        if (thread) {
          button.querySelector(".thread-unread-dot")?.setAttribute("hidden", "");
          openThread(host, thread);
        }
      }));
    } catch (error) {
      host.innerHTML = `<p class="app-error">${escapeHtml(error.message)}</p>`;
    }
  }

  async function openThreadById(host, threadId) {
    const threads = await getThreads();
    const thread = threads.find((item) => item.threadId === threadId);
    if (thread) openThread(host, thread);
    else openMessages(host);
  }

  function renderAttachment(data, message) {
    if (message.type === "image") {
      const photo = photoById(data, message.photoId);
      return photo ? `<img class="message-photo" src="${escapeHtml(photo.src)}" alt="${escapeHtml(photo.caption)}">` : "";
    }
    if (message.type === "location") {
      const location = locationById(data, message.locationId);
      if (!location) return "";
      return `
        <button class="message-location-card" type="button" data-message-location="${escapeHtml(location.id)}">
          <span class="mini-map"><i></i><b></b></span>
          <strong>${escapeHtml(location.name)}</strong>
          <small>${escapeHtml(location.address)}</small>
        </button>`;
    }
    return "";
  }

  function openThread(host, data) {
    trackEvent("message_thread_opened", {
      app_name: "messages",
      content_id: data.threadId,
      content_title: data.contact?.name
    });
    const threadMessages = messagesForThread(data);
    localStorage.setItem(readKey(data.threadId), "1");
    localStorage.removeItem(unreadKey(data.threadId));
    syncUnreadBadge();
    host.innerHTML = `
      <section class="message-conversation" data-thread-id="${escapeHtml(data.threadId)}">
        <header class="conversation-header">
          <button type="button" data-back-messages aria-label="Back to messages">‹</button>
          <div class="conversation-contact-glass">
            ${contactVisual(data.contact)}
            <strong>${escapeHtml(data.contact.name)}</strong>
          </div>
        </header>
        <div class="conversation-stream">
          ${data.systemNotice ? `<div class="message-system"><strong>${escapeHtml(data.systemNotice.title)}</strong><span>${escapeHtml(data.systemNotice.text)}</span></div>` : ""}
          ${threadMessages.map((message) => {
            const outgoing = message.sender === "Ed" || message.sender === "You";
            if (message.type === "status") return `
              ${message.date ? `<div class="message-date">${escapeHtml(displayMessageDate(message.date))}${message.time ? ` · ${escapeHtml(message.time)}` : ""}</div>` : ""}
              <div class="message-status-event"><strong>${escapeHtml(message.status)}</strong>${message.note ? `<span>${escapeHtml(message.note)}</span>` : ""}</div>`;
            return `
              ${message.date ? `<div class="message-date">${escapeHtml(displayMessageDate(message.date))}${data.groupedTimestamps && message.time ? ` · ${escapeHtml(message.time)}` : ""}</div>` : ""}
              ${message.breakBefore ? `<div class="message-gap"></div>` : ""}
              <article class="message-item ${outgoing ? "outgoing" : "incoming"} ${data.platform === "android" && outgoing ? "android-message" : ""} ${data.threadStyle === "bank-alerts" ? "bank-message" : ""}">
                ${data.groupedTimestamps ? "" : `<time>${escapeHtml(message.time)}</time>`}
                <div class="message-bubble ${message.type !== "text" ? `has-${message.type}` : ""}">
                  ${renderAttachment(data, message)}
                  ${message.text ? `<p>${renderMessageText(message.text)}</p>` : ""}
                </div>
                ${outgoing && message.receipt ? `<small class="message-receipt">${escapeHtml(message.receipt)}</small>` : ""}
                ${message.status ? `<small class="message-receipt ${outgoing ? "" : "incoming-status"}">${escapeHtml(message.status)}</small>` : ""}
              </article>`;
          }).join("")}
          ${readStored(pendingKey(data.threadId)).length ? `<article class="message-item incoming typing-message" aria-label="${escapeHtml(data.contact.name)} is typing"><div class="message-bubble typing-indicator"><i></i><i></i><i></i></div></article>` : ""}
        </div>
        <form class="message-composer" data-message-composer>
          <input name="message" type="text" autocomplete="off" placeholder="Text Message" aria-label="Message" maxlength="500">
          <button type="submit" aria-label="Send message">↑</button>
        </form>
      </section>`;
    host.querySelector("[data-back-messages]").addEventListener("click", () => {
      trackEvent("message_thread_closed", { app_name: "messages", content_id: data.threadId });
      openMessages(host);
    });
    host.querySelectorAll("[data-message-location]").forEach((button) => {
      button.addEventListener("click", () => openMaps(host, button.dataset.messageLocation));
    });
    host.querySelector("[data-message-composer]").addEventListener("submit", async (event) => {
      event.preventDefault();
      const input = event.currentTarget.elements.message;
      const text = input.value.trim();
      if (!text) return;
      trackEvent("message_reply_selected", {
        app_name: "messages",
        content_id: data.threadId,
        interaction_type: "freeform_reply",
        character_count_bucket: text.length < 25 ? "1-24" : text.length < 100 ? "25-99" : "100+"
      });
      const stored = readStored(customKey(data.threadId));
      const outgoing = nowMessage("Ed", text);
      if (data.threadId === "tracey") {
        outgoing.receipt = "Delivered";
        outgoing.readAt = Date.now() + randomSeconds(2, 5) * 1000;
      }
      localStorage.setItem(customKey(data.threadId), JSON.stringify([...stored, outgoing]));
      await queueReply(host, data, text);
      openThread(host, data);
    });
    scheduleReplies(host, data);
    const windowNode = document.getElementById("appWindow");
    windowNode.scrollTop = windowNode.scrollHeight;
  }

  async function openPhotos(host) {
    trackEvent("section_viewed", { app_name: "photos", section: "library" });
    host.innerHTML = `<p class="app-loading">Loading Photos…</p>`;
    const [data, music] = await Promise.all([getData(), getMusicData()]);
    const uniqueTrackArtworkNumbers = new Set([1, 4, 10]);
    const albumPhotos = [
      { id: "album-cover", src: music.artwork, caption: `${music.album} — Album Cover` },
      ...music.tracks
        .filter((track) => uniqueTrackArtworkNumbers.has(track.number))
        .map((track) => ({ id: `track-${track.number}`, src: track.artwork, caption: `${track.number}. ${track.title}` }))
    ];
    const photos = [...data.photos, ...albumPhotos].filter((photo, index, list) => list.findIndex((item) => item.src === photo.src) === index);
    host.innerHTML = `
      <section class="photos-library">
        <header><h2>Library</h2><span>${photos.length} Photos</span></header>
        <div class="photos-grid">
          ${photos.map((photo) => `<button type="button" data-photo-src="${escapeHtml(photo.src)}" aria-label="View ${escapeHtml(photo.caption)}"><img src="${escapeHtml(photo.src)}" alt="${escapeHtml(photo.caption)}" draggable="false"></button>`).join("")}
        </div>
        <div class="photo-lightbox" hidden><button type="button" aria-label="Close photo">×</button><img alt="">
          ${window.GISAnalytics?.context().accessType === "DJ" ? `<a class="photo-download-link" download>Download Artwork</a>` : ""}
        </div>
      </section>`;
    const lightbox = host.querySelector(".photo-lightbox");
    host.querySelectorAll("[data-photo-src]").forEach((button) => button.addEventListener("click", () => {
      const photo = photos.find((item) => item.src === button.dataset.photoSrc);
      trackEvent("artwork_viewed", {
        app_name: "photos",
        asset_id: photo?.id,
        asset_title: photo?.caption,
        asset_category: photo?.id === "album-cover" || photo?.id?.startsWith("track-") ? "artwork" : "photo",
        file_type: String(photo?.src || "").split(".").pop()?.toLowerCase()
      });
      trackEvent("image_enlarged", {
        app_name: "photos",
        asset_id: photo?.id,
        asset_title: photo?.caption
      });
      lightbox.querySelector("img").src = button.dataset.photoSrc;
      const download = lightbox.querySelector(".photo-download-link");
      if (download) {
        download.href = button.dataset.photoSrc;
        download.dataset.assetId = photo?.id || "";
        download.dataset.assetTitle = photo?.caption || "";
        download.dataset.assetCategory = "artwork";
        download.onclick = () => trackEvent("artwork_downloaded", {
          app_name: "photos",
          asset_id: photo?.id,
          asset_title: photo?.caption,
          asset_category: photo?.id === "album-cover" || photo?.id?.startsWith("track-") ? "artwork" : "photo",
          file_type: String(photo?.src || "").split(".").pop()?.toLowerCase(),
          completion_detection: "browser_download_requested"
        });
      }
      lightbox.hidden = false;
    }));
    lightbox.querySelector("button").addEventListener("click", () => { lightbox.hidden = true; });
  }

  async function openMaps(host, selectedId) {
    host.innerHTML = `<p class="app-loading">Loading Maps…</p>`;
    const data = await getData();
    const location = locationById(data, selectedId) || data.locations[0];
    if (!location) {
      host.innerHTML = `<p class="empty-state">No saved locations yet.</p>`;
      return;
    }
    host.innerHTML = `
      <section class="maps-view">
        <form class="maps-search" data-map-search>
          <span aria-hidden="true">⌕</span>
          <input type="search" name="address" placeholder="Search any address" aria-label="Search any address" autocomplete="street-address">
          <button type="submit">Search</button>
        </form>
        <div class="map-search-results" data-map-search-results hidden></div>
        <button class="maps-recenter" type="button" data-map-recenter aria-label="Return to saved location">⌖</button>
        <div class="maps-canvas" id="savedLocationsMap" aria-label="Interactive map of saved locations"></div>
        <h3 class="saved-places-heading">Saved Places</h3>
        <div class="saved-places-strip">
          ${data.locations.map((place) => `<button type="button" data-saved-place="${escapeHtml(place.id)}"><span>●</span><strong>${escapeHtml(place.name)}</strong><small>${escapeHtml(place.address)}</small></button>`).join("")}
        </div>
        <article class="map-place-card" data-map-place-card>
          <p>SAVED FROM MESSAGES</p><h2>${escapeHtml(location.name)}</h2><span>${escapeHtml(location.address)}</span>
          <small>${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}</small>
        </article>
      </section>`;

    if (!window.L) {
      host.querySelector(".maps-canvas").innerHTML = `<p class="app-error">The interactive map could not be loaded.</p>`;
      return;
    }

    mapInstance?.remove();
    mapInstance = window.L.map("savedLocationsMap", { zoomControl: false, attributionControl: true }).setView([location.latitude, location.longitude], 15);
    window.L.control.zoom({ position: "bottomright" }).addTo(mapInstance);
    window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(mapInstance);

    const pinIcon = window.L.divIcon({ className: "saved-map-pin-wrap", html: '<span class="saved-map-pin"><i></i></span>', iconSize: [38, 46], iconAnchor: [19, 43] });
    const searchPinIcon = window.L.divIcon({ className: "search-map-pin-wrap", html: '<span class="search-map-pin"><i></i></span>', iconSize: [34, 42], iconAnchor: [17, 39] });
    const markers = new Map();

    function selectPlace(place, pan = true) {
      const card = host.querySelector("[data-map-place-card]");
      card.innerHTML = `<p>SAVED FROM MESSAGES</p><h2>${escapeHtml(place.name)}</h2><span>${escapeHtml(place.address)}</span><small>${place.latitude.toFixed(5)}, ${place.longitude.toFixed(5)}</small>`;
      host.querySelectorAll("[data-saved-place]").forEach((button) => button.classList.toggle("active", button.dataset.savedPlace === place.id));
      if (pan) mapInstance.flyTo([place.latitude, place.longitude], 16, { duration: 0.75 });
      markers.get(place.id)?.openPopup();
    }

    data.locations.forEach((place) => {
      const marker = window.L.marker([place.latitude, place.longitude], { icon: pinIcon, title: place.name, alt: place.name })
        .addTo(mapInstance)
        .bindPopup(`<strong>${escapeHtml(place.name)}</strong><br><span>${escapeHtml(place.address)}</span>`);
      marker.on("click", () => selectPlace(place, false));
      markers.set(place.id, marker);
    });

    host.querySelectorAll("[data-saved-place]").forEach((button) => button.addEventListener("click", () => {
      const place = locationById(data, button.dataset.savedPlace);
      if (place) selectPlace(place);
    }));
    host.querySelector("[data-map-recenter]").addEventListener("click", () => selectPlace(location));
    host.querySelector("[data-map-search]").addEventListener("submit", async (event) => {
      event.preventDefault();
      const query = String(new FormData(event.currentTarget).get("address") || "").trim();
      if (query.length < 3) return;
      const resultsNode = host.querySelector("[data-map-search-results]");
      resultsNode.hidden = false;
      resultsNode.innerHTML = `<p>Searching…</p>`;
      try {
        const cacheKey = `myphone.map-search.${query.toLowerCase()}`;
        let results = null;
        try { results = JSON.parse(localStorage.getItem(cacheKey)); } catch { /* Fetch below. */ }
        if (!Array.isArray(results)) {
          const wait = Math.max(0, 1100 - (Date.now() - lastGeocodeRequestAt));
          if (wait) await new Promise((resolve) => window.setTimeout(resolve, wait));
          lastGeocodeRequestAt = Date.now();
          const searchUrl = new URL("https://nominatim.openstreetmap.org/search");
          searchUrl.search = new URLSearchParams({ q: query, format: "jsonv2", addressdetails: "1", limit: "5" });
          const response = await fetch(searchUrl, { headers: { Accept: "application/json" } });
          if (!response.ok) throw new Error("Address search is temporarily unavailable.");
          results = await response.json();
          localStorage.setItem(cacheKey, JSON.stringify(results));
        }
        resultsNode.innerHTML = results.length ? results.map((result, index) => `<button type="button" data-map-result="${index}"><strong>${escapeHtml(result.name || result.display_name.split(",")[0])}</strong><small>${escapeHtml(result.display_name)}</small></button>`).join("") : `<p>No matching addresses found.</p>`;
        resultsNode.querySelectorAll("[data-map-result]").forEach((button) => button.addEventListener("click", () => {
          const result = results[Number(button.dataset.mapResult)];
          const latitude = Number(result.lat);
          const longitude = Number(result.lon);
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
          mapSearchMarker?.remove();
          mapSearchMarker = window.L.marker([latitude, longitude], { icon: searchPinIcon, title: result.display_name }).addTo(mapInstance);
          mapSearchMarker.bindPopup(`<strong>${escapeHtml(result.name || result.display_name.split(",")[0])}</strong><br><span>${escapeHtml(result.display_name)}</span>`).openPopup();
          mapInstance.flyTo([latitude, longitude], 16, { duration: .75 });
          host.querySelector("[data-map-place-card]").innerHTML = `<p>SEARCH RESULT · NOT SAVED</p><h2>${escapeHtml(result.name || result.display_name.split(",")[0])}</h2><span>${escapeHtml(result.display_name)}</span><small>${latitude.toFixed(5)}, ${longitude.toFixed(5)}</small>`;
          resultsNode.hidden = true;
        }));
      } catch (error) {
        resultsNode.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
      }
    });
    selectPlace(location, false);
    window.setTimeout(() => mapInstance?.invalidateSize(), 80);
  }

  window.MyMessages = { openMessages, openThreadById, openPhotos, openMaps, syncUnreadBadge };
})();
