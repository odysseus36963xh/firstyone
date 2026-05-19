// ===============================
// GLOBAL STATE
// ===============================
let isReading = false;
let voices = [];

speechSynthesis.onvoiceschanged = () => {
  voices = speechSynthesis.getVoices();
};

function loadVoices() {
  voices = speechSynthesis.getVoices() || [];
}
voices = speechSynthesis.getVoices();
speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();


// ===============================
// AUDIO RECORDING (Speaker Only - Static App)
// ===============================
let audioContext = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let recordingStartTime = 0;
let recordingTimerInterval = null;

async function initializeRecorder() {
  try {
    // Get system audio + mic access
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    // Create recorder from stream
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
      saveRecordingAsWebM();
    };

    return true;
  } catch (err) {
    alert("❌ Audio access failed: " + err.message);
    return false;
  }
}

async function startRecording() {
  const recordBtn = document.getElementById("recordBtn");
  const stopBtn = document.getElementById("stopRecordBtn");
  const status = document.getElementById("recordingStatus");
  const timer = document.getElementById("recordingTimer");

  const ready = await initializeRecorder();
  if (!ready) return;

  mediaRecorder.start();
  isRecording = true;
  recordingStartTime = Date.now();

  recordBtn.style.display = "none";
  stopBtn.style.display = "inline-block";
  status.style.display = "block";
  timer.style.display = "block";
  timer.textContent = " 00:00";

  // Update timer every second
  recordingTimerInterval = setInterval(() => {
    if (!isRecording) {
      clearInterval(recordingTimerInterval);
      return;
    }
    const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
    const mins = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const secs = String(elapsed % 60).padStart(2, "0");
    timer.textContent = ` ${mins}:${secs}`;
  }, 1000);

  console.log("Recording started");
}

function stopRecording() {
  if (!isRecording || !mediaRecorder) return;

  isRecording = false;
  mediaRecorder.stop();
  clearInterval(recordingTimerInterval);

  document.getElementById("recordBtn").style.display = "inline-block";
  document.getElementById("stopRecordBtn").style.display = "none";
  document.getElementById("recordingStatus").style.display = "none";
  document.getElementById("recordingTimer").style.display = "none";

  console.log("Recording stopped");
}

