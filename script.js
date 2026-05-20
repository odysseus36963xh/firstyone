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
// AUDIO RECORDING
// ===============================
let audioContext = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let recordingStartTime = 0;
let recordingTimerInterval = null;

async function initializeRecorder() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

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

// ✅ FIXED: Save recording to active cell
function saveRecordingAsWebM() {
  if (!audioChunks.length) {
    alert("No audio recorded.");
    return;
  }

  const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
  const url = URL.createObjectURL(audioBlob);
  
  if (activeCell) {
    // Get existing media
    let mediaData = getCellMediaData(activeCell);
    
    // Add recording
    mediaData.push({
      url: url,
      type: "audio/webm",
      name: `recording_${getTimestamp()}.webm`
    });

    setCellMediaData(activeCell, mediaData);
    updateCellEmoji(activeCell, mediaData);
    
    // Green flash feedback
    const originalBg = activeCell.style.background || "";
    activeCell.style.transition = "background 0.3s";
    activeCell.style.background = "#90EE90";
    setTimeout(() => { activeCell.style.background = originalBg; }, 500);
    
    const status = document.getElementById("recordingStatus");
    status.textContent = "✅ Recording saved to cell!";
    status.style.background = "#27ae60";
    setTimeout(() => { status.style.display = "none"; }, 3000);

  } else {
    // Fallback: just download
    const a = document.createElement("a");
    a.href = url;
    a.download = `recording_${getTimestamp()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
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
// PAPERCLIP & MEDIA ATTACHMENT
// ===============================
document.body.insertAdjacentHTML('beforeend', `
  <input type="file" id="cellFileInput" accept="image/*,audio/*,video/*" style="display:none">
  <button id="floatingClip" contenteditable="false" title="Attach Media">📎</button>
  <div id="mediaPopup"></div>
`);

const floatingClip = document.getElementById("floatingClip");
const fileInput = document.getElementById("cellFileInput");
const sheetWrap = document.getElementById("sheetWrap");
let activeCell = null;

// Show paperclip when cell is focused
document.getElementById("sheet").addEventListener("focusin", (e) => {
    if (e.target.tagName === "TD") {
        activeCell = e.target;
        const rect = activeCell.getBoundingClientRect();
        floatingClip.style.display = "block";
        floatingClip.style.top = (window.scrollY + rect.top + 4) + "px";
        floatingClip.style.left = (window.scrollX + rect.right - 28) + "px";
    }
});

// Hide paperclip on scroll/click outside
sheetWrap.addEventListener("scroll", () => floatingClip.style.display = "none");
document.addEventListener("mousedown", (e) => {
    if (e.target !== floatingClip && e.target.tagName !== "TD") {
        floatingClip.style.display = "none";
    }
});

// Trigger file upload
floatingClip.addEventListener("mousedown", (e) => {
    e.preventDefault();
    if (activeCell) fileInput.click();
});

// Handle file attachment
fileInput.addEventListener("change", function(e) {
    const files = e.target.files;
    if (!files.length || !activeCell) return;

    // Get existing media
    let mediaData = getCellMediaData(activeCell);

    // Add each file
    for (const file of files) {
        mediaData.push({
            url: URL.createObjectURL(file),
            type: file.type,
            name: file.name
        });
    }

    // Save to cell
    setCellMediaData(activeCell, mediaData);
    updateCellEmoji(activeCell, mediaData);
    
    // Green flash
    const originalBg = activeCell.style.background || "";
    activeCell.style.transition = "background 0.3s";
    activeCell.style.background = "#90EE90";
    setTimeout(() => { activeCell.style.background = originalBg; }, 500);

    this.value = "";
    floatingClip.style.display = "none";
    placeCaretAtEnd(activeCell); // ✅ NOW DEFINED BELOW
});


// ===============================
// HELPER: CURSOR PLACEMENT (BUG FIX!)
// ===============================
function placeCaretAtEnd(el) {
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
}


// ===============================
// HELPER: MANAGE MEDIA DATA
// ===============================
function getCellMediaData(cell) {
    try {
        return JSON.parse(cell.dataset.mediaFiles || "[]");
    } catch (e) { return []; }
}

function setCellMediaData(cell, data) {
    cell.dataset.mediaFiles = JSON.stringify(data);
}


// ===============================
// HELPER: UPDATE EMOJI INDICATOR
// ===============================
function updateCellEmoji(cell, mediaData) {
    // Remove existing emojis
    cell.innerHTML = cell.innerHTML.replace(/🖼️|🎵|🎥|📷|📷🎵|📷🎥|\(\d+\)/g, "").trim();

    const hasImage = mediaData.some(f => 
        f.type.includes("image") || /jpg|jpeg|png|gif|webp|svg|bmp/i.test(f.name)
    );
    const hasAudio = mediaData.some(f => 
        f.type.includes("audio") || /mp3|wav|webm|ogg|m4a|aac/i.test(f.name)
    );
    const hasVideo = mediaData.some(f => 
        f.type.includes("video") || /mp4|mov|avi|mkv/i.test(f.name)
    );

    let emoji = "";
    if (hasImage && hasAudio) emoji = " 📷🎵";
    else if (hasImage && hasVideo) emoji = " 📷🎥";
    else if (hasImage) emoji = " 🖼️";
    else if (hasAudio) emoji = " 🎵";
    else if (hasVideo) emoji = " 🎥";
    
    if (mediaData.length > 1) emoji += ` (${mediaData.length})`;

    if (emoji) cell.innerHTML += emoji;
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
function clearHighlight() {
  document.querySelectorAll(".reading").forEach(c => c.classList.remove("reading"));
}

window.currentMediaElements = null;

function stopReading() {
  isReading = false;
  speechSynthesis.cancel();
  
  if (window.currentMediaElements) {
    window.currentMediaElements.forEach(el => { try { el.pause(); } catch(e) {} });
    window.currentMediaElements = null;
  }
  
  const popup = document.getElementById("mediaPopup");
  if (popup) popup.classList.remove("show");
  
  clearHighlight();
}


// ===============================
// MEDIA PLAYER (NO FREEZE)
// ===============================
function playCellMedia(cell) {
  return new Promise((resolve) => {
    const mediaData = getCellMediaData(cell);
    
    if (!mediaData.length) {
      return resolve({ hasAudio: false, hasImage: false }); 
    }

    const popup = document.getElementById("mediaPopup");
    
    // Separate by type
    const images = mediaData.filter(f => 
        f.type.includes("image") || /jpg|jpeg|png|gif|webp|svg|bmp/i.test(f.name)
    );
    const audios = mediaData.filter(f => 
        f.type.includes("audio") || /mp3|wav|webm|ogg|m4a|aac/i.test(f.name)
    );
    const videos = mediaData.filter(f => 
        f.type.includes("video") || /mp4|mov|avi|mkv/i.test(f.name)
    );

    // Show images in popup
    if (images.length > 0) {
        popup.innerHTML = images.map(img => 
            `<img src="${img.url}" style="max-width:100%;margin:4px 0;border-radius:8px;">`
        ).join('');
        popup.classList.add("show");
    }

    // ✅ Play audio in background (NO WAITING!)
    if (audios.length > 0) {
        const audioElements = audios.map(a => {
            const audio = new Audio(a.url);
            audio.volume = 0.8;
            audio.play().catch(err => console.log("Audio failed:", err));
            return audio;
        });
        window.currentMediaElements = audioElements;
    }

    // Show video in popup
    if (videos.length > 0) {
        popup.innerHTML = videos.map(v => 
            `<video src="${v.url}" controls style="max-width:100%;margin:4px 0;"></video>`
        ).join('');
        popup.classList.add("show");
    }

    // Resolve immediately - don't wait for audio!
    resolve({ hasAudio: audios.length > 0, hasImage: images.length > 0 });
  });
}


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
          const mediaData = getCellMediaData(cell);

          if (lang === "Off" && !mediaData.length) continue;

          for (let rc = 0; rc < repeatCell; rc++) {
            if (!isReading) return;
            cell.classList.add("reading");

            const mediaResult = await playCellMedia(cell);

            if (!isReading) return;

            // ✅ Strip emojis from TTS
            let cleanText = text.replace(/🖼️|🎵|🎥|📷|\(\d+\)/g, "").trim();
            if (cleanText) {
                await speak(cleanText, lang, speed);
            }

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
// EXPORT & SAVE
// ===============================
function getTimestamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

function exportTableData() {
  const table = document.getElementById("sheet");
  if (!table) return null;

  const colCount = 26;
  const cells = [];
  const languages = [];

  const selectorRow = table.rows[1];
  for (let c = 0; c < colCount; c++) {
    const cell = selectorRow?.cells[c + 1];
    const select = cell?.querySelector("select");
    languages.push(select?.value || "Off");
  }

  for (let r = 2; r < table.rows.length; r++) {
    const row = table.rows[r];
    const rowData = [];
    for (let c = 1; c <= colCount; c++) {
      rowData.push(row.cells[c]?.innerText?.trim() || "");
    }
    cells.push(rowData);
  }

  return { createdAt: new Date().toISOString(), columns: colCount, rows: table.rows.length - 2, cells, languages };
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
  box.innerHTML = `<h3 style="margin-top:0;">Save Table</h3><input id="fileName" style="width:100%;padding:8px" value="${defaultName}"><div style="margin-top:12px;display:flex;justify-content:flex-end;gap:8px;"><button id="cancel">Cancel</button><button id="save">Save</button></div>`;
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
// UPLOAD TABLE
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

        if (!data.cells || !data.languages) throw new Error("Missing 'cells' or 'languages'");

        const table = document.getElementById("sheet");
        if (!table) throw new Error("Table not found");

        while (table.rows.length > 2) table.deleteRow(2);

        const selectorRow = table.rows[1];
        for (let c = 0; c < data.languages.length; c++) {
          const cell = selectorRow.cells[c + 1];
          const select = cell?.querySelector("select");
          if (select) select.value = data.languages[c];
        }

        data.cells.forEach((rowArray) => {
          const newRow = table.insertRow();
          const numberCell = newRow.insertCell();
          numberCell.textContent = newRow.rowIndex - 1;
          numberCell.className = "row-number";

          rowArray.forEach((text) => {
            const td = newRow.insertCell();
            td.textContent = text || "";
            td.contentEditable = "true";
          });
        });

        if (typeof flash === "function") flash("Table uploaded ✓");
        else alert("Table uploaded successfully.");

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
// UPLOAD COLUMN
// ===============================
window.uploadColumn = function () {
  const rawText = document.getElementById("columnData").value.trim();
  if (!rawText) { alert("Please paste some text."); return; }

  const startCellInput = document.getElementById("startCellUpload").value.trim().toUpperCase();
  const direction = document.getElementById("uploadDirection").value;

  let startCol = 0, startRow = 0;

  if (startCellInput) {
    const match = startCellInput.match(/^([A-Z]+)(\d+)$/);
    if (!match) { alert("Invalid cell format. Use like A1, B5, or C12"); return; }
    startCol = match[1].charCodeAt(0) - 65;
    startRow = parseInt(match[2]) - 1;
  }

  const lines = rawText.split(/\r?\n/).map(x => x.trim()).filter(x => x !== "");

  const neededRows = direction === "down" ? startRow + lines.length : startRow + 1;
  const currentRows = sheetTable.rows.length - 2;
  if (neededRows > currentRows) addNewRows(neededRows - currentRows);

  for (let i = 0; i < lines.length; i++) {
    let rowIndex = startRow, colIndex = startCol;
    if (direction === "down") rowIndex += i;
    else colIndex += i;

    const row = sheetTable.rows[rowIndex + 2];
    if (!row) continue;
    const cell = row.cells[colIndex + 1];
    if (!cell) continue;
    cell.innerText = lines[i];
  }

  alert(`✅ Uploaded ${lines.length} item${lines.length === 1 ? '' : 's'}!`);
};


// ===============================
// EXTRACT RANGE
// ===============================
function extractRange(mode) {
  const table = document.getElementById("sheet");
  if (!table) { alert("Table not found."); return; }

  const start = parseCell(document.getElementById("extractStart").value.trim().toUpperCase());
  const end = parseCell(document.getElementById("extractEnd").value.trim().toUpperCase());

  if (!start || !end) { alert("Invalid cell format. Use like A1 or C5."); return; }

  const startRow = Math.min(start.row, end.row);
  const endRow = Math.max(start.row, end.row);
  const startCol = Math.min(start.col, end.col);
  const endCol = Math.max(start.col, end.col);

  let extracted = [];

  for (let r = startRow; r <= endRow; r++) {
    const tableRow = table.rows[r + 1];
    if (!tableRow) continue;
    let rowData = [];
    for (let c = startCol; c <= endCol; c++) {
      const cell = tableRow.cells[c + 1];
      if (!cell) continue;
      rowData.push(cell.innerText || "");
      if (mode === "remove") cell.innerText = "";
    }
    extracted.push(rowData.join("\t"));
  }

  if (mode === "copy") {
    navigator.clipboard.writeText(extracted.join("\n")).then(() => alert("✅ Range copied!")).catch(() => alert("Clipboard blocked."));
  } else if (mode === "remove") {
    alert("✅ Range cleared!");
  }
}


// ===============================
// FREQUENCY FINDER
// ===============================
document.getElementById("openFinder").addEventListener("click", () => {
  const newTab = window.open("", "_blank");
  if (!newTab) { alert("Allow pop-ups for Frequency Finder."); return; }

  newTab.document.write(`<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Frequency Finder</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;background:#0d0d0d;color:#e0e0e0;padding:24px;min-height:100vh;}h1{color:#5ea4ff;margin-bottom:6px;font-size:28px}.subtitle{color:#888;margin-bottom:18px;font-size:14px}textarea{width:100%;height:320px;padding:16px;font-size:15px;border-radius:10px;border:2px solid #222;background:#141414;color:#e0e0e0;resize:vertical;}.controls{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:14px;}.controls label{color:#aaa;font-size:14px}.controls input{padding:10px 12px;font-size:14px;border:none;border-radius:8px;background:#1a1a1a;color:#e0e0e0;}.controls input[type=number]{width:65px;text-align:center}button{background:linear-gradient(135deg,#2b7cff,#1a5ec2);color:#fff;border:none;padding:11px 22px;border-radius:10px;cursor:pointer;font-size:15px;font-weight:600;}.copy-btn{background:#1a1a1a;border:1px solid #333;color:#aaa;padding:9px 14px;font-size:13px;border-radius:8px;cursor:pointer;}.copy-btn:hover{background:#222;color:#fff;border-color:#5ea4ff}.stats{margin-top:18px;padding:12px 16px;background:#161616;border-radius:8px;font-size:13px;color:#999;display:none;}.stats span{color:#5ea4ff;font-weight:700}.table-wrap{margin-top:20px;max-height:60vh;overflow-y:auto;border-radius:10px;border:1px solid #222;display:none;}table{width:100%;border-collapse:collapse;background:#111}th{background:#1e1e1e;color:#5ea4ff;padding:14px 16px;text-align:left;font-size:14px;border-bottom:2px solid #333;}td{padding:10px 16px;border-bottom:1px solid #1a1a1a;font-size:14px;}tr:hover td{background:#1a2233}.bar-cell{position:relative}.bar{position:absolute;left:0;top:0;bottom:0;background:#2b7cff15;border-radius:3px;pointer-events:none;transition:width .4s;}.bar-text{position:relative;z-index:1}</style></head>
<body><h1>🔍 Frequency Finder</h1><div class="subtitle">Paste any text — Bible, Quran, Bhagavad Gita, poems. Case ignored.</div>
<textarea id="textInput" placeholder="Paste your text here…"></textarea>
<div class="controls"><label>Combo:</label><input id="comboSize" type="number" min="1" max="12" value="1"><button id="findBtn">Find Frequency</button><input id="filterInput" type="text" placeholder="Filter…"><button id="copyWords" class="copy-btn">Copy Words</button><button id="copyCounts" class="copy-btn">Copy Counts</button><button id="copyPcts" class="copy-btn">Copy %</button></div>
<div class="stats" id="stats"></div>
<div class="table-wrap" id="tableWrap"><table><thead><tr><th>Word</th><th>Count</th><th>%</th></tr></thead><tbody id="tbody"></tbody></table></div>
<script>(function(){"use strict";function nt(t){t=t.normalize("NFKC");t=t.replace(/\\p{N}/gu," ");t=t.toLocaleLowerCase();t=t.replace(/[\\p{P}\\p{S}\\p{C}]/gu," ");return t.replace(/\\s+/g," ").trim();}function tk(t){var m=t.match(/\\p{L}+/gu);return m?m:[];}function ng(w,n){if(n<1)n=1;var o=[];for(var i=0;i<=w.length-n;i++)o.push(w.slice(i,i+n).join(" "));return o;}function eh(s){return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}var fb=document.getElementById("findBtn"),ti=document.getElementById("textInput"),ci=document.getElementById("comboSize"),fi=document.getElementById("filterInput"),tb=document.getElementById("tbody"),tw=document.getElementById("tableWrap"),sd=document.getElementById("stats"),ar=[],cd=[];function rt(d){cd=d;var mc=d.length?d[0].count:1,h="",l=Math.min(d.length,5000);for(var i=0;i<l;i++){var v=d[i],p=v.pct.toFixed(4),b=((v.count/mc)*100).toFixed(2);h+='<tr><td>'+eh(v.word)+'</td><td>'+v.count.toLocaleString()+'</td><td class="bar-cell"><div class="bar" style="width:'+b+'%"></div><span class="bar-text">'+p+'%</span></td></tr>';}if(d.length>l)h+='<tr><td colspan="3" style="text-align:center;padding:20px;color:#555">Showing top '+l+' of '+d.length+'</td></tr>';if(!d.length)h='<tr><td colspan="3" style="text-align:center;padding:40px;color:#555">No results.</td></tr>';tb.innerHTML=h;}fb.addEventListener("click",function(){var r=ti.value;if(!r.trim()){alert("Paste some text first.");return;}fb.disabled=true;fb.textContent="Processing…";setTimeout(function(){var n=parseInt(ci.value,10)||1;if(n<1)n=1;if(n>12)n=12;ci.value=n;var c=nt(r),w=tk(c);if(!w.length){alert("No words found.");fb.disabled=false;fb.textContent="Find Frequency";return;}var u=ng(w,n),f=Object.create(null);for(var i=0;i<u.length;i++)f[u[i]]=(f[u[i]]||0)+1;var t=u.length,s=Object.keys(f).map(function(k){return{word:k,count:f[k],pct:(f[k]/t)*100};}).sort(function(a,b){return b.count-a.count;});ar=s;sd.style.display="block";sd.innerHTML='Tokens: <span>'+t.toLocaleString()+'</span> | Unique: <span>'+s.length.toLocaleString()+'</span>';rt(s);tw.style.display="block";fb.disabled=false;fb.textContent="Find Frequency";},50);});fi.addEventListener("input",function(){var q=this.value.toLocaleLowerCase().trim();if(!q){rt(ar);return;}rt(ar.filter(function(d){return d.word.indexOf(q)!==-1;}));});function sc(id,fn){document.getElementById(id).addEventListener("click",function(){if(!cd.length)return;var t=cd.map(fn).join("\\n");navigator.clipboard.writeText(t).then(function(){var b=this,og=b.textContent;b.textContent="Copied!";setTimeout(function(){b.textContent=og;},1400);}).catch(function(){var ta=document.createElement("textarea");ta.value=t;ta.style.cssText="position:fixed;opacity:0";document.body.appendChild(ta);ta.select();document.execCommand("copy");document.body.removeChild(ta);var b=this,og=b.textContent;b.textContent="Copied!";setTimeout(function(){b.textContent=og;},1400);});});}sc("copyWords",function(d){return d.word;});sc("copyCounts",function(d){return d.count;});sc("copyPcts",function(d){return d.pct.toFixed(4)+"%";});})();</script></body></html>`);
  newTab.document.close();
});


// ===============================
// RECORDER BUTTON EVENTS
// ===============================
document.getElementById("recordBtn")?.addEventListener("click", startRecording);
document.getElementById("stopRecordBtn")?.addEventListener("click", stopRecording);
