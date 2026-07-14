"use strict";

const root = document.getElementById("site-root");

const CORRECT_PASSCODE = "1010";

let enteredPasscode = "";

let swipeStartY = 0;
let swipeCurrentY = 0;
let swipeTracking = false;

let faceIdSequenceRunning = false;
let weatherRefreshTimer = null;

const apps = [
  {
    id: "music",
    name: "Music",
    icon: "♪",
    description: "Recently Deleted and future releases will live here."
  },
  {
    id: "photos",
    name: "Photos",
    icon: "▧",
    description: "The photo and video gallery will live here."
  },
  {
    id: "notes",
    name: "Notes",
    icon: "✎",
    description: "Track notes and lyrics will live here."
  },
  {
    id: "settings",
    name: "Settings",
    icon: "⚙",
    description: "Site preferences and information will live here."
  },
  {
    id: "mail",
    name: "Mail",
    icon: "✉",
    description: "Advertisements, partnerships and announcements will live here."
  },
  {
    id: "instagram",
    name: "Instagram",
    icon: "◎",
    description: "This will connect visitors to the selected Instagram profile."
  },
  {
    id: "supply",
    name: "Supply",
    icon: "S",
    description: "Limited objects and releases."
  },
  {
    id: "maps",
    name: "Maps",
    icon: "⌖",
    description: "Shared locations will live here."
  }
];

const dockApps = [
  {
    id: "phone",
    name: "Phone",
    icon: "☎",
    description: "The phone connection will live here."
  },
  {
    id: "messages",
    name: "Messages",
    icon: "●",
    description: "Listener messages will live here."
  }
];

function bootSite() {
  root.innerHTML = `
    <main class="device" id="device">
      ${renderHomeScreen()}
      ${renderPasscodeScreen()}
      ${renderLostPhoneScreen()}
      ${renderFaceIdScreen()}
      ${renderLockScreen()}
      ${renderAppWindow()}
      ${renderSystemDock()}
      ${renderDynamicIsland()}
    </main>
  `;

  bindEvents();
  updateDateAndTime();
  initializeBattery();
  initializeWeather();
  window.MyMessages?.syncUnreadBadge();
  initializeMediaProtection();
  window.MyMail?.initialize();
  window.MySettings?.applyPreferences();
  window.MyPhone?.syncBadge();

  window.setInterval(updateDateAndTime, 1000);
}

function initializeMediaProtection() {
  const protectImages = (scope = document) => {
    scope.querySelectorAll?.("img").forEach((image) => {
      image.draggable = false;
      image.setAttribute("data-protected-media", "");
    });
  };

  protectImages();

  new MutationObserver((mutations) => {
    mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
      if (node.nodeType === 1) {
        if (node.matches?.("img")) protectImages(node.parentElement || document);
        else protectImages(node);
      }
    }));
  }).observe(document.body, { childList: true, subtree: true });

  document.addEventListener("dragstart", (event) => {
    if (event.target.closest?.("img")) event.preventDefault();
  }, true);

  document.addEventListener("contextmenu", (event) => {
    if (event.target.closest?.("img, [data-photo-src]")) event.preventDefault();
  }, true);

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if ((event.metaKey || event.ctrlKey) && ["s", "u", "p"].includes(key)) event.preventDefault();
  }, true);
}