function saveRecordingAsWebM() {
  if (!audioChunks.length) {
    alert("No audio recorded.");
    return;
  }

  const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
  const url = URL.createObjectURL(audioBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `recording_${getTimestamp()}.webm`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  const status = document.getElementById("recordingStatus");
  status.textContent = "✅ Recording saved!";
  status.style.background = "#27ae60";
  setTimeout(() => {
    status.style.display = "none";
  }, 3000);
}







// ===============================
// UTIL: COLUMN + CELL PARSING
// ===============================
function colToIndex(col) {
  return col.toUpperCase().charCodeAt(0) - 65;
}

function parseCell(ref) {
  if (!ref || ref.trim() === "") return null;
  const match = ref.match(/^([A-Z]+)(\d+)$/i);
  if (!match) return null;
  // Returns 1-based row index to match UI (A1 = row 1)
  const col = colToIndex(match[1]);
  const row = parseInt(match[2]);
  return { col, row };
}

// ===============================
// VOICE SELECTION
// ===============================
function getVoice(langCode) {
  const map = { EN: "en", IT: "it", ES: "es", FR: "fr", DE: "de" };
  const lang = map[langCode];
  if (!lang) return null;
  return voices.find(v => v.lang?.toLowerCase().startsWith(lang));
}

// ===============================
// SPEAK FUNCTION
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
// ===============================
// UI HELPERS
// ===============================
function clearHighlight() {
  document.querySelectorAll(".reading").forEach(c => c.classList.remove("reading"));
}

window.currentMediaElement = null; // Global tracker for audio/video playback

function stopReading() {
  isReading = false;
  speechSynthesis.cancel();
  
  // Stop custom audio/video if playing
  if (window.currentMediaElement) {
    window.currentMediaElement.pause();
    window.currentMediaElement = null;
  }
  
  // Hide the popup card
  const popup = document.getElementById("mediaPopup");
  if (popup) popup.classList.remove("show");
  
  clearHighlight();
}


// ===============================
// MEDIA PLAYER
// ===============================
function playCellMedia(cell) {
  return new Promise((resolve) => {
    const mediaUrl = cell.dataset.mediaUrl;
    const mediaType = cell.dataset.mediaType;
    const popup = document.getElementById("mediaPopup");

    if (!popup || !mediaUrl) {
      if (popup) popup.classList.remove("show");
      return resolve("no-media"); 
    }

    // IF IMAGE: Show the card and instantly resolve so TTS reads the text
    if (mediaType.startsWith("image")) {
      popup.innerHTML = `<img src="${mediaUrl}">`;
      popup.classList.add("show");
      return resolve("image"); 
    } 
    
    // IF AUDIO/VIDEO: Play the file, wait to resolve until it finishes
    if (mediaType.startsWith("audio") || mediaType.startsWith("video")) {
      let mediaElement = document.createElement(mediaType.startsWith("audio") ? "audio" : "video");
      mediaElement.src = mediaUrl;
      window.currentMediaElement = mediaElement;

      if (mediaType.startsWith("video")) {
        popup.innerHTML = "";
        popup.appendChild(mediaElement);
        popup.classList.add("show");
      }

      mediaElement.onended = () => {
        window.currentMediaElement = null;
        resolve("played-audio");
      };
      
      // If error occurs, don't freeze the app, just move on
      mediaElement.onerror = () => resolve("error"); 

      mediaElement.play().catch(() => resolve("error"));
    }
  });
}




// ===============================
// MAIN READING ENGINE
// ===============================
// ===============================
// MAIN READING ENGINE
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

  if (reverse) { rowRange.reverse(); colRange.reverse(); }

  for (let rt = 0; rt < repeatTable; rt++) {
    if (!isReading) return;
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
          const hasMedia = cell.dataset.mediaUrl !== undefined; // Check for media

          // Skip if language is Off, OR if there's no text AND no media attached
          if (lang === "Off" || (!text.trim() && !hasMedia)) continue;

          for (let rc = 0; rc < repeatCell; rc++) {
            if (!isReading) return;
            cell.classList.add("reading");

            // 1. Play media (image popup or audio/video playback)
            let mediaResult = await playCellMedia(cell);

            if (!isReading) return; // Check again in case user clicked Stop during media

            // 2. Read text via TTS (Only if it wasn't a custom audio/video recording)
            if (mediaResult !== "played-audio") {
              // Strip the emojis out so the TTS doesn't read them out loud
              let cleanText = text.replace(/[🖼️🎵🎥]/g, "").trim(); 
              if (cleanText) {
                await speak(cleanText, lang, speed);
              }
            }

            // 3. Clean up the popup card after it finishes the cell
            const popup = document.getElementById("mediaPopup");
            if (popup) popup.classList.remove("show");

            cell.classList.remove("reading");
          }
        }
      }
    }
  }
  isReading = false;
}








// ===============================
// EXPORT & SAVE (harmonised)
// ===============================
function getTimestamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

function exportTableData() {
  const table = document.getElementById("sheet");
  if (!table) return null;

  const dataRows = table.rows.length - 2;
  const colCount = 26;

  const cells = [];           // 2D array of plain strings
  const languages = [];       // column language values

  // Column languages from the selector row (row 1)
  const selectorRow = table.rows[1];
  for (let c = 0; c < colCount; c++) {
    const cell = selectorRow?.cells[c + 1];
    const select = cell?.querySelector("select");
    languages.push(select?.value || "Off");
  }

  // Data rows (starting at index 2)
  for (let r = 2; r < table.rows.length; r++) {
    const row = table.rows[r];
    const rowData = [];
    for (let c = 1; c <= colCount; c++) {
      rowData.push(row.cells[c]?.innerText?.trim() || "");
    }
    cells.push(rowData);
  }

  return {
    createdAt: new Date().toISOString(),
    columns: colCount,
    rows: dataRows,
    cells,
    languages
  };
}

function downloadJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function openSaveDialog(defaultName, onConfirm) {
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:9999;";
  const box = document.createElement("div");
  box.style.cssText = "background:#fff;padding:20px;border-radius:10px;width:320px;font-family:Arial;";
  box.innerHTML = `
    <h3 style="margin-top:0;">Save Table</h3>
    <input id="fileName" style="width:100%;padding:8px" value="${defaultName}">
    <div style="margin-top:12px;display:flex;justify-content:flex-end;gap:8px;">
      <button id="cancel">Cancel</button>
      <button id="save">Save</button>
    </div>`;
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  overlay.querySelector("#cancel").onclick = () => overlay.remove();
  overlay.querySelector("#save").onclick = () => {
    const name = overlay.querySelector("#fileName").value.trim();
    overlay.remove();
    onConfirm(name || defaultName);
  };
}

