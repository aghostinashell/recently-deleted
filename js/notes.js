"use strict";

(function createNotesApp() {
  const DATA_URL = "data/music/recently-deleted.json";
  let albumData = null;
  let host = null;

  function escapeHtml(value) {
    const node = document.createElement("div");
    node.textContent = String(value ?? "");
    return node.innerHTML;
  }

  async function getAlbum() {
    if (albumData) return albumData;
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error("The notes list could not be loaded.");
    albumData = await response.json();
    if (!Array.isArray(albumData.tracks)) albumData.tracks = [];
    return albumData;
  }

  async function getNote(track) {
    const response = await fetch(track.lyrics);
    if (!response.ok) throw new Error(`The note for ${track.title} is missing or unavailable.`);
    return response.text();
  }

  function noteSummary(text, track) {
    const lines = text.split(/\r?\n/);
    const firstLine = lines[0] || track.title;
    const savedMatch = firstLine.match(/Last saved:\s*(.+)$/i);
    const body = lines.slice(1).join(" ").replace(/\s+/g, " ").trim();
    return { saved: savedMatch ? savedMatch[1] : "", preview: body || "No additional text" };
  }

  async function renderList() {
    host.innerHTML = `<p class="app-loading">Loading notes…</p>`;
    const summaries = await Promise.all(albumData.tracks.map(async (track) => {
      try { return { track, summary: noteSummary(await getNote(track), track), error: false }; }
      catch (error) { return { track, summary: { saved: "", preview: error.message }, error: true }; }
    }));

    host.innerHTML = `
      <div class="notes-view">
        <div class="notes-folder-heading"><span>${escapeHtml(albumData.album)}</span><small>${albumData.tracks.length} Notes</small></div>
        <div class="notes-list">
          ${summaries.map(({ track, summary, error }, index) => `
            <button class="note-row" type="button" data-note-index="${index}">
              <strong>${escapeHtml(track.title)}</strong>
              <span>${escapeHtml(summary.saved || `Track ${track.number}`)}</span>
              <p class="${error ? "note-preview-error" : ""}">${escapeHtml(summary.preview)}</p>
            </button>`).join("") || `<p class="empty-state">No notes are available.</p>`}
        </div>
      </div>`;

    host.querySelectorAll("[data-note-index]").forEach((button) => {
      button.addEventListener("click", () => openNote(Number(button.dataset.noteIndex)));
    });
  }

  async function openNote(index) {
    const track = albumData.tracks[index];
    host.innerHTML = `<p class="app-loading">Loading note…</p>`;
    try {
      const text = await getNote(track);
      host.innerHTML = `
        <div class="note-detail">
          <button class="app-back-button notes-back" type="button">‹ Notes</button>
          <pre class="note-text"></pre>
        </div>`;
      host.querySelector(".note-text").textContent = text;
      host.querySelector(".notes-back").addEventListener("click", () => renderList().catch(showListError));
      document.getElementById("appWindow").scrollTop = 0;
    } catch (error) {
      host.innerHTML = `
        <div class="note-detail">
          <button class="app-back-button notes-back" type="button">‹ Notes</button>
          <p class="app-error">${escapeHtml(error.message)}</p>
        </div>`;
      host.querySelector(".notes-back").addEventListener("click", () => renderList().catch(showListError));
    }
  }

  function showListError(error) {
    host.innerHTML = `<p class="app-error">${escapeHtml(error.message)}</p>`;
  }

  window.MyNotes = {
    async open(container) {
      host = container;
      try {
        await getAlbum();
        await renderList();
      } catch (error) {
        showListError(error);
      }
    }
  };
})();