function renderStatusBar() {
  return `
    <div class="status-bar">
      <div class="status-left">
        <span class="status-time" data-status-time></span>
      </div>

      <div class="status-right">
        <div class="signal-icon" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
          <span></span>
        </div>

        <span class="network-label" aria-hidden="true">GIS</span>

        <div class="battery-wrap">
          <span class="battery-percent" data-battery-percent></span>

          <div class="battery-shell" aria-label="Battery">
            <div
              class="battery-fill"
              data-battery-fill
            ></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderLockScreen() {
  return `
    <section class="screen lock-screen" id="lockScreen">
      ${renderStatusBar()}

      <div class="lock-content">
        <p class="lock-date" id="lockDate"></p>

        <div class="lock-clock">
          <h1 class="lock-time" id="lockTime"></h1>
          <span class="lock-period" id="lockPeriod"></span>
        </div>
      </div>

      <div class="lock-bottom">
        <div class="swipe-zone" id="swipeZone">
          <div class="swipe-arrow">⌃</div>
          <p class="swipe-text">swipe up to access</p>
          <div class="home-indicator"></div>
        </div>
      </div>
    </section>
  `;
}

function renderFaceIdScreen() {
  return `
    <section
      class="screen face-id-screen screen-hidden"
      id="faceIdScreen"
    >
      ${renderStatusBar()}
    </section>
  `;
}

function renderDynamicIsland() {
  return `
    <div class="dynamic-island" id="dynamicIsland" aria-live="polite">
      <div class="island-face" aria-hidden="true">
        <span class="island-eye left"></span>
        <span class="island-eye right"></span>
        <span class="island-mouth"></span>
        <span class="island-scan-line"></span>
      </div>
      <div class="island-copy">
        <strong id="islandTitle">Face ID</strong>
        <span id="islandMessage">Scanning…</span>
      </div>
      <span class="island-status" aria-hidden="true"></span>
    </div>
  `;
}

function renderPasscodeScreen() {
  const keys = [
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "",
    "0",
    "delete"
  ];

  return `
    <section
      class="screen passcode-screen screen-hidden"
      id="passcodeScreen"
    >
      ${renderStatusBar()}

      <div class="passcode-layout">
        <div class="passcode-center">
          <h1 class="passcode-heading">Enter Passcode</h1>

          <p class="passcode-subtitle">
            Face ID was not recognized
          </p>

          <div class="passcode-dots">
            ${Array.from(
              { length: 4 },
              () => `<span class="passcode-dot"></span>`
            ).join("")}
          </div>

          <p class="passcode-error" id="passcodeError" aria-live="assertive">
            Incorrect passcode
          </p>

          <div class="keypad">
            ${keys
              .map((key) => {
                if (key === "") {
                  return `<div class="keypad-space"></div>`;
                }

                if (key === "delete") {
                  return `
                    <button
                      class="passcode-key"
                      type="button"
                      data-key="delete"
                      aria-label="Delete number"
                    >
                      ⌫
                    </button>
                  `;
                }

                return `
                  <button
                    class="passcode-key"
                    type="button"
                    data-key="${key}"
                  >
                    ${key}
                  </button>
                `;
              })
              .join("")}
          </div>
        </div>
      </div>

      <div class="passcode-actions">
        <button class="passcode-action" id="emergencyButton" type="button">
          Emergency
        </button>

        <button
          class="passcode-action"
          id="cancelPasscode"
          type="button"
        >
          Cancel
        </button>
      </div>
    </section>
  `;
}

function renderLostPhoneScreen() {
  return `
    <section class="screen lost-phone-screen screen-hidden" id="lostPhoneScreen">
      <div class="lost-phone-message">
        <h1>THIS PHONE HAS BEEN MARKED AS LOST</h1>
        <p>If found, please return it to its owner.</p>
        <p>Limited access has been enabled to help identify the owner.</p>
        <div class="lost-access-code"><span>Access Code:</span><strong>1010</strong></div>
        <button type="button" id="enterAccessCode">ENTER ACCESS CODE</button>
      </div>
    </section>`;
}

function renderHomeScreen() {
  return `
    <section
      class="screen home-screen screen-hidden"
      id="homeScreen"
    >
      ${renderStatusBar()}

      <div class="app-grid">
        ${renderWeatherWidget()}
        ${apps.map(renderAppButton).join("")}
      </div>
    </section>
  `;
}

function renderWeatherWidget() {
  return `
    <article class="weather-widget" aria-label="Local weather">
      <div class="weather-location-row">
        <strong id="weatherLocation">Ed's Location</strong>
        <span class="weather-location-arrow" aria-hidden="true">◆</span>
      </div>
      <div class="weather-temperature" id="weatherTemperature">--°</div>
      <div class="weather-details">
        <span class="weather-symbol" id="weatherSymbol" aria-hidden="true">◌</span>
        <span id="weatherCondition">Finding nearby weather…</span>
        <span id="weatherRange">H:--° L:--°</span>
      </div>
      <span class="weather-label">Weather</span>
    </article>
  `;
}

function renderAppButton(app) {
  return `
    <button
      class="app-button"
      type="button"
      data-app-id="${app.id}"
      aria-label="Open ${app.name}"
    >
      ${renderGlassIcon(app.id, "app-icon")}
      ${app.id === "mail" ? `<span class="mail-app-badge" data-mail-unread hidden></span>` : ""}

      <span class="app-label">
        ${app.name}
      </span>
    </button>
  `;
}

function renderGlassIcon(iconId, className) {
  const iconDetails = {
    music: `<span class="icon-symbol music-symbol">♪</span>`,
    photos: `<span class="photos-symbol">${Array.from({ length: 6 }, () => `<i></i>`).join("")}<b></b></span>`,
    notes: `<span class="notes-symbol"><i></i><i></i><i></i><i></i></span>`,
    settings: `<span class="icon-symbol settings-symbol">⚙</span>`,
    mail: `<span class="mail-symbol"><i></i></span>`,
    instagram: `<span class="instagram-symbol"><i></i><b></b></span>`,
    supply: `<span class="supply-symbol"><i class="supply-handle"></i><i class="supply-basket"></i><i class="supply-wheel left"></i><i class="supply-wheel right"></i><b></b></span>`,
    maps: `<span class="maps-symbol"><i></i><b></b></span>`,
    phone: `<span class="icon-symbol phone-symbol">☎</span>`,
    messages: `<span class="messages-symbol"><i></i></span>`
  };

  return `<span class="${className} glass-icon glass-icon-${iconId}" aria-hidden="true">${iconDetails[iconId] || ""}</span>`;
}

function renderSystemDock() {
  return `
    <div
      class="system-dock-wrap dock-hidden"
      id="systemDock"
    >
      <div class="system-dock">
        <button
          class="dock-button"
          type="button"
          data-dock-app="phone"
          aria-label="Open Phone"
        >
          ${renderGlassIcon("phone", "dock-icon")}
          <span class="mail-app-badge phone-app-badge" data-phone-unread aria-label="New missed calls"></span>
        </button>

        <button
          class="dock-button"
          id="homeButton"
          type="button"
          aria-label="Return home"
        >
          <span class="home-x-icon">×</span>
        </button>

        <button
          class="dock-button"
          type="button"
          data-dock-app="messages"
          aria-label="Open Messages"
        >
          ${renderGlassIcon("messages", "dock-icon")}
          <span class="messages-unread-badge" data-messages-unread aria-label="Unread messages"></span>
        </button>
      </div>

      <div class="home-indicator"></div>
    </div>
  `;
}

function renderAppWindow() {
  return `
    <section
      class="app-window"
      id="appWindow"
    >
      ${renderStatusBar()}

      <h1
        class="app-heading"
        id="appTitle"
      >
        App
      </h1>

      <div
        class="app-content"
        id="appContent"
      ></div>
    </section>
  `;
}

function bindEvents() {
  const lockScreen = document.getElementById("lockScreen");

  lockScreen.addEventListener("pointerdown", startSwipe);

  window.addEventListener("pointermove", moveSwipe);
  window.addEventListener("pointerup", endSwipe);
  window.addEventListener("pointercancel", cancelSwipe);

  document.querySelectorAll("[data-key]").forEach((button) => {
    button.addEventListener("click", () => {
      handlePasscodeKey(button.dataset.key);
    });
  });

  document.querySelectorAll("[data-app-id]").forEach((button) => {
    button.addEventListener("click", () => {
      openApp(button.dataset.appId);
    });
  });

  document.querySelectorAll("[data-dock-app]").forEach((button) => {
    button.addEventListener("click", () => {
      openDockApp(button.dataset.dockApp);
    });
  });

  document
    .getElementById("homeButton")
    .addEventListener("click", returnHome);

  document
    .getElementById("cancelPasscode")
    .addEventListener("click", returnToLockScreen);

  document
    .getElementById("emergencyButton")
    .addEventListener("click", openLostPhoneScreen);

  document
    .getElementById("enterAccessCode")
    .addEventListener("click", returnToPasscodeFromLostScreen);

  window.addEventListener("keydown", handleKeyboardInput);
}

function openLostPhoneScreen() {
  enteredPasscode = "";
  updatePasscodeDots();
  hidePasscodeError();
  document.getElementById("passcodeScreen").classList.add("screen-hidden");
  document.getElementById("lostPhoneScreen").classList.remove("screen-hidden");
  document.getElementById("device").classList.add("lost-mode");
}

function returnToPasscodeFromLostScreen() {
  document.getElementById("lostPhoneScreen").classList.add("screen-hidden");
  document.getElementById("passcodeScreen").classList.remove("screen-hidden");
  document.getElementById("device").classList.remove("lost-mode");
}

function startSwipe(event) {
  if (faceIdSequenceRunning) {
    return;
  }

  swipeTracking = true;

  swipeStartY = event.clientY;
  swipeCurrentY = event.clientY;

  event.currentTarget.setPointerCapture?.(event.pointerId);
}

function moveSwipe(event) {
  if (!swipeTracking) {
    return;
  }

  swipeCurrentY = event.clientY;

  const upwardMovement = Math.min(
    0,
    swipeCurrentY - swipeStartY
  );

  const limitedMovement = Math.max(
    upwardMovement,
    -240
  );

  const lockScreen =
    document.getElementById("lockScreen");

  lockScreen.style.transform =
    `translateY(${limitedMovement}px)`;

  const progress = Math.min(
    Math.abs(limitedMovement) / 180,
    1
  );

  lockScreen.style.opacity =
    String(1 - progress * 0.45);
}

function endSwipe() {
  if (!swipeTracking) {
    return;
  }

  const swipeDistance =
    swipeStartY - swipeCurrentY;

  swipeTracking = false;

  const lockScreen =
    document.getElementById("lockScreen");

  lockScreen.style.transform = "";
  lockScreen.style.opacity = "";

  if (swipeDistance >= 75) {
    beginUnlockSequence();
  }
}

function cancelSwipe() {
  swipeTracking = false;

  const lockScreen =
    document.getElementById("lockScreen");

  if (lockScreen) {
    lockScreen.style.transform = "";
    lockScreen.style.opacity = "";
  }
}

function beginUnlockSequence() {
  if (faceIdSequenceRunning) {
    return;
  }

  faceIdSequenceRunning = true;

  const lockScreen =
    document.getElementById("lockScreen");

  const faceIdScreen =
    document.getElementById("faceIdScreen");

  const passcodeScreen =
    document.getElementById("passcodeScreen");

  const dynamicIsland =
    document.getElementById("dynamicIsland");

  const islandMessage =
    document.getElementById("islandMessage");

  lockScreen.classList.add("unlocking");

  window.setTimeout(() => {
    lockScreen.classList.add("screen-hidden");
    lockScreen.classList.remove("unlocking");

    faceIdScreen.classList.remove("screen-hidden");

    islandMessage.textContent = "Scanning…";
    dynamicIsland.classList.remove("failed");
    dynamicIsland.classList.add("scanning");
  }, 280);

  window.setTimeout(() => {
    islandMessage.textContent = "Not Recognized";
    dynamicIsland.classList.remove("scanning");
    dynamicIsland.classList.add("failed");
  }, 1320);

  window.setTimeout(() => {
    passcodeScreen.classList.remove("screen-hidden");
    faceIdScreen.classList.add("screen-hidden");
  }, 2250);

  window.setTimeout(() => {
    dynamicIsland.classList.remove("failed");
    faceIdSequenceRunning = false;
  }, 2920);
}

function returnToLockScreen() {
  enteredPasscode = "";

  updatePasscodeDots();
  hidePasscodeError();

  document
    .getElementById("passcodeScreen")
    .classList.add("screen-hidden");

  document
    .getElementById("faceIdScreen")
    .classList.add("screen-hidden");

  document
    .getElementById("dynamicIsland")
    .classList.remove("scanning", "failed");

  document
    .getElementById("lockScreen")
    .classList.remove("screen-hidden");

  hideDock();

  faceIdSequenceRunning = false;
}

function handlePasscodeKey(key) {
  hidePasscodeError();

  if (key === "delete") {
    enteredPasscode =
      enteredPasscode.slice(0, -1);

    updatePasscodeDots();

    return;
  }

  if (enteredPasscode.length >= 4) {
    return;
  }

  enteredPasscode += key;

  updatePasscodeDots();

  if (enteredPasscode.length === 4) {
    window.setTimeout(checkPasscode, 130);
  }
}

function handleKeyboardInput(event) {
  const passcodeScreen =
    document.getElementById("passcodeScreen");

  if (
    passcodeScreen.classList.contains(
      "screen-hidden"
    )
  ) {
    return;
  }

  if (/^[0-9]$/.test(event.key)) {
    handlePasscodeKey(event.key);
  }

  if (event.key === "Backspace") {
    handlePasscodeKey("delete");
  }
}

function updatePasscodeDots() {
  const dots =
    document.querySelectorAll(".passcode-dot");

  dots.forEach((dot, index) => {
    dot.classList.toggle(
      "filled",
      index < enteredPasscode.length
    );
  });
}

function checkPasscode() {
  if (enteredPasscode === CORRECT_PASSCODE) {
    unlockSite();
    return;
  }

  showPasscodeError();

  enteredPasscode = "";

  updatePasscodeDots();
}

function showPasscodeError() {
  const passcodeScreen =
    document.getElementById("passcodeScreen");

  const error =
    document.getElementById("passcodeError");

  passcodeScreen.classList.remove(
    "full-screen-shake"
  );

  void passcodeScreen.offsetWidth;

  passcodeScreen.classList.add(
    "full-screen-shake"
  );

  error.classList.add("visible");

  window.setTimeout(() => {
    passcodeScreen.classList.remove(
      "full-screen-shake"
    );
  }, 460);
}

function hidePasscodeError() {
  document
    .getElementById("passcodeError")
    .classList.remove("visible");
}

function unlockSite() {
  enteredPasscode = "";

  updatePasscodeDots();
  hidePasscodeError();

  document
    .getElementById("passcodeScreen")
    .classList.add("screen-hidden");

  document
    .getElementById("homeScreen")
    .classList.remove("screen-hidden");

  document
    .getElementById("device")
    .classList.add("unlocked");

  showDock();
}

function openApp(appId) {
  const app = apps.find(
    (item) => item.id === appId
  );

  if (!app) {
    return;
  }

  showAppWindow(app);
}

function openDockApp(appId) {
  const app = dockApps.find(
    (item) => item.id === appId
  );

  if (!app) {
    return;
  }

  showAppWindow(app);
}

function showAppWindow(app) {
  document.getElementById(
    "appTitle"
  ).textContent = app.name;

  const appContent = document.getElementById("appContent");

  appContent.className = "app-content";

  if (app.id === "music" && window.MyMusic) {
    appContent.classList.add("media-app-content");
    window.MyMusic.open(appContent);
  } else if (app.id === "notes" && window.MyNotes) {
    appContent.classList.add("media-app-content");
    window.MyNotes.open(appContent);
  } else if (app.id === "supply") {
    appContent.classList.add("supply-app-content");
    appContent.innerHTML = renderSupplyApp();
    bindSupplyApp(appContent);
  } else if (app.id === "messages" && window.MyMessages) {
    appContent.classList.add("connected-app-content");
    window.MyMessages.openMessages(appContent);
  } else if (app.id === "photos" && window.MyMessages) {
    appContent.classList.add("connected-app-content");
    window.MyMessages.openPhotos(appContent);
  } else if (app.id === "maps" && window.MyMessages) {
    appContent.classList.add("connected-app-content");
    window.MyMessages.openMaps(appContent);
  } else if (app.id === "instagram") {
    appContent.classList.add("instagram-app-content");
    appContent.innerHTML = renderInstagramApp();
  } else if (app.id === "mail" && window.MyMail) {
    appContent.classList.add("mail-app-content");
    window.MyMail.openInbox(appContent);
  } else if (app.id === "settings" && window.MySettings) {
    appContent.classList.add("settings-app-content");
    window.MySettings.open(appContent);
  } else if (app.id === "phone" && window.MyPhone) {
    appContent.classList.add("phone-app-content");
    window.MyPhone.open(appContent);
  } else {
    appContent.innerHTML = `
      <article class="placeholder-card">
        <h2>${app.name}</h2>
        <p>${app.description}</p>
      </article>
    `;
  }

  document
    .getElementById("appWindow")
    .classList.add("open");

  document
    .getElementById("device")
    .classList.add("app-open");

  showDock();
}

function renderInstagramApp() {
  return `
    <section class="instagram-profile-launcher">
      <div class="instagram-wordmark">Instagram</div>
      <div class="instagram-profile-card">
        <div class="instagram-profile-avatar"><span>EX</span></div>
        <div class="instagram-profile-copy">
          <p>ARTIST PROFILE</p>
          <h2>@saintedxachari</h2>
          <span>Open the official profile to follow Ed, like posts, and comment using your own Instagram account.</span>
        </div>
      </div>
      <a class="instagram-open-profile" href="https://www.instagram.com/saintedxachari" target="_blank" rel="noopener noreferrer">Open in Instagram</a>
      <p class="instagram-privacy-note">Instagram opens securely outside myPhone. Your login and activity remain between you and Instagram.</p>
    </section>
  `;
}

function renderSupplyApp() {
  const emptyShelves = Array.from({ length: 19 }, (_, index) => `
    <article class="supply-shelf empty" aria-label="Product shelf ${String(index + 2).padStart(2, "0")}, awaiting release">
      <span>${String(index + 2).padStart(2, "0")}</span>
      <p>AWAITING RELEASE</p>
    </article>`).join("");
  return `
    <section class="supply-store">
      <header class="supply-header">
        <span>SUPPLY / 20</span>
        <span>LIMITED OBJECTS</span>
      </header>
      <div class="supply-grid">
        <button class="supply-shelf product" type="button" data-supply-product="heavy-white-tee">
          <img src="media/supply/every-day-experience-heavy-white-tee/main.png" alt="Every Day Experience Heavy White Tee">
          <span><small>FOUNDER'S COLLECTION · 01</small><strong>Every Day. Experience™ Heavy White Tee</strong><b>$85</b><em>09/10 AVAILABLE</em></span>
        </button>
        ${emptyShelves}
      </div>
    </section>
  `;
}

function renderSupplyProduct() {
  const details = ["Premium heavyweight 100% combed cotton", "Oversized, relaxed fit", "Structured shoulder construction", "Reinforced double-needle stitching throughout", "Ribbed crew neckline", "Soft pre-shrunk finish", "Breathable natural cotton fabric", "Designed for everyday wear"];
  const cardDetails = ["Individual serial number", "Edition number", "Collection name", "Production date", "Ghosts In Shells authentication"];
  const materials = ["100% Premium Combed Cotton", "Heavyweight jersey construction", "Rib-knit cotton collar", "Premium DTF printed chest graphic", "Gold rayon embroidery thread", "Matte black archival cardstock Edition Card", "Metallic gold foil stamping", "Blind embossed Ghosts In Shells authenticity mark"];
  const care = ["Machine wash cold", "Wash inside out", "Do not bleach", "Tumble dry low or hang dry", "Do not iron directly over the printed graphic", "Iron inside out if necessary"];
  return `
    <article class="supply-detail">
      <header><button type="button" data-supply-back>‹ Supply</button><span>FOUNDER'S COLLECTION · 01/20</span></header>
      <div class="supply-gallery">
        <img data-supply-main-image src="media/supply/every-day-experience-heavy-white-tee/main.png" alt="Every Day Experience Heavy White Tee front view">
        <div>${[
          ["media/supply/every-day-experience-heavy-white-tee/main.png", "Every Day Experience Heavy White Tee front view"],
          ["media/supply/every-day-experience-heavy-white-tee/edition-detail.jpg", "Numbered edition embroidery detail"],
          ["media/supply/every-day-experience-heavy-white-tee/authentication-card.png", "Authentication card"]
        ].map(([src,alt],index)=>`<button class="${index===0?"active":""}" type="button" data-supply-image="${src}" data-supply-alt="${alt}"><img src="${src}" alt="${alt}"></button>`).join("")}</div>
      </div>
      <section class="supply-product-intro">
        <p>FOUNDER'S COLLECTION</p><h2>Every Day. Experience™ Heavy White Tee</h2><strong>$85</strong>
        <div class="supply-edition-status"><span></span><b>09/10 AVAILABLE</b><small>Only 10 pieces produced for the inaugural release.</small></div>
        <p class="supply-lead">Built for everyday wear, designed to last.</p>
        <p>The Every Day. Experience™ Heavy White Tee is constructed from premium heavyweight 100% cotton with an oversized silhouette that offers a structured drape and substantial feel. Every piece is produced in limited quantities and finished with carefully selected details that elevate it beyond a standard graphic tee.</p>
      </section>
      <form class="supply-order" data-supply-order>
        <label>SELECT SIZE<select name="size" required><option value="" selected disabled>Choose a size</option><option value="SM">SM</option><option value="MD">MD</option><option value="LG">LG</option><option value="XL">XL</option><option value="XXL">XXL</option></select></label>
        <label>FIRST NAME<input name="first_name" type="text" autocomplete="given-name" required></label>
        <label>EMAIL<input name="email" type="email" autocomplete="email" required></label>
        <label>SHIPPING ADDRESS<textarea name="shipping_address" rows="3" autocomplete="street-address" required></textarea></label>
        <label>PAYMENT METHOD<select name="payment_method" required><option value="" selected disabled>Select a method</option><option>Apple Pay</option><option>Credit or Debit Card</option><option>PayPal</option></select></label>
        <label class="supply-desktop-alert"><input name="desktop_updates" type="checkbox"> Enable desktop order updates</label>
        <p><span>Product</span><strong>$85.00</strong></p><p><span>Shipping</span><strong>Calculated at cost</strong></p>
        <button type="submit">PLACE ORDER · $85</button><small data-supply-order-status aria-live="polite"></small>
      </form>
      <section class="supply-information"><h3>Product Details</h3><ul>${details.map(item=>`<li>${item}</li>`).join("")}</ul></section>
      <section class="supply-information"><h3>Front Logo</h3><p>The left chest features the signature <b>Every Day. Experience</b> wordmark applied using premium <b>Direct-to-Film (DTF)</b> printing.</p><p>DTF technology produces exceptionally crisp lettering while maintaining a smooth, flexible finish that moves naturally with the garment. Unlike traditional heat-transfer vinyl, the print preserves the sharp edges and fine spacing of the logo while offering excellent durability through repeated wear and washing.</p></section>
      <section class="supply-information"><h3>Signature Detail</h3><p>Hidden inside the lower front hem is a <b>gold embroidered edition mark</b> identifying each shirt individually.</p><p>Each Founder's Collection shirt is embroidered with its unique edition number, creating a subtle detail visible only to its owner.</p><blockquote>Edition 01/10</blockquote></section>
      <section class="supply-information"><h3>Authentication Card</h3><p>Every shirt includes a premium Edition Card printed on ultra-thick matte black cardstock with gold foil detailing.</p><ul>${cardDetails.map(item=>`<li>${item}</li>`).join("")}</ul><p>The reverse side features the Every Day. Experience wordmark along with a blind-embossed Ghosts In Shells “X” as a discreet mark of authenticity.</p></section>
      <section class="supply-information"><h3>Founder's Collection</h3><p>Only <b>10 pieces</b> will be produced for this inaugural release. Each shirt is individually numbered and paired with its matching Edition Card, making every garment part of the original Every Day. Experience collection.</p></section>
      <section class="supply-information"><h3>Materials</h3><ul>${materials.map(item=>`<li>${item}</li>`).join("")}</ul></section>
      <section class="supply-information"><h3>Care Instructions</h3><ul>${care.map(item=>`<li>${item}</li>`).join("")}</ul></section>
      <footer><p><span>COLLECTION</span>Founder's Collection</p><p><span>EDITION</span>Individually Numbered</p><p><span>PRODUCED BY</span>Ghosts In Shells</p></footer>
    </article>`;
}

function bindSupplyApp(host) {
  host.querySelector("[data-supply-product]")?.addEventListener("click", () => {
    host.innerHTML = renderSupplyProduct();
    bindSupplyApp(host);
    document.getElementById("appWindow").scrollTop = 0;
  });
  host.querySelector("[data-supply-back]")?.addEventListener("click", () => {
    host.innerHTML = renderSupplyApp();
    bindSupplyApp(host);
    document.getElementById("appWindow").scrollTop = 0;
  });
  host.querySelectorAll("[data-supply-image]").forEach((button) => button.addEventListener("click", () => {
    const image = host.querySelector("[data-supply-main-image]");
    image.src = button.dataset.supplyImage;
    image.alt = button.dataset.supplyAlt;
    host.querySelectorAll("[data-supply-image]").forEach((item) => item.classList.toggle("active", item === button));
  }));
  const form = host.querySelector("[data-supply-order]");
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const order = {
      id: `GS-${Date.now().toString(36).toUpperCase()}`,
      createdAt: new Date().toISOString(),
      firstName: form.elements.first_name.value.trim(),
      email: form.elements.email.value.trim(),
      shippingAddress: form.elements.shipping_address.value.trim(),
      paymentMethod: form.elements.payment_method.value,
      size: form.elements.size.value,
      product: "Every Day. Experience™ Heavy White Tee",
      total: "$85.00 + shipping"
    };
    if (form.elements.desktop_updates.checked && "Notification" in window) {
      Notification.requestPermission().then((permission) => {
        localStorage.setItem("myphone.settings.desktop-notifications", permission === "granted" ? "1" : "0");
      });
    }
    window.MyMail?.createSupplyOrder(order);
    localStorage.setItem("myphone.supply.heavy-white-tee.size", order.size);
    form.querySelector("[data-supply-order-status]").textContent = `Order ${order.id} received. Check Mail for confirmation and updates from Tracey.`;
    form.querySelector("button[type=submit]").disabled = true;
  });
}

async function initializeWeather() {
  const locationNode = document.getElementById("weatherLocation");
  const temperatureNode = document.getElementById("weatherTemperature");
  const conditionNode = document.getElementById("weatherCondition");
  const rangeNode = document.getElementById("weatherRange");
  const symbolNode = document.getElementById("weatherSymbol");

  if (!locationNode) return;

  const WEATHER_LOCATIONS = [
    { name: "Compton, CA", latitude: 33.8958, longitude: -118.2201 },
    { name: "Sacramento, CA", latitude: 38.5816, longitude: -121.4944 },
    { name: "Grand Prairie, TX", latitude: 32.7460, longitude: -96.9978 },
    { name: "Arlington, TX", latitude: 32.7357, longitude: -97.1081 },
    { name: "Dallas, TX", latitude: 32.7767, longitude: -96.7970 },
    { name: "Charlotte, NC", latitude: 35.2271, longitude: -80.8431 },
    { name: "Rockingham, NC", latitude: 34.9393, longitude: -79.7739 },
    { name: "Fayetteville, NC", latitude: 35.0527, longitude: -78.8784 },
    { name: "Center Islip, NY", latitude: 40.7907, longitude: -73.2018 },
    { name: "Las Vegas, NV", latitude: 36.1699, longitude: -115.1398 },
    { name: "Paradise, NV", latitude: 36.0972, longitude: -115.1467 }
  ];
  const ROTATION_KEY = "myphone.weather.rotation.v1";
  const MIN_STAY = 72 * 60 * 60 * 1000;
  const MAX_STAY = 144 * 60 * 60 * 1000;

  function randomStay() {
    return Math.round(MIN_STAY + Math.random() * (MAX_STAY - MIN_STAY));
  }

  function activeLocation() {
    const now = Date.now();
    let state = null;
    try { state = JSON.parse(localStorage.getItem(ROTATION_KEY)); } catch { /* Reset invalid state below. */ }
    const valid = state && Number.isInteger(state.index) && WEATHER_LOCATIONS[state.index] && Number.isFinite(state.rotateAt);
    if (!valid) {
      state = { index: Math.floor(Math.random() * WEATHER_LOCATIONS.length), rotateAt: now + randomStay() };
    } else if (now >= state.rotateAt) {
      let nextIndex = state.index;
      while (nextIndex === state.index) nextIndex = Math.floor(Math.random() * WEATHER_LOCATIONS.length);
      state = { index: nextIndex, rotateAt: now + randomStay() };
    }
    localStorage.setItem(ROTATION_KEY, JSON.stringify(state));
    return WEATHER_LOCATIONS[state.index];
  }

  const location = activeLocation();
  locationNode.textContent = "Ed's Location";
  conditionNode.textContent = "Updating weather…";

  try {

    const params = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      current: "temperature_2m,weather_code",
      daily: "temperature_2m_max,temperature_2m_min",
      temperature_unit: "fahrenheit",
      timezone: "auto",
      forecast_days: "1"
    });
    const weatherResponse = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!weatherResponse.ok) throw new Error("Weather unavailable");
    const weather = await weatherResponse.json();
    const code = Number(weather.current?.weather_code);
    const presentation = weatherPresentation(code);

    locationNode.textContent = "Ed's Location";
    temperatureNode.textContent = `${Math.round(weather.current.temperature_2m)}°`;
    conditionNode.textContent = presentation.label;
    symbolNode.textContent = presentation.symbol;
    rangeNode.textContent = `H:${Math.round(weather.daily.temperature_2m_max[0])}° L:${Math.round(weather.daily.temperature_2m_min[0])}°`;
  } catch (error) {
    locationNode.textContent = "Ed's Location";
    temperatureNode.textContent = "--°";
    conditionNode.textContent = "Temporarily unavailable";
    rangeNode.textContent = "Refreshing automatically";
    symbolNode.textContent = "◌";
  }

  if (!weatherRefreshTimer && localStorage.getItem("myphone.settings.low-power") !== "1") {
    weatherRefreshTimer = window.setInterval(initializeWeather, 15 * 60 * 1000);
  }
}

function weatherPresentation(code) {
  if (code === 0) return { label: "Clear", symbol: "☀" };
  if ([1, 2].includes(code)) return { label: "Partly Cloudy", symbol: "◐" };
  if (code === 3) return { label: "Cloudy", symbol: "☁" };
  if ([45, 48].includes(code)) return { label: "Fog", symbol: "≋" };
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { label: "Rain", symbol: "☂" };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: "Snow", symbol: "✣" };
  if ([95, 96, 99].includes(code)) return { label: "Thunderstorms", symbol: "ϟ" };
  return { label: "Current Conditions", symbol: "◌" };
}

function returnHome() {
  document
    .getElementById("appWindow")
    .classList.remove("open");

  document
    .getElementById("device")
    .classList.remove("app-open");

  document
    .getElementById("homeScreen")
    .classList.remove("screen-hidden");

  showDock();
}

function showDock() {
  document
    .getElementById("systemDock")
    .classList.remove("dock-hidden");
}

function hideDock() {
  document
    .getElementById("systemDock")
    .classList.add("dock-hidden");
}

function updateDateAndTime() {
  const now = new Date();

  const timeText = now.toLocaleTimeString(
    "en-US",
    {
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    }
  );

  const timeParts = timeText.split(" ");

  const dateText = now.toLocaleDateString(
    "en-US",
    {
      weekday: "long",
      month: "long",
      day: "numeric"
    }
  );

  const lockTime =
    document.getElementById("lockTime");

  const lockPeriod =
    document.getElementById("lockPeriod");

  const lockDate =
    document.getElementById("lockDate");

  if (lockTime) {
    lockTime.textContent = timeParts[0];
  }

  if (lockPeriod) {
    lockPeriod.textContent =
      timeParts[1] || "";
  }

  if (lockDate) {
    lockDate.textContent = dateText;
  }

  document.querySelectorAll("[data-status-time]").forEach((statusTime) => {
    statusTime.textContent = timeParts[0];
  });
}

async function initializeBattery() {
  localStorage.setItem("myphone.settings.low-power", "1");
  document.getElementById("device")?.classList.add("low-power-mode");
  updateBatteryDisplay(19, true, false);
}

function updateBatteryDisplay(
  percentage,
  showPercentage,
  charging
) {
  const safePercentage = Math.max(
    1,
    Math.min(100, percentage)
  );

  document
    .querySelectorAll("[data-battery-fill]")
    .forEach((fill) => {
      fill.style.width =
        `${safePercentage}%`;

      if (safePercentage <= 20) {
        fill.style.background = "#ff4545";
      } else if (charging) {
        fill.style.background = "#55e36a";
      } else {
        fill.style.background = "#ffffff";
      }
    });

  document
    .querySelectorAll("[data-battery-percent]")
    .forEach((label) => {
      label.textContent = showPercentage
        ? `${safePercentage}`
        : "";
    });
}

bootSite();
