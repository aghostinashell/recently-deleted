"use strict";

(function createOwnerPhone() {
  const endpoint = String(window.GIS_ANALYTICS_CONFIG?.endpoint || "").replace(/\/$/, "");
  const tokenKey = "gis.owner.session";
  let host = null;
  let back = null;
  let poll = null;
  let section = "diagnostics";
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  const token = () => sessionStorage.getItem(tokenKey) || "";
  async function api(path, options = {}) {
    const response = await fetch(`${endpoint}/v1/owner${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...(token() ? { Authorization: `Bearer ${token()}` } : {}), ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 && path !== "/login") { sessionStorage.removeItem(tokenKey); renderAuth("Access Denied"); }
    if (!response.ok) throw Object.assign(new Error(data.error || "request_failed"), { status: response.status, data });
    return data;
  }
  function shell(content, title = "Ghosts In Shells OS", showStatus = true) {
    host.innerHTML = `<section class="owner-os"><header class="owner-os-header"><button data-owner-back>‹</button><div><span>GIS // OWNER</span><h2>${esc(title)}</h2></div>${showStatus ? "<b><i></i> ONLINE</b>" : ""}</header>${content}</section>`;
    document.getElementById("appWindow")?.scrollTo(0, 0);
    host.querySelector("[data-owner-back]")?.addEventListener("click", close);
  }
  function renderAuth(message = "") {
    clearInterval(poll);
    shell(`<div class="owner-auth"><div class="owner-seal">×</div><span>RESTRICTED SYSTEM</span><h3>Owner Authentication Required</h3>
      <p>Enter Owner Passcode</p><form data-owner-login><input type="password" inputmode="numeric" autocomplete="off" maxlength="64" aria-label="Owner Passcode">
      <button type="submit">Authenticate</button></form><output>${esc(message)}</output></div>`, "System", false);
    host.querySelector("[data-owner-login]")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const input = event.currentTarget.querySelector("input");
      try {
        const result = await api("/login", { method:"POST", body:JSON.stringify({ passcode: input.value }) });
        input.value = "";
        sessionStorage.setItem(tokenKey, result.token);
        renderOS();
      } catch { input.value = ""; renderAuth("Access Denied"); }
    });
  }
  const tile = (id, icon, label) => `<button data-owner-section="${id}"><i>${icon}</i><span>${label}</span><b>›</b></button>`;
  async function renderOS() {
    shell(`<div class="owner-status"><span>SYSTEM STATUS</span><strong><i></i> ONLINE</strong><small>Private administrative interface</small></div>
      <nav class="owner-grid">${tile("diagnostics","⌁","System Diagnostics")}${tile("analytics","↗","Analytics")}
      ${tile("credentials","◆","Credential Manager")}${tile("content","▦","Content Library")}
      ${tile("push","↑","Push Center")}${tile("logs","≡","System Logs")}${tile("settings","⚙","Owner Settings")}</nav>
      <button class="owner-logout" data-owner-logout>End Owner Session</button>`);
    host.querySelectorAll("[data-owner-section]").forEach((button) => button.addEventListener("click", () => openSection(button.dataset.ownerSection)));
    host.querySelector("[data-owner-logout]").addEventListener("click", async () => {
      try { await api("/logout", { method:"POST" }); } catch {}
      sessionStorage.removeItem(tokenKey); renderAuth();
    });
    startPoll();
  }
  function startPoll() {
    clearInterval(poll);
    poll = setInterval(() => { if (section === "analytics" && token()) openSection("analytics", true); }, 30000);
  }
  function sectionShell(title, kicker = "OWNER CONTROL") {
    shell(`<div class="owner-section-head"><button data-owner-home>‹ System</button><span>${kicker}</span><h3>${esc(title)}</h3></div><div class="owner-section-body" data-owner-body><div class="owner-loading">SYNCING SECURE DATA…</div></div>`, title);
    host.querySelector("[data-owner-home]").addEventListener("click", renderOS);
    return host.querySelector("[data-owner-body]");
  }
  function facts(items) { return `<div class="owner-facts">${items.map(([k,v])=>`<div><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join("")}</div>`; }
  function list(items, empty = "No activity recorded.") { return items.length ? `<div class="owner-list">${items.join("")}</div>` : `<p class="owner-empty">${esc(empty)}</p>`; }
  async function openSection(id, silent = false) {
    section = id;
    const body = silent ? host.querySelector("[data-owner-body]") : sectionShell({
      diagnostics:"System Diagnostics",analytics:"Analytics",credentials:"Credential Manager",content:"Content Library",
      push:"Push Center",logs:"System Logs",settings:"Owner Settings"
    }[id]);
    if (!body) return;
    try {
      if (id === "diagnostics") {
        const data = await api("/diagnostics");
        body.innerHTML = facts([["Status",data.status],["Environment",data.environment],["Worker",data.worker_version],
          ["Active Sessions",data.active_sessions],["Visitors",data.total_anonymous_visitors],["Last Event",data.last_event_at || "None"]]) +
          `<h4>Services</h4>${list(Object.entries(data.services).map(([name,value])=>`<div><span>${esc(name)}</span><b class="good">${esc(value)}</b></div>`))}` +
          `<h4>Current Users</h4>${list(data.current_user_breakdown.map((row)=>`<div><span>${esc(row.access_type)}</span><b>${esc(row.count)}</b></div>`))}`;
      }
      if (id === "analytics") {
        const data = await api("/analytics");
        const count = Object.fromEntries(data.event_counts.map((e)=>[e.event_name,e.count]));
        body.innerHTML = facts([["Online Now",data.totals.online_now],["Today's Visits",data.totals.visits_today],["Returning",data.totals.returning_today],
          ["Unlocks",count.phone_unlocked||0],["Song Plays",count.song_play_started||0],["Completions",count.song_completed||0],
          ["Downloads",Object.entries(count).filter(([k])=>k.includes("download")).reduce((n,[,v])=>n+Number(v),0)],
          ["Art Views",count.artwork_viewed||0],["Exposure",count.exposure_section_opened||0],["Mail Opens",count.mail_message_opened||0]]) +
          `<h4>Active Songs</h4>${list(data.active_songs.map(r=>`<div><span>${esc(r.title)}</span><b>${esc(r.count)}</b></div>`))}`+
          `<h4>Referrers</h4>${list(data.referrers.map(r=>`<div><span>${esc(r.referrer)}</span><b>${esc(r.count)}</b></div>`))}`+
          `<h4>Recent Activity</h4>${list(data.recent_activity.map(r=>`<div><span>${esc(r.event_name)}<small>${esc(r.content_title||r.access_type)}</small></span><time>${esc(r.event_timestamp)}</time></div>`))}`;
      }
      if (id === "credentials") {
        const data = await api("/credentials");
        body.innerHTML = `<details class="owner-issue"><summary>Issue New Credential</summary><form class="owner-content-form" data-issue-credential>
          <input name="recipient" placeholder="Recipient name" required maxlength="120"><select name="access_type"><option>DJ</option><option>media</option><option>venue</option></select>
          <input name="access_level" value="All Access" maxlength="80"><input name="expires_at" type="datetime-local"><button>Issue Credential</button></form>
          <output data-issued-link></output></details>` + list(data.credentials.map((c)=>`<article class="owner-credential"><header><span>${esc(c.recipient)}</span><b class="${esc(c.status)}">${esc(c.status)}</b></header>
          ${facts([["Credential ID",c.id],["Access",`${c.access_type} · ${c.access_level}`],["Issued",c.issued_at],["Last Seen",c.last_used_at||"Never"],["Visits",c.total_visits],["Sessions",c.sessions],["Song Plays",c.song_plays||0],["Downloads",c.downloads]])}
          <div class="owner-actions"><button data-credential-action="${c.status==="disabled"?"enable":"disable"}" data-id="${esc(c.id)}">${c.status==="disabled"?"Enable":"Disable"}</button>
          <button data-credential-action="reset-device" data-id="${esc(c.id)}">Reset Device</button><button class="danger" data-credential-action="revoke" data-id="${esc(c.id)}">Revoke</button>
          <button data-credential-activity data-id="${esc(c.id)}">View Activity</button></div></article>`));
        body.querySelector("[data-issue-credential]").addEventListener("submit",async(event)=>{
          event.preventDefault(); const values=Object.fromEntries(new FormData(event.currentTarget));
          const issued=await api("/credentials",{method:"POST",body:JSON.stringify(values)});
          const output=body.querySelector("[data-issued-link]");
          output.innerHTML=`<strong>Credential issued</strong><a href="${esc(issued.invite_url)}">${esc(issued.invite_url)}</a><small>Copy now. The token is never stored in readable form.</small>`;
          event.currentTarget.reset();
        });
        body.querySelectorAll("[data-credential-action]").forEach(btn=>btn.addEventListener("click",async()=>{
          if (btn.dataset.credentialAction==="revoke" && !confirm("Permanently revoke this credential?")) return;
          await api(`/credentials/${encodeURIComponent(btn.dataset.id)}/${btn.dataset.credentialAction}`,{method:"POST",body:"{}"}); openSection("credentials");
        }));
        body.querySelectorAll("[data-credential-activity]").forEach(btn=>btn.addEventListener("click",async()=>{
          const data = await api(`/credentials/${encodeURIComponent(btn.dataset.id)}/activity`);
          body.innerHTML = `<button class="owner-inline-back" data-back-credentials>‹ Credentials</button>${list(data.activity.map(r=>`<div><span>${esc(r.event_name)}<small>${esc(r.content_title||r.access_type)}</small></span><time>${esc(r.event_timestamp)}</time></div>`))}`;
          body.querySelector("[data-back-credentials]").addEventListener("click",()=>openSection("credentials"));
        }));
      }
      if (id === "content") {
        const data = await api("/content");
        body.innerHTML = `<div class="owner-future">R2 uploads remain private. Upload controls activate only after a server upload pipeline is configured.</div>
          <form class="owner-content-form"><select name="category">${["music","artwork","mail","exposure","files"].map(v=>`<option>${v}</option>`).join("")}</select>
          <input name="title" placeholder="Item title" required maxlength="160"><select name="status"><option>draft</option><option>active</option><option>archived</option></select>
          <textarea name="notes" placeholder="Owner metadata notes" maxlength="1000"></textarea><button>Save Metadata</button></form>
          <h4>Managed Metadata</h4>${list(data.metadata.map(r=>`<div><span>${esc(r.title)}<small>${esc(r.category)} · ${esc(r.status)}</small></span><time>${esc(r.updated_at)}</time></div>`))}`;
        body.querySelector("form").addEventListener("submit",async(event)=>{
          event.preventDefault(); const values=Object.fromEntries(new FormData(event.currentTarget));
          await api("/content",{method:"POST",body:JSON.stringify(values)}); openSection("content");
        });
      }
      if (id === "push") {
        body.innerHTML = `<div class="owner-future"><strong>Future-ready delivery</strong><p>No push provider is configured. Drafting and preview are available; sending and scheduling stay disabled.</p></div>
          <form class="owner-content-form"><select><option>Public</option><option>DJ</option><option>Media</option><option>Venue</option><option>Individual</option></select>
          <input placeholder="Notification title"><textarea placeholder="Message preview"></textarea><button type="button" disabled>Schedule</button><button type="button" disabled>Send</button></form>`;
      }
      if (id === "logs") {
        const data = await api("/logs");
        body.innerHTML = `<div class="owner-future">Privacy-safe owner actions only. No IP addresses, passcodes, tokens, or message contents.</div>`+
          list(data.logs.map(r=>`<div><span>${esc(r.action)}<small>${esc(r.target_type||"system")} ${esc(r.target_id||"")}</small></span><time>${esc(r.created_at)}</time></div>`));
      }
      if (id === "settings") {
        body.innerHTML = facts([["Owner Authentication","Server secret"],["Session Duration","8 hours"],["Analytics","Production D1 after deployment"],
          ["Private Assets","R2 server binding"],["Privacy Mode","Restricted"],["Push Delivery","Not configured"]])+
          `<div class="owner-future"><strong>Production remains unchanged</strong><p>This draft requires migration, Worker secret configuration, and explicit deployment approval.</p></div>`;
      }
    } catch (error) {
      if (error.status !== 401) body.innerHTML = `<p class="owner-error">Secure data unavailable. ${esc(error.data?.message || "")}</p>`;
    }
  }
  function close() { clearInterval(poll); host.innerHTML = ""; back?.(); }
  function open(node, onBack) { host = node; back = onBack; token() ? renderOS() : renderAuth(); }
  window.GISOwnerPhone = { open };
})();
