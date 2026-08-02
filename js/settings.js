"use strict";

(function createSettingsApp() {
  const KEYS = {
    brightness: "myphone.settings.brightness",
    reduceMotion: "myphone.settings.reduce-motion",
    lowPower: "myphone.settings.low-power",
    notifications: "myphone.settings.notifications",
    sounds: "myphone.settings.sounds",
    desktopNotifications: "myphone.settings.desktop-notifications"
  };
  const defaults = { brightness: "100", reduceMotion: "0", lowPower: "1", notifications: "1", sounds: "1", desktopNotifications: "0" };
  let host = null;
  let battery = { level: 19, charging: false, supported: true };

  const value = (name) => localStorage.getItem(KEYS[name]) ?? defaults[name];
  const enabled = (name) => value(name) === "1";
  const esc = (text) => String(text ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

  function applyPreferences() {
    const device = document.getElementById("device");
    if (!device) return;
    device.style.filter = `brightness(${Math.max(35, Number(value("brightness")) || 100)}%)`;
    device.classList.toggle("reduce-motion", enabled("reduceMotion"));
    localStorage.setItem(KEYS.lowPower, "1");
    device.classList.add("low-power-mode");
    window.MyMessages?.syncUnreadBadge();
    window.MyMail?.syncUnreadBadge();
    window.MyPhone?.syncBadge();
  }

  function row(label, page, right = "") {
    return `<button class="settings-row" type="button" data-settings-page="${page}"><span>${label}</span>${right ? `<small>${right}</small>` : ""}<b>›</b></button>`;
  }
  function infoRow(label, right) { return `<div class="settings-row info"><span>${label}</span><small>${right}</small></div>`; }
  function toggle(name, label, description) {
    return `<label class="settings-toggle-row"><span><strong>${label}</strong><small>${description}</small></span><input type="checkbox" data-setting="${name}" ${enabled(name) ? "checked" : ""}><i></i></label>`;
  }
  function header(title, subtitle = "") {
    return `<header class="settings-page-header"><button type="button" data-settings-back>‹ Settings</button><h2>${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ""}</header>`;
  }
  function group(content, title = "") { return `${title ? `<h3 class="settings-group-label">${title}</h3>` : ""}<section class="settings-group">${content}</section>`; }

  function mainPage() {
    return `<section class="settings-screen">
      <div class="settings-profile" data-settings-page="about" role="button" tabindex="0"><span class="settings-x-avatar">×</span><span><strong>Saint Ed X</strong><small>myPhone Account<br>Ghosts In Shells</small></span><b>›</b></div>
      ${group(row("About This myPhone", "about", "myPhone X") + row("Appearance", "appearance", "Dark") + row("Notifications", "notifications", enabled("notifications") ? "On" : "Off") + row("Privacy & Security", "privacy", "Face ID Off"))}
      ${group(row("myPhone Storage", "storage", "62 MB") + row("Battery", "battery", `${battery.level}%`) + row("Credits", "credits") + row("Software Update", "update", "myOS 1.0"))}
      <footer class="settings-footer">myOS 1.0 — Recently Deleted<br><span>Designed by Ghosts In Shells</span></footer>
    </section>`;
  }

  const aboutRows = [["Device Name","Ed’s myPhone"],["Model Name","myPhone X"],["myOS Version","1.0"],["Release","Recently Deleted"],["Owner","Saint Ed X"],["Network","GIS"],["Songs","12"],["Message Threads","6"],["Applications","10"],["Capacity","64 GB"],["Available","22.3 GB"],["Serial Number","GIS-RD-1010"],["Warranty","Unknown"]];
  function aboutPage() { return `<section class="settings-screen">${header("About This myPhone")}${group(aboutRows.map((item) => infoRow(...item)).join(""))}<p class="settings-note">Property of Ghosts In Shells.</p></section>`; }
  function appearancePage() { return `<section class="settings-screen">${header("Appearance", "Display and visual preferences")}
    ${group(`<div class="dark-preview"><div><span>1:59</span><b>×</b></div><p><strong>Dark Mode</strong><small>Always On</small><em>Locked</em></p></div><p class="settings-note inside">Dark Mode cannot be disabled on this device.</p>`, "DARK MODE")}
    ${group(`<label class="brightness-control"><span>Brightness</span><output>${value("brightness")}%</output><input type="range" min="35" max="100" value="${value("brightness")}" data-brightness></label>`, "BRIGHTNESS")}
    ${group(toggle("reduceMotion", "Reduce Motion", "Limit movement and transition effects.") + infoRow("Low Power Mode", "On · Locked"))}
    </section>`; }
  function notificationsPage() {
    const state = enabled("notifications") ? { messages: "Banners, Badges", mail: "Banners, Badges" } : { messages: "Off", mail: "Off" };
    return `<section class="settings-screen">${header("Notifications", "Control alerts inside myPhone")}${group(toggle("notifications", "Allow Notifications", "Show Messages and Mail alerts.")+toggle("desktopNotifications", "Desktop Order Updates", "Show Ghost Supply updates outside myPhone."))}${group(infoRow("Messages", state.messages)+infoRow("Mail",state.mail)+infoRow("Music","Lock Screen")+infoRow("Weather","Current City")+infoRow("Supply",enabled("desktopNotifications")?"Banners":"Mail Only"),"NOTIFICATION STYLE")}${group(toggle("sounds","System Sounds","Allow interface and notification sounds."),"SYSTEM SOUNDS")}</section>`;
  }

  function privacyPage() { return `<section class="settings-screen">${header("Privacy & Security", "Security and data stored by myPhone")}
    ${group(infoRow("Face ID","Unavailable")+infoRow("Access Code","••••")+infoRow("Lost Phone Access","Enabled"),"SECURITY")}<p class="settings-note">Face ID cannot identify the current owner.</p>
    <div class="privacy-card"><strong>Messages Created on This Device</strong><p>Messages sent inside myPhone are stored only in this browser unless a form specifically states otherwise.</p></div>
    <div class="privacy-card"><strong>First-Party Analytics</strong><p>Ghosts In Shells uses a random browser identifier to measure visits, phone interactions, app usage, music playback, downloads, and personalized invite activity. Approximate city, region, and country may be supplied by Cloudflare; precise location is never requested.</p></div>
    <div class="privacy-card"><strong>Music Activity</strong><p>On-device play counts remain in this browser. Playback events such as track, progress milestones, and completion may also be sent to the Ghosts In Shells analytics service.</p></div>
    <div class="privacy-card"><strong>Sensitive Information</strong><p>Analytics does not collect passcodes, typed messages, form contents, precise location, raw IP addresses, or secret credentials. Personalized invite tokens are stored only as secure hashes.</p></div>
    <div class="privacy-card"><strong>Privacy Controls</strong><p>Analytics is disabled when Global Privacy Control or Do Not Track is enabled. Clearing this site’s browser data removes the device-local analytics identifier. Server analytics is retained until Ghosts In Shells deletes it or fulfills a valid deletion request. Contact Ghosts In Shells to request information about analytics data or deletion.</p></div>
    <div class="privacy-card"><strong>Service Provider</strong><p>Analytics requests and approximate location are processed by Cloudflare for Ghosts In Shells. Analytics is used to understand site performance, content engagement, and authorized invite access.</p></div>
    <div class="privacy-card"><strong>External Services</strong><p>Maps, Instagram and submission forms may connect to services outside myPhone.</p></div>
    ${group(row("Reset Play Counts","confirm-play")+row("Clear Visitor Messages","confirm-messages")+row("Clear Saved Locations","confirm-locations")+row("Reset All Visitor Data","confirm-all"),"DEVICE DATA CONTROLS").replaceAll('class="settings-row"','class="settings-row destructive"')}
    <p class="settings-note">Original album files, conversations and artwork will not be removed.</p></section>`; }

  function countKeys(prefix, suffix = "") { return Object.keys(localStorage).filter((key) => key.startsWith(prefix) && key.endsWith(suffix)).length; }
  function countStoredRecords(prefix, suffix) { return Object.keys(localStorage).filter((key) => key.startsWith(prefix) && key.endsWith(suffix)).reduce((total, key) => { try { const data=JSON.parse(localStorage.getItem(key)); return total+(Array.isArray(data)?data.length:0); } catch { return total; } },0); }
  function storagePage() { const messages = countStoredRecords("myphone.messages.", ".custom"); const maps = countKeys("myphone.map-search."); const plays = countKeys("myphone.play-count."); return `<section class="settings-screen">${header("myPhone Storage", "64 GB capacity")}
    <div class="storage-hero"><strong>41.7 GB</strong><span>of 64 GB used</span><div class="storage-bar"><i></i><i></i><i></i><i></i></div><small>Music &nbsp; Photos &nbsp; Messages &nbsp; System</small></div>
    ${group(infoRow("Music","45.8 MB")+infoRow("Photos","12.4 MB")+infoRow("Messages",`${messages} local records`)+infoRow("Mail","Campaign Data")+infoRow("Maps",`${maps} local records`)+infoRow("myOS","System"))}
    <div class="album-storage-card"><span class="settings-x-avatar">×</span><div><strong>Recently Deleted</strong><small>Saint Ed X<br>12 songs · ${plays} saved play-count records</small></div><button type="button" data-settings-page="album-remove">Remove</button></div></section>`; }

  function batteryPage() { return `<section class="settings-screen">${header("Battery")}<div class="battery-settings-hero"><div><strong>19%</strong></div><p><b>Low Power Mode Active</b><span>This story phone remains at 19%.</span></p></div>${group(infoRow("Low Power Mode","On · Locked"))}${group(infoRow("Maximum Capacity","87%")+infoRow("Peak Performance","Normal")+infoRow("Optimized Charging","On"),"BATTERY HEALTH")}<div class="privacy-card"><strong>Peak Performance Capability</strong><p>This myPhone currently supports normal peak performance.</p></div></section>`; }
  function creditsPage() { const credits=[["Artist","Saint Ed X"],["Written By","D. Wright"],["Executive Producer","D. Wright"],["Producer","Ed Xachari"],["Production Company","Ghosts In Shells"],["Record Label","Inkworks Media Group"],["Creative Direction","D. Wright"],["myPhone Development","Ghosts In Shells"]]; return `<section class="settings-screen">${header("Credits","Recently Deleted")}<div class="credits-hero"><span class="settings-x-avatar">×</span><strong>Recently Deleted</strong><small>Saint Ed X</small></div>${group(credits.map((item)=>infoRow(...item)).join(""))}<p class="settings-rights">Created independently. All original music, artwork, recordings and story content are owned or used with permission by their respective rights holders.<br><br>© 2026 Ghosts In Shells.<br>All rights reserved.</p></section>`; }
  function updatePage() { return `<section class="settings-screen">${header("Software Update","Automatic Updates: On")}<div class="update-hero"><strong>myOS 1.0</strong><span>Recently Deleted</span><p>This update introduces the complete Recently Deleted listening experience, expanded Messages, lyrics in Notes, shared locations, sponsored Mail and system performance improvements.</p></div><div class="update-status"><b>✓</b><span><strong>myOS is up to date</strong><small>Installed successfully</small></span></div>${group(["Recently Deleted — 12-track album","Interactive Messages and automated replies","Lyrics and track notes","Photos collected from conversations","Shared locations and Maps support","Sponsored Mail and business inquiries","Improved performance and stability"].map((text)=>`<p class="release-note">• ${text}</p>`).join(""),"RELEASE NOTES")}</section>`; }

  const confirmations = {
    "confirm-play": ["Reset Play Counts?","All play counts stored in this browser will return to zero. Original music files will not be removed.","Reset Play Counts","play"],
    "confirm-messages": ["Clear Visitor Messages?","Messages typed by visitors and pending automated replies will be erased. Original conversations will remain.","Clear Messages","messages"],
    "confirm-locations": ["Clear Saved Locations?","Locally stored map searches and location data will be removed from this browser.","Clear Locations","locations"],
    "confirm-all": ["Reset myPhone?","This will erase visitor messages, play counts, Mail activity, saved settings and other local data. Original album files and conversations will remain.","Reset myPhone","all"]
  };
  function confirmPage(id) { const item=confirmations[id]; return `<section class="settings-screen confirm-screen">${header(item[0])}<p>${item[1]}</p><button class="confirm-destructive" type="button" data-confirm-action="${item[3]}">${item[2]}</button><button class="confirm-cancel" type="button" data-settings-page="privacy">Cancel</button></section>`; }
  function messagePage(title,text,back="privacy") { return `<section class="settings-screen confirm-screen">${header(title)}<p>${text}</p><button class="confirm-cancel" type="button" data-settings-page="${back}">Done</button></section>`; }

  function clearMatching(predicate) { Object.keys(localStorage).filter(predicate).forEach((key)=>localStorage.removeItem(key)); }
  function runReset(type) {
    if (type === "play") { clearMatching((key)=>key.startsWith("myphone.play-count.")); renderMessage("Play Counts Reset","All locally stored play counts have been cleared."); }
    if (type === "messages") { clearMatching((key)=>key.startsWith("myphone.messages.") && (key.endsWith(".custom") || key.endsWith(".pending") || key.endsWith(".fallback-used"))); window.MyMessages?.syncUnreadBadge(); renderMessage("Visitor Messages Cleared","Original conversations remain unchanged."); }
    if (type === "locations") { clearMatching((key)=>key.startsWith("myphone.map-search.") || key.startsWith("myphone.saved-location.")); renderMessage("Locations Cleared","Locally saved map activity has been removed."); }
    if (type === "all") { localStorage.clear(); applyPreferences(); window.MyMessages?.syncUnreadBadge(); window.MyMail?.syncUnreadBadge(); renderMessage("myPhone Reset","Visitor data has been erased from this browser."); }
  }

  const pages = { about:aboutPage, appearance:appearancePage, notifications:notificationsPage, privacy:privacyPage, storage:storagePage, battery:batteryPage, credits:creditsPage, update:updatePage };
  function renderMessage(title,text,back="privacy") { host.innerHTML=messagePage(title,text,back); bind(); }
  function render(page="main") {
    if (page === "album-remove") host.innerHTML=messagePage("Unable to Remove Album","Recently Deleted cannot be deleted while currently in use.","storage");
    else if (confirmations[page]) host.innerHTML=confirmPage(page);
    else host.innerHTML=(pages[page] || mainPage)();
    bind(); document.getElementById("appWindow").scrollTop=0;
  }
  function bind() {
    host.querySelectorAll("[data-settings-page]").forEach((button)=>button.addEventListener("click",()=>render(button.dataset.settingsPage)));
    host.querySelector("[data-settings-back]")?.addEventListener("click",()=>render("main"));
    host.querySelectorAll("[data-setting]").forEach((input)=>input.addEventListener("change",async()=>{ const name=input.dataset.setting; if(name==="desktopNotifications"&&input.checked){ const permission="Notification" in window?await Notification.requestPermission():"denied"; input.checked=permission==="granted"; } localStorage.setItem(KEYS[name],input.checked?"1":"0"); applyPreferences(); render(name === "notifications" || name === "sounds" || name === "desktopNotifications" ? "notifications" : "appearance"); }));
    host.querySelector("[data-brightness]")?.addEventListener("input",(event)=>{ localStorage.setItem(KEYS.brightness,event.target.value); event.target.previousElementSibling.textContent=`${event.target.value}%`; applyPreferences(); });
    host.querySelector("[data-confirm-action]")?.addEventListener("click",(event)=>runReset(event.currentTarget.dataset.confirmAction));
  }
  async function open(node) { host=node; battery={level:19,charging:false,supported:true}; render("main"); }
  applyPreferences();
  window.MySettings={open,applyPreferences};
})();
