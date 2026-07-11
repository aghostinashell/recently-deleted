"use strict";

const root = document.getElementById("site-root");

const CORRECT_PASSCODE = "2001";

let enteredPasscode = "";

let swipeStartY = 0;
let swipeCurrentY = 0;
let swipeTracking = false;

let faceIdSequenceRunning = false;

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

  window.setInterval(updateDateAndTime, 1000);
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
        <button class="passcode-action" type="button">
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
        <strong id="weatherLocation">Local Weather</strong>
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

  window.addEventListener("keydown", handleKeyboardInput);
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

  showDock();
}

function renderSupplyApp() {
  return `
    <section class="supply-store">
      <header class="supply-header">
        <span>SUPPLY / 001</span>
        <span>AVAILABLE OBJECTS</span>
      </header>
      <article class="supply-product">
        <div class="supply-product-visual" aria-hidden="true">
          <span>S</span>
        </div>
        <div class="supply-product-copy">
          <p class="supply-kicker">FIRST RELEASE</p>
          <h2>Object 001</h2>
          <p class="supply-description">Product details, photography, sizing and fulfillment information will live here.</p>
          <div class="supply-inventory">
            <span class="inventory-light"></span>
            <strong>15 items remaining</strong>
          </div>
          <button class="supply-acquire" type="button">Acquire</button>
        </div>
      </article>
    </section>
  `;
}

async function initializeWeather() {
  const locationNode = document.getElementById("weatherLocation");
  const temperatureNode = document.getElementById("weatherTemperature");
  const conditionNode = document.getElementById("weatherCondition");
  const rangeNode = document.getElementById("weatherRange");
  const symbolNode = document.getElementById("weatherSymbol");

  if (!locationNode) return;

  try {
    const locationResponse = await fetch("https://ipwho.is/");
    if (!locationResponse.ok) throw new Error("Location unavailable");
    const location = await locationResponse.json();
    if (!location.success || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) {
      throw new Error("Location unavailable");
    }

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

    locationNode.textContent = location.city || location.region || "Nearby";
    temperatureNode.textContent = `${Math.round(weather.current.temperature_2m)}°`;
    conditionNode.textContent = presentation.label;
    symbolNode.textContent = presentation.symbol;
    rangeNode.textContent = `H:${Math.round(weather.daily.temperature_2m_max[0])}° L:${Math.round(weather.daily.temperature_2m_min[0])}°`;
  } catch (error) {
    locationNode.textContent = "Local Weather";
    temperatureNode.textContent = "--°";
    conditionNode.textContent = "Weather unavailable";
    rangeNode.textContent = "Tap to retry later";
    symbolNode.textContent = "◌";
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
  if (
    typeof navigator.getBattery !== "function"
  ) {
    updateBatteryDisplay(33, false, false);
    return;
  }

  try {
    const battery =
      await navigator.getBattery();

    const refreshBattery = () => {
      const percentage = Math.round(
        battery.level * 100
      );

      updateBatteryDisplay(
        percentage,
        true,
        battery.charging
      );
    };

    refreshBattery();

    battery.addEventListener(
      "levelchange",
      refreshBattery
    );

    battery.addEventListener(
      "chargingchange",
      refreshBattery
    );
  } catch (error) {
    updateBatteryDisplay(33, false, false);
  }
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