function saveTable() {
  const filename = `language-table_${getTimestamp()}.json`;
  const data = exportTableData();
  if (!data) return;
  openSaveDialog(filename, (finalName) => {
    downloadJSON(finalName.endsWith(".json") ? finalName : finalName + ".json", data);
  });
}

// ===============================
// UPLOAD TABLE (harmonised)
// ===============================
// ===============================
// UPLOAD TABLE (harmonised) - FIXED
// ===============================
function uploadTable() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";

  input.onchange = function () {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const data = JSON.parse(e.target.result);

        if (!data.cells || !data.languages) {
          throw new Error("Missing 'cells' or 'languages'");
        }

        const table = document.getElementById("sheet");
        if (!table) throw new Error("Table not found");

        // Remove all existing data rows (keep header + selector row)
        while (table.rows.length > 2) {
          table.deleteRow(2);
        }

        // Restore column language selectors
        const selectorRow = table.rows[1];
        for (let c = 0; c < data.languages.length; c++) {
          const cell = selectorRow.cells[c + 1];
          const select = cell?.querySelector("select");
          if (select) select.value = data.languages[c];
        }

        // Rebuild data rows
        data.cells.forEach((rowArray) => {
          const newRow = table.insertRow();
          const numberCell = newRow.insertCell();
          numberCell.textContent = newRow.rowIndex - 1;
          numberCell.className = "row-number";

          rowArray.forEach((text) => {
            const td = newRow.insertCell();
            td.textContent = text || "";
            
            // 👇👇👇 THIS IS THE FIX 👇👇👇
            td.contentEditable = "true"; 
            // 👆👆👆 ADD THIS LINE 👆👆👆
          });
        });

        // Success notification
        if (typeof flash === "function") {
          flash("Table uploaded ✓");
        } else {
          alert("Table uploaded successfully.");
        }

      } catch (err) {
        alert("Invalid JSON file: " + (err.message || ""));
      }
    };
    reader.readAsText(file);
  };

  input.click();
}













// ===============================
// UI TOGGLES
// ===============================
function toggleUpload() {
  const box = document.getElementById("uploadBox");
  if (!box) return;
  box.style.display = box.style.display === "block" ? "none" : "block";
}


function toggleExtract() {
  const box = document.getElementById("extractBox");
  if (!box) return;

  // Close upload if open (keeps UI clean)
  const uploadBox = document.getElementById("uploadBox");
  if (uploadBox) uploadBox.style.display = "none";

  box.style.display = box.style.display === "block" ? "none" : "block";
}


function toggleReader() {
  const bar = document.getElementById("toolbar");
  if (!bar) return;
  bar.style.display = bar.style.display === "flex" ? "none" : "flex";
} 




// ===============================
// UI TOGGLES
// ===============================

















// ===============================
// Upload
// ===============================

window.uploadColumn = function () {
  console.log("🚀 UPLOAD CLICKED!");

  const rawText = document.getElementById("columnData").value.trim();
  if (!rawText) {
    alert("Please paste some text.");
    return;
  }

  const startCellInput = document.getElementById("startCellUpload").value.trim().toUpperCase();
  const direction = document.getElementById("uploadDirection").value;

  let startCol = 0;   // Default = Column A
  let startRow = 0;   // Default = Row 1

  if (startCellInput) {
    const match = startCellInput.match(/^([A-Z]+)(\d+)$/);
    if (!match) {
      alert("Invalid cell format. Please use something like A1, B5, or C12");
      return;
    }
    startCol = match[1].charCodeAt(0) - 65;
    startRow = parseInt(match[2]) - 1;
  }

  const lines = rawText.split(/\r?\n/).map(x => x.trim()).filter(x => x !== "");

  // Auto-expand table if needed
  const neededRows = direction === "down" 
    ? startRow + lines.length 
    : startRow + 1;

  const currentRows = sheetTable.rows.length - 2;
  if (neededRows > currentRows) {
    addNewRows(neededRows - currentRows);
  }

  // Fill the cells
  for (let i = 0; i < lines.length; i++) {
    let rowIndex = startRow;
    let colIndex = startCol;

    if (direction === "down") {
      rowIndex += i;
    } else {
      colIndex += i;
    }

    const row = sheetTable.rows[rowIndex + 2];
    if (!row) continue;
    const cell = row.cells[colIndex + 1];
    if (!cell) continue;

    cell.innerText = lines[i];
  }

  alert(`✅ Successfully uploaded ${lines.length} item${lines.length === 1 ? '' : 's'}!`);

  // Optional: clear the input after successful upload
  // document.getElementById("columnData").value = "";
};



