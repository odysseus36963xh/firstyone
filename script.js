// ===============================
// GLOBAL STATE
// ===============================
let isReading = false;
let voices = [];

speechSynthesis.onvoiceschanged = () => {
  voices = speechSynthesis.getVoices();
};
// ===============================
// VOICES INIT (FIXED)
// ===============================
function loadVoices() {
  voices = speechSynthesis.getVoices() || [];
}

voices = speechSynthesis.getVoices();
speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();

// ===============================
// UTIL: COLUMN + CELL PARSING
// ===============================
function colToIndex(col) {
  return col.toUpperCase().charCodeAt(0) - 65;
}
@@ -25,23 +35,37 @@ function parseCell(ref) {
  return { col, row };
}

// ===============================
// VOICE SELECTION
// ===============================
function getVoice(langCode) {
  const map = { EN: "en", IT: "it", ES: "es", FR: "fr", DE: "de" };
  const map = {
    EN: "en",
    IT: "it",
    ES: "es",
    FR: "fr",
    DE: "de"
  };

  const lang = map[langCode];
  if (!lang) return null;

  return voices.find(v => v.lang.toLowerCase().startsWith(lang));
  return voices.find(v => v.lang?.toLowerCase().startsWith(lang));
}

// ===============================
// SPEAK FUNCTION (SAFE)
// ===============================
function speak(text, lang, rate) {
  return new Promise(resolve => {
    if (!text.trim()) return resolve();
    if (!text || !text.trim()) return resolve();

    const utter = new SpeechSynthesisUtterance(text);
    const voice = getVoice(lang);

    const voice = getVoice(lang);
    if (voice) utter.voice = voice;
    utter.rate = rate;

    utter.rate = rate || 1;

    utter.onend = resolve;
    utter.onerror = resolve;
@@ -50,8 +74,12 @@ function speak(text, lang, rate) {
  });
}

// ===============================
// UI HELPERS
// ===============================
function clearHighlight() {
  document.querySelectorAll(".reading").forEach(c => c.classList.remove("reading"));
  document.querySelectorAll(".reading")
    .forEach(c => c.classList.remove("reading"));
}

function stopReading() {
@@ -60,26 +88,35 @@ function stopReading() {
  clearHighlight();
}

// ===============================
// MAIN READING ENGINE (FIXED SAFE VERSION)
// ===============================
async function startReading() {
  if (isReading) return;
  isReading = true;

  const table = document.getElementById("sheet");

  const speed = parseFloat(document.getElementById("speed").value);
  const repeatRow = parseInt(document.getElementById("repeatRow").value);
  const repeatTable = parseInt(document.getElementById("repeatTable").value);
  const repeatCell = parseInt(document.getElementById("repeatCell").value);
  if (!table) {
    console.error("Table not found");
    isReading = false;
    return;
  }

  const start = parseCell(document.getElementById("startCell").value) || { row: 1, col: 0 };
  const end = parseCell(document.getElementById("endCell").value) || { row: 26, col: 25 };
  const speed = parseFloat(document.getElementById("speed")?.value || "1");
  const repeatRow = parseInt(document.getElementById("repeatRow")?.value || "1");
  const repeatTable = parseInt(document.getElementById("repeatTable")?.value || "1");
  const repeatCell = parseInt(document.getElementById("repeatCell")?.value || "1");

  const reverse = document.getElementById("reverse").checked;
  const start = parseCell(document.getElementById("startCell")?.value) || { row: 1, col: 0 };
  const end = parseCell(document.getElementById("endCell")?.value) || { row: 26, col: 25 };

  let rowRange = [];
  for (let r = start.row; r <= end.row; r++) rowRange.push(r);
  const reverse = document.getElementById("reverse")?.checked;

  let rowRange = [];
  let colRange = [];

  for (let r = start.row; r <= end.row; r++) rowRange.push(r);
  for (let c = start.col; c <= end.col; c++) colRange.push(c);

  if (reverse) {
@@ -92,17 +129,19 @@ async function startReading() {
      if (!isReading) return;

      const row = table.rows[r + 1];
      if (!row) continue;

      for (let rr = 0; rr < repeatRow; rr++) {

        for (let c of colRange) {
          if (!isReading) return;

          const cell = row.cells[c + 1];
          const text = cell.innerText;
          if (!cell) continue;

          const selector = table.rows[1].cells[c + 1].querySelector("select");
          const lang = selector.value;
          const text = cell.innerText || "";

          const selector = table.rows[1]?.cells[c + 1]?.querySelector("select");
          const lang = selector?.value || "Off";

          if (lang === "Off" || !text.trim()) continue;

@@ -121,47 +160,38 @@ async function startReading() {
  isReading = false;
}



// ===============================
// SAVE TABLE AS JSON (FULL FEATURE)
// TIMESTAMP
// ===============================

function getTimestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");

  return (
    d.getFullYear() + "-" +
    pad(d.getMonth() + 1) + "-" +
    pad(d.getDate()) + "_" +
    pad(d.getHours()) + "-" +
    pad(d.getMinutes()) + "-" +
    pad(d.getSeconds())
  );
  const pad = n => String(n).padStart(2, "0");

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

// Build table JSON
// ===============================
// EXPORT TABLE (FIXED)
// ===============================
function exportTableData() {
  const table = document.getElementById("sheet");
  if (!table) return null;

  const data = [];
  const selectors = [];

  // language selector row is index 1
  const selectorRow = table.rows[1];
  const data = [];

  for (let r = 2; r < table.rows.length; r++) {
    const row = table.rows[r];
    const rowData = [];

    for (let c = 1; c < row.cells.length; c++) {
      const cell = row.cells[c];
      const selector = selectorRow.cells[c].querySelector("select");

      const selector = selectorRow?.cells[c]?.querySelector("select");

      rowData.push({
        value: cell.innerText,
        lang: selector ? selector.value : "Off"
        value: (cell?.innerText || "").trim(),
        lang: selector?.value || "Off"
      });
    }

@@ -171,12 +201,14 @@ function exportTableData() {
  return {
    createdAt: new Date().toISOString(),
    columns: 26,
    rows: 26,
    rows: data.length,
    data
  };
}

// Download JSON file
// ===============================
// DOWNLOAD JSON
// ===============================
function downloadJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json"
@@ -187,22 +219,21 @@ function downloadJSON(filename, data) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;

  document.body.appendChild(a);
  a.click();

  document.body.removeChild(a);
  a.remove();
  URL.revokeObjectURL(url);
}

// ===============================
// SAVE DIALOG (POPUP)
// SAVE DIALOG
// ===============================
function openSaveDialog(defaultName, onConfirm) {
  const overlay = document.createElement("div");
  overlay.style = `
    position:fixed;
    top:0;left:0;
    width:100%;height:100%;
  overlay.style.cssText = `
    position:fixed; inset:0;
    background:rgba(0,0,0,0.4);
    display:flex;
    align-items:center;
@@ -211,54 +242,63 @@ function openSaveDialog(defaultName, onConfirm) {
  `;

  const box = document.createElement("div");
  box.style = `
    background:white;
  box.style.cssText = `
    background:#fff;
    padding:20px;
    border-radius:8px;
    border-radius:10px;
    width:320px;
    font-family:Arial;
  `;

  box.innerHTML = `
    <h3 style="margin-top:0;">Save Table</h3>
    <p style="font-size:12px;color:#666;">Choose file name</p>
    <input id="saveFileName" style="width:100%;padding:8px;"
           value="${defaultName}">
    <div style="margin-top:15px; display:flex; gap:10px; justify-content:flex-end;">
      <button id="cancelSave" style="background:#ccc;color:#000;">Cancel</button>
      <button id="confirmSave">Save</button>
    <h3>Save Table</h3>
    <input id="fileName" style="width:100%;padding:8px" value="${defaultName}">
    <div style="margin-top:12px;display:flex;justify-content:flex-end;gap:8px;">
      <button id="cancel">Cancel</button>
      <button id="save">Save</button>
    </div>
  `;

  overlay.appendChild(box);
  document.body.appendChild(overlay);
  overlay.appendChild(box);

  document.getElementById("cancelSave").onclick = () => {
    overlay.remove();
  };
  overlay.querySelector("#cancel").onclick = () => overlay.remove();

  document.getElementById("confirmSave").onclick = () => {
    const name = document.getElementById("saveFileName").value.trim();
  overlay.querySelector("#save").onclick = () => {
    const name = overlay.querySelector("#fileName").value.trim();
    overlay.remove();
    onConfirm(name || defaultName);
  };
}

// ===============================
// MAIN SAVE FUNCTION
// SAVE TABLE (FINAL FIXED)
// ===============================
function saveTable() {
  const autoName = `language-table_${getTimestamp()}.json`;
  const filename = `language-table_${getTimestamp()}.json`;
  const data = exportTableData();

  openSaveDialog(autoName, (filename) => {
    downloadJSON(filename.endsWith(".json") ? filename : filename + ".json", data);
  if (!data) return;

  openSaveDialog(filename, (finalName) => {
    downloadJSON(
      finalName.endsWith(".json") ? finalName : finalName + ".json",
      data
    );
  });
}

// ===============================
// CONNECT BUTTON
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
