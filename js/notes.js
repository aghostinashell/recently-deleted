"use strict";

(function createNotesApp() {
  const DATA_URL = "data/notes/notes.json";
  let notes = null;
  let host = null;

  function escapeHtml(value) {
    const node = document.createElement("div");
    node.textContent = String(value ?? "");
    return node.innerHTML;
  }

  async function getNotes() {
    if (notes) return notes;
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error("The notes list could not be loaded.");
    const data = await response.json();
    notes = Array.isArray(data.notes) ? data.notes : [];
    return notes;
  }

  function preview(note) {
    return note.content.replace(/\s+/g, " ").trim() || "No additional text";
  }

  function renderList() {
    host.innerHTML = `
      <div class="notes-view">
        <div class="notes-folder-heading"><span>Notes</span><small>${notes.length} Notes</small></div>
        <div class="notes-list">
          ${notes.map((note, index) => `
            <button class="note-row" type="button" data-note-index="${index}">
              <strong>${escapeHtml(note.title)}</strong>
              <span>${escapeHtml(note.saved || "")}</span>
              <p>${escapeHtml(preview(note))}</p>
            </button>`).join("") || `<p class="empty-state">No notes are available.</p>`}
        </div>
      </div>`;

    host.querySelectorAll("[data-note-index]").forEach((button) => {
      button.addEventListener("click", () => openNote(Number(button.dataset.noteIndex)));
    });
  }

  function openNote(index) {
    const note = notes[index];
    host.innerHTML = `
      <div class="note-detail">
        <button class="app-back-button notes-back" type="button">‹ Notes</button>
        <pre class="note-text"></pre>
      </div>`;
    host.querySelector(".note-text").textContent = note.content;
    host.querySelector(".notes-back").addEventListener("click", renderList);
    document.getElementById("appWindow").scrollTop = 0;
  }

  function showListError(error) {
    host.innerHTML = `<p class="app-error">${escapeHtml(error.message)}</p>`;
  }

  window.MyNotes = {
    async open(container) {
      host = container;
      try {
        await getNotes();
        renderList();
      } catch (error) {
        showListError(error);
      }
    }
  };
})();