// ===============================
// EXTRACT RANGE
// ===============================
function extractRange(mode) {
  const table = document.getElementById("sheet");
  if (!table) {
    alert("Table not found.");
    return;
  }

  const startRef = document.getElementById("extractStart").value.trim().toUpperCase();
  const endRef   = document.getElementById("extractEnd").value.trim().toUpperCase();

  const start = parseCell(startRef);
  const end   = parseCell(endRef);

  if (!start || !end) {
    alert("Invalid cell format. Use format like A1 or C5.");
    return;
  }

  // Normalize selection (handles reversed input)
  const startRow = Math.min(start.row, end.row);
  const endRow   = Math.max(start.row, end.row);
  const startCol = Math.min(start.col, end.col);
  const endCol   = Math.max(start.col, end.col);

  let extracted = [];

  for (let r = startRow; r <= endRow; r++) {
    const tableRow = table.rows[r + 1]; // +1 offset (header row)
    if (!tableRow) continue;

    let rowData = [];

    for (let c = startCol; c <= endCol; c++) {
      const cell = tableRow.cells[c + 1]; // +1 skip row number column
      if (!cell) continue;

      rowData.push(cell.innerText || "");

      if (mode === "remove") {
        cell.innerText = "";
      }
    }

    extracted.push(rowData.join("\t"));
  }

  if (mode === "copy") {
    const text = extracted.join("\n");

    navigator.clipboard.writeText(text).then(() => {
      alert("✅ Range copied!");
    }).catch(() => {
      alert("Clipboard blocked by browser.");
    });
  }

  if (mode === "remove") {
    alert("✅ Range cleared!");
  }
}













