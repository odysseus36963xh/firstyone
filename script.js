// ===============================
// GLOBAL STATE
// ===============================
let isReading = false;
let voices = [];

// ===============================
// VOICES INIT (FIXED)
// ===============================
function loadVoices() {
  voices = speechSynthesis.getVoices() || [];
}

speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();

// ===============================
// UTIL: COLUMN + CELL PARSING
// ===============================
function colToIndex(col) {
  return col.toUpperCase().charCodeAt(0) - 65;
}

function parseCell(ref) {
  if (!ref) return null;

  const match = ref.match(/^([A-Z])(\d+)$/i);
  if (!match) return null;

  const col = colToIndex(match[1]);
  const row = parseInt(match[2]);

  if (col < 0 || col > 25 || row < 1 || row > 26) return null;

  return { col, row };
}

// ===============================
// VOICE SELECTION
// ===============================
function getVoice(langCode) {
  const map = {
    EN: "en",
    IT: "it",
    ES: "es",
    FR: "fr",
    DE: "de"
  };

  const lang = map[langCode];
  if (!lang) return null;

  return voices.find(v => v.lang?.toLowerCase().startsWith(lang));
}

// ===============================
// SPEAK FUNCTION (SAFE)
// ===============================
function speak(text, lang, rate) {
  return new Promise(resolve => {
    if (!text || !text.trim()) return resolve();

    const utter = new SpeechSynthesisUtterance(text);

    const voice = getVoice(lang);
    if (voice) utter.voice = voice;

    utter.rate = rate || 1;

    utter.onend = resolve;
    utter.onerror = resolve;

    speechSynthesis.speak(utter);
  });
}

// ===============================
// UI HELPERS
// ===============================
function clearHighlight() {
  document.querySelectorAll(".reading")
    .forEach(c => c.classList.remove("reading"));
}

function stopReading() {
  isReading = false;
  speechSynthesis.cancel();
  clearHighlight();
}

// ===============================
// MAIN READING ENGINE (FIXED SAFE VERSION)
// ===============================
async function startReading() {
  if (isReading) return;
  isReading = true;

  const table = document.getElementById("sheet");

  if (!table) {
    console.error("Table not found");
    isReading = false;
    return;
  }

  const speed = parseFloat(document.getElementById("speed")?.value || "1");
  const repeatRow = parseInt(document.getElementById("repeatRow")?.value || "1");
  const repeatTable = parseInt(document.getElementById("repeatTable")?.value || "1");
  const repeatCell = parseInt(document.getElementById("repeatCell")?.value || "1");

  const start = parseCell(document.getElementById("startCell")?.value) || { row: 1, col: 0 };
  const end = parseCell(document.getElementById("endCell")?.value) || { row: 26, col: 25 };

  const reverse = document.getElementById("reverse")?.checked;

  let rowRange = [];
  let colRange = [];

  for (let r = start.row; r <= end.row; r++) rowRange.push(r);
  for (let c = start.col; c <= end.col; c++) colRange.push(c);

  if (reverse) {
    rowRange.reverse();
    colRange.reverse();
  }

  for (let t = 0; t < repeatTable; t++) {
    for (let r of rowRange) {
      if (!isReading) return;

      const row = table.rows[r + 1];
      if (!row) continue;

      for (let rr = 0; rr < repeatRow; rr++) {
        for (let c of colRange) {
          if (!isReading) return;

          const cell = row.cells[c + 1];
          if (!cell) continue;

          const text = cell.innerText || "";

          const selector = table.rows[1]?.cells[c + 1]?.querySelector("select");
          const lang = selector?.value || "Off";

          if (lang === "Off" || !text.trim()) continue;

          for (let rc = 0; rc < repeatCell; rc++) {
            clearHighlight();
            cell.classList.add("reading");

            await speak(text, lang, speed);
          }
        }
      }
    }
  }

  clearHighlight();
  isReading = false;
}

// ===============================
// TIMESTAMP
// ===============================
function getTimestamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

// ===============================
// EXPORT TABLE (FIXED)
// ===============================
function exportTableData() {
  const table = document.getElementById("sheet");
  if (!table) return null;

  const selectorRow = table.rows[1];
  const data = [];

  for (let r = 2; r < table.rows.length; r++) {
    const row = table.rows[r];
    const rowData = [];

    for (let c = 1; c < row.cells.length; c++) {
      const cell = row.cells[c];

      const selector = selectorRow?.cells[c]?.querySelector("select");

      rowData.push({
        value: (cell?.innerText || "").trim(),
        lang: selector?.value || "Off"
      });
    }

    data.push(rowData);
  }

  return {
    createdAt: new Date().toISOString(),
    columns: 26,
    rows: data.length,
    data
  };
}

// ===============================
// DOWNLOAD JSON
// ===============================
function downloadJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json"
  });

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;

  document.body.appendChild(a);
  a.click();

  a.remove();
  URL.revokeObjectURL(url);
}

// ===============================
// SAVE DIALOG
// ===============================
function openSaveDialog(defaultName, onConfirm) {
  const overlay = document.createElement("div");
  overlay.style.cssText = `
    position:fixed; inset:0;
    background:rgba(0,0,0,0.4);
    display:flex;
    align-items:center;
    justify-content:center;
    z-index:9999;
  `;

  const box = document.createElement("div");
  box.style.cssText = `
    background:#fff;
    padding:20px;
    border-radius:10px;
    width:320px;
    font-family:Arial;
  `;

  box.innerHTML = `
    <h3>Save Table</h3>
    <input id="fileName" style="width:100%;padding:8px" value="${defaultName}">
    <div style="margin-top:12px;display:flex;justify-content:flex-end;gap:8px;">
      <button id="cancel">Cancel</button>
      <button id="save">Save</button>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.appendChild(box);

  overlay.querySelector("#cancel").onclick = () => overlay.remove();

  overlay.querySelector("#save").onclick = () => {
    const name = overlay.querySelector("#fileName").value.trim();
    overlay.remove();
    onConfirm(name || defaultName);
  };
}

// ===============================
// SAVE TABLE (FINAL FIXED)
// ===============================
function saveTable() {
  const filename = `language-table_${getTimestamp()}.json`;
  const data = exportTableData();

  if (!data) return;

  openSaveDialog(filename, (finalName) => {
    downloadJSON(
      finalName.endsWith(".json") ? finalName : finalName + ".json",
      data
    );
  });
}

// ===============================
// UI TOGGLES (FROM YOUR HTML)
// ===============================
function toggleUpload() {
  const box = document.getElementById("uploadBox");
  if (!box) return;
  box.style.display = box.style.display === "block" ? "none" : "block";
}

function toggleReader() {
  const bar = document.getElementById("toolbar");
  if (!bar) return;
  bar.style.display = bar.style.display === "flex" ? "none" : "flex";
}