document.getElementById("openFinder").addEventListener("click", () => {
  const newTab = window.open("", "_blank");
  if (!newTab) {
    alert("Allow pop-ups for this site to open the Frequency Finder.");
    return;
  }

  newTab.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Frequency Finder</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{
    font-family:'Segoe UI',Arial,sans-serif;
    background:#0d0d0d;color:#e0e0e0;
    padding:24px;min-height:100vh;
  }
  h1{color:#5ea4ff;margin-bottom:6px;font-size:28px}
  .subtitle{color:#888;margin-bottom:18px;font-size:14px;line-height:1.5}
  textarea{
    width:100%;height:320px;padding:16px;
    font-size:15px;line-height:1.6;
    border-radius:10px;border:2px solid #222;
    background:#141414;color:#e0e0e0;
    resize:vertical;outline:none;
    transition:border-color .2s;
  }
  textarea:focus{border-color:#5ea4ff}
  .controls{
    display:flex;flex-wrap:wrap;gap:10px;
    align-items:center;margin-top:14px;
  }
  .controls label{color:#aaa;font-size:14px}
  .controls input[type=number], .controls input[type=text]{
    padding:10px 12px;font-size:14px;
    border:none;border-radius:8px;
    background:#1a1a1a;color:#e0e0e0;
  }
  .controls input[type=number]{width:65px;text-align:center}
  .controls input[type=text]{width:220px}
  .controls input::placeholder{color:#555}
  button{
    background:linear-gradient(135deg,#2b7cff,#1a5ec2);
    color:#fff;border:none;padding:11px 22px;
    border-radius:10px;cursor:pointer;font-size:15px;
    font-weight:600;transition:all .2s;
  }
  button:hover{transform:translateY(-1px);box-shadow:0 4px 18px #2b7cff55}
  button:active{transform:translateY(0)}
  button:disabled{opacity:.5;cursor:wait;transform:none;box-shadow:none}
  
  /* COPY BUTTONS */
  .copy-btn{
    background:#1a1a1a;border:1px solid #333;color:#aaa;
    padding:9px 14px;font-size:13px;border-radius:8px;cursor:pointer;
    transition:all .2s;font-weight:500;
  }
  .copy-btn:hover{background:#222;color:#fff;border-color:#5ea4ff}
  .copy-btn.copied{background:#1b5e20;border-color:#4caf50;color:#fff}

  .stats{
    margin-top:18px;padding:12px 16px;
    background:#161616;border-radius:8px;
    font-size:13px;color:#999;display:none;
  }
  .stats span{color:#5ea4ff;font-weight:700}
  .table-wrap{
    margin-top:20px;max-height:60vh;
    overflow-y:auto;border-radius:10px;
    border:1px solid #222;display:none;
  }
  table{width:100%;border-collapse:collapse;background:#111}
  thead{position:sticky;top:0;z-index:2}
  th{
    background:#1e1e1e;color:#5ea4ff;
    padding:14px 16px;text-align:left;
    font-size:14px;border-bottom:2px solid #333;
  }
  td{
    padding:10px 16px;border-bottom:1px solid #1a1a1a;
    font-size:14px;
  }
  tr:hover td{background:#1a2233}
  tr:nth-child(even) td{background:#0f0f0f}
  tr:nth-child(even):hover td{background:#1a2233}
  .rank{color:#555;font-size:12px;margin-right:8px}
  .bar-cell{position:relative}
  .bar{
    position:absolute;left:0;top:0;bottom:0;
    background:#2b7cff15;border-radius:3px;
    pointer-events:none;transition:width .4s ease;
  }
  .bar-text{position:relative;z-index:1}
  .no-results{
    text-align:center;padding:40px;color:#555;font-size:15px;
  }
  .spinner{
    display:inline-block;width:18px;height:18px;
    border:3px solid #ffffff44;border-top-color:#fff;
    border-radius:50%;animation:spin .6s linear infinite;
    vertical-align:middle;margin-right:8px;
  }
  @keyframes spin{to{transform:rotate(360deg)}}
</style>
</head>
<body>

<h1>\u{1F50D} Frequency Finder</h1>
<div class="subtitle">
  Paste any text \u2014 Bible verses, Bhagavad Gita, Quran, Tao Te Ching,
  Tolstoy poems, or anything in any language. Digits & punctuation are stripped.
  Case is ignored. Copy any column instantly.
</div>

<textarea id="textInput"
  placeholder="Paste your text here \u2014 large or small\u2026"></textarea>

<div class="controls">
  <label>Combo size:</label>
  <input id="comboSize" type="number" min="1" max="12" value="1">
  <button id="findBtn">Find Frequency</button>
  <input id="filterInput" type="text" placeholder="Filter results\u2026">
  <button id="copyWords" class="copy-btn">Copy Words</button>
  <button id="copyCounts" class="copy-btn">Copy Counts</button>
  <button id="copyPcts" class="copy-btn">Copy %</button>
</div>

<div class="stats" id="stats"></div>

<div class="table-wrap" id="tableWrap">
  <table id="resultTable">
    <thead>
      <tr>
        <th style="width:40%">Word / Combination</th>
        <th style="width:20%">Count</th>
        <th style="width:40%">% of Text</th>
      </tr>
    </thead>
    <tbody id="tbody"></tbody>
  </table>
</div>

<script>
(function(){
  "use strict";

  /* ---------- helpers ---------- */
  function normalizeText(text){
    text = text.normalize("NFKC");
    text = text.replace(/\\p{N}/gu, " ");
    text = text.toLocaleLowerCase();
    text = text.replace(/[\\p{P}\\p{S}\\p{C}]/gu, " ");
    text = text.replace(/\\s+/g, " ").trim();
    return text;
  }

  function tokenize(text){
    var m = text.match(/\\p{L}+/gu);
    return m ? m : [];
  }

  function buildNgrams(words, n){
    if(n < 1) n = 1;
    var out = [];
    for(var i = 0; i <= words.length - n; i++){
      out.push(words.slice(i, i + n).join(" "));
    }
    return out;
  }

  function escapeHtml(s){
    return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  /* ---------- state ---------- */
  var findBtn    = document.getElementById("findBtn");
  var textInput  = document.getElementById("textInput");
  var comboInput = document.getElementById("comboSize");
  var filterIn   = document.getElementById("filterInput");
  var tbody      = document.getElementById("tbody");
  var tableWrap  = document.getElementById("tableWrap");
  var statsDiv   = document.getElementById("stats");

  var allResults = [];
  var currentDisplay = [];

  /* ---------- render ---------- */
  function renderTable(data){
    currentDisplay = data; // track what's visible for copying
    var maxCount = data.length ? data[0].count : 1;
    var html = "";
    var limit = Math.min(data.length, 5000);

    for(var i = 0; i < limit; i++){
      var d = data[i];
      var pct = d.pct.toFixed(4);
      var barW = ((d.count / maxCount) * 100).toFixed(2);
      html += '<tr>' +
        '<td><span class="rank">#' + (i+1) + '</span>' + escapeHtml(d.word) + '</td>' +
        '<td>' + d.count.toLocaleString() + '</td>' +
        '<td class="bar-cell">' +
          '<div class="bar" style="width:' + barW + '%"></div>' +
          '<span class="bar-text">' + pct + '%</span>' +
        '</td>' +
      '</tr>';
    }

    if(data.length > limit){
      html += '<tr><td colspan="3" class="no-results">Showing top ' + limit.toLocaleString() + ' of ' + data.length.toLocaleString() + '</td></tr>';
    }
    if(!data.length){
      html = '<tr><td colspan="3" class="no-results">No results.</td></tr>';
    }

    tbody.innerHTML = html;
  }

  /* ---------- main logic ---------- */
  findBtn.addEventListener("click", function(){
    var raw = textInput.value;
    if(!raw.trim()){ alert("Please paste some text first."); return; }

    findBtn.disabled = true;
    findBtn.innerHTML = '<span class="spinner"></span>Processing\u2026';

    setTimeout(function(){
      var n = parseInt(comboInput.value, 10) || 1;
      if(n < 1) n = 1; if(n > 12) n = 12;
      comboInput.value = n;

      var cleaned = normalizeText(raw);
      var words   = tokenize(cleaned);
      if(!words.length){ alert("No words found."); resetBtn(); return; }

      var units = buildNgrams(words, n);
      var freq  = Object.create(null);
      for(var i = 0; i < units.length; i++){
        freq[units[i]] = (freq[units[i]] || 0) + 1;
      }

      var total = units.length;
      var sorted = Object.keys(freq).map(function(w){
        return { word:w, count:freq[w], pct:(freq[w]/total)*100 };
      }).sort(function(a,b){ return b.count - a.count; });

      allResults = sorted;
      statsDiv.style.display = "block";
      statsDiv.innerHTML = 'Tokens: <span>'+total.toLocaleString()+'</span> | Unique: <span>'+sorted.length.toLocaleString()+'</span> | Combo: <span>'+n+'</span>';
      
      renderTable(sorted);
      tableWrap.style.display = "block";
      resetBtn();
    }, 50);
  });

  function resetBtn(){
    findBtn.disabled = false;
    findBtn.textContent = "Find Frequency";
  }

  /* ---------- filter ---------- */
  filterIn.addEventListener("input", function(){
    var q = this.value.toLocaleLowerCase().trim();
    if(!q){ renderTable(allResults); return; }
    renderTable(allResults.filter(function(d){ return d.word.indexOf(q) !== -1; }));
  });

  /* ---------- COPY COLUMNS ---------- */
  function setupCopy(btnId, extractor){
    document.getElementById(btnId).addEventListener("click", function(){
      if(!currentDisplay.length) return;
      var text = currentDisplay.map(extractor).join("\\n");
      navigator.clipboard.writeText(text).then(() => {
        var btn = this, orig = btn.textContent;
        btn.textContent = "Copied!";
        btn.classList.add("copied");
        setTimeout(() => { btn.textContent = orig; btn.classList.remove("copied"); }, 1400);
      }).catch(() => {
        // Fallback for older browsers or non-HTTPS
        var ta = document.createElement("textarea");
        ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select();
        document.execCommand("copy"); document.body.removeChild(ta);
        var btn = this, orig = btn.textContent;
        btn.textContent = "Copied!"; btn.classList.add("copied");
        setTimeout(() => { btn.textContent = orig; btn.classList.remove("copied"); }, 1400);
      });
    });
  }

  setupCopy("copyWords",  d => d.word);
  setupCopy("copyCounts", d => d.count);
  setupCopy("copyPcts",   d => d.pct.toFixed(4) + "%");

})();
</script>
</body>
</html>`);

  newTab.document.close();
});




// ===============================
// RECORDER BUTTON EVENTS
// ===============================
document.getElementById("recordBtn")?.addEventListener("click", startRecording);
document.getElementById("stopRecordBtn")?.addEventListener("click", stopRecording);
