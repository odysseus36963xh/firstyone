// ===============================
// GLOBAL STATE
// ===============================
let isReading = false;
let voices = [];

function loadVoices() {
  voices = speechSynthesis.getVoices() || [];
  updateLanguageDropdowns();
}

if ("speechSynthesis" in window) {
  speechSynthesis.onvoiceschanged = loadVoices;

  // Some browsers load voices late, so call a few times
  loadVoices();
  setTimeout(loadVoices, 250);
  setTimeout(loadVoices, 1000);
}


// ===============================
// HELPER: Blob <-> Base64
// ===============================
// Converts Blob to Base64 string (for saving)
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// Converts Base64 string back to Blob (for loading)
function base64ToBlob(dataUrl) {
    const parts = dataUrl.split(';base64,');
    const mimeType = parts[0].split(':')[1];
    const rawBase64 = parts[1];
    const byteCharacters = atob(rawBase64);
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += 1024) {
        const slice = byteCharacters.slice(offset, offset + 1024);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }
        byteArrays.push(new Uint8Array(byteNumbers));
    }
    return new Blob(byteArrays, { type: mimeType });
}





// ===============================
// AUDIO RECORDING (Force WebM + Recognize OGX)
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

    // FORCE WebM format - if not supported, fallback to whatever browser wants
    const options = { mimeType: 'audio/webm;codecs=opus' };
    const supported = MediaRecorder.isTypeSupported(options.mimeType);
    
    mediaRecorder = new MediaRecorder(stream, supported ? options : {});
    audioChunks = [];

    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
      saveRecording();
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

function saveRecording() {
  if (!audioChunks.length) {
    alert("No audio recorded.");
    return;
  }

  // Use ACTUAL mime type from the recorder (might be audio/ogg on Firefox)
  const actualMimeType = audioChunks[0].type || 'audio/webm';
  const extension = actualMimeType.includes('ogg') ? 'ogg' : 'webm';
  
  const audioBlob = new Blob(audioChunks, { type: actualMimeType });
  const url = URL.createObjectURL(audioBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `recording_${getTimestamp()}.${extension}`;
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
// ===============================
// VOICE SELECTION - ALL BROWSER LANGUAGES
// ===============================

const LEGACY_LANG_MAP = {
  EN: "en",
  IT: "it",
  ES: "es",
  FR: "fr",
  DE: "de"
};

function normalizeLang(code) {
  return code?.trim().replace("_", "-").toLowerCase();
}

function getVoice(langCode) {
  if (!voices.length) {
    voices = speechSynthesis.getVoices() || [];
  }

  const mappedCode = LEGACY_LANG_MAP[langCode] || langCode;
  const wanted = normalizeLang(mappedCode);

  if (!wanted || wanted === "off") return null;

  // Exact match first, e.g. "en-US"
  let voice = voices.find(v => normalizeLang(v.lang) === wanted);
  if (voice) return voice;

  // Base-language match, e.g. "en" matches "en-US" or "en-GB"
  const baseLang = wanted.split("-")[0];

  return voices.find(v => {
    const voiceLang = normalizeLang(v.lang);
    return voiceLang?.split("-")[0] === baseLang;
  }) || null;
}

function getBrowserLanguages() {
  const unique = new Map();

  voices.forEach(v => {
    if (!v.lang) return;

    const key = normalizeLang(v.lang);
    if (!unique.has(key)) {
      unique.set(key, v.lang);
    }
  });

  return [...unique.values()].sort((a, b) => a.localeCompare(b));
}

function getLanguageLabel(lang) {
  try {
    const parts = lang.split("-");
    const languageCode = parts[0];
    const regionCode = parts[1];

    const languageNames = new Intl.DisplayNames([navigator.language || "en"], {
      type: "language"
    });

    const regionNames = new Intl.DisplayNames([navigator.language || "en"], {
      type: "region"
    });

    const languageName = languageNames.of(languageCode) || languageCode;
    const regionName = regionCode ? regionNames.of(regionCode) : "";

    return regionName
      ? `${languageName} (${regionName}) — ${lang}`
      : `${languageName} — ${lang}`;
  } catch {
    return lang;
  }
}

function updateLanguageDropdowns() {
  const table = document.getElementById("sheet");
  if (!table) return;

  const selectorRow = table.rows[1];
  if (!selectorRow) return;

  const langs = getBrowserLanguages();

  // Do not wipe existing dropdowns before voices are loaded
  if (!langs.length) return;

  for (let c = 1; c < selectorRow.cells.length; c++) {
    const select = selectorRow.cells[c]?.querySelector("select");
    if (!select) continue;

    const currentValue = select.value || "Off";

    select.innerHTML = "";

    const offOption = document.createElement("option");
    offOption.value = "Off";
    offOption.textContent = "Off";
    select.appendChild(offOption);

    langs.forEach(lang => {
      const option = document.createElement("option");
      option.value = lang;
      option.textContent = getLanguageLabel(lang);
      select.appendChild(option);
    });

    // Preserve current selection if possible
    if (currentValue === "Off") {
      select.value = "Off";
      continue;
    }

    const mappedCurrent = LEGACY_LANG_MAP[currentValue] || currentValue;
    const normalizedCurrent = normalizeLang(mappedCurrent);
    const currentBase = normalizedCurrent?.split("-")[0];

    const exactMatch = langs.find(l => normalizeLang(l) === normalizedCurrent);
    const baseMatch = langs.find(l => normalizeLang(l).split("-")[0] === currentBase);

    select.value = exactMatch || baseMatch || "Off";
  }
}














// ===============================
// PAPERCLIP & MEDIA ATTACHMENT
// ===============================

// ===============================
// PAPERCLIP & MEDIA ATTACHMENT (MULTI-FILE SUPPORT)
// ===============================

document.body.insertAdjacentHTML('beforeend', `
  <input type="file" id="cellFileInput" accept="image/jpeg, image/jpg, image/png, image/gif, image/webp, audio/mp3, audio/mpeg, audio/webm, audio/wav, audio/ogg, video/webm, video/mp4" style="display:none">
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

// Handle file attachment (SUPER RELIABLE EMOJI FIX)
fileInput.addEventListener("change", function(e) {
    const file = e.target.files[0];
    if (!file || !activeCell) return;

    // Get existing attachments
    let mediaUrls = [];
    let mediaTypes = [];
    
    if (activeCell.dataset.mediaUrls) {
        try {
            mediaUrls = JSON.parse(activeCell.dataset.mediaUrls);
            mediaTypes = JSON.parse(activeCell.dataset.mediaTypes);
        } catch(e) {
            mediaUrls = [];
            mediaTypes = [];
        }
    }

    // Add new file
    const fileUrl = URL.createObjectURL(file);
    mediaUrls.push(fileUrl);
    mediaTypes.push(file.type);

    // Save arrays to dataset
    activeCell.dataset.mediaUrls = JSON.stringify(mediaUrls);
    activeCell.dataset.mediaTypes = JSON.stringify(mediaTypes);

    // ==== EMOJI FIX: Works 100% of the time ====
    const emojiMap = {
        'image': '🖼️',
        'audio': '🎵',
        'video': '🎥'
    };
    
    // Get file extension (SUPER RELIABLE)
    const ext = file.name.split('.').pop().toLowerCase();
    let typePrefix = file.type.split('/')[0];
    
    // If MIME type is missing or unknown, use extension
    if (!emojiMap[typePrefix]) {
        if (['mp3', 'wav', 'webm', 'ogg', 'ogx', 'm4a', 'aac', 'flac'].includes(ext)) {
            typePrefix = 'audio';
        } else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
            typePrefix = 'image';
        } else if (['mp4', 'mov', 'avi', 'mkv'].includes(ext)) {
            typePrefix = 'video';
        }
    }
    
    // FORCE ADD EMOJI if not present
    const emoji = emojiMap[typePrefix];
    if (emoji && !activeCell.innerHTML.includes(emoji)) {
        activeCell.appendChild(document.createTextNode(` ${emoji}`));
    }
    
    this.value = ""; 
    floatingClip.style.display = "none"; 
    placeCaretAtEnd(activeCell); 
});



// ===============================
// SPEAK FUNCTION
// ===============================
function speak(text, lang, rate) {
  return new Promise(resolve => {
    if (!text || !text.trim()) return resolve();

    const utter = new SpeechSynthesisUtterance(text);
    const voice = getVoice(lang);

    if (voice) {
      utter.voice = voice;
      utter.lang = voice.lang;
    } else if (lang && lang !== "Off") {
      utter.lang = LEGACY_LANG_MAP[lang] || lang;
    }

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
  
  // Stop ALL media elements (plural!)
  if (window.currentMediaElements) {
    window.currentMediaElements.forEach(el => {
        try { el.pause(); } catch(e) {}
    });
    window.currentMediaElements = null;
  }
  
  const popup = document.getElementById("mediaPopup");
  if (popup) popup.classList.remove("show");
  
  clearHighlight();
}

// ===============================
// MEDIA PLAYER
// ===============================
// ===============================
// MEDIA PLAYER (MULTI-FILE + NO FREEZE)
// ===============================
function playCellMedia(cell) {
  return new Promise((resolve) => {
    const mediaUrls = cell.dataset.mediaUrls ? JSON.parse(cell.dataset.mediaUrls) : [];
    const mediaTypes = cell.dataset.mediaTypes ? JSON.parse(cell.dataset.mediaTypes) : [];
    const popup = document.getElementById("mediaPopup");

    // Safety timeout (30 seconds max per cell)
    const timeoutId = setTimeout(() => {
      console.warn("Media playback timeout - moving on");
      if (window.currentMediaElements) {
        window.currentMediaElements.forEach(el => el.pause());
        window.currentMediaElements = null;
      }
      popup.classList.remove("show");
      resolve({hasAudio: false, hasImage: false});
    }, 30000);

    if (!popup || mediaUrls.length === 0) {
      clearTimeout(timeoutId);
      return resolve({hasAudio: false, hasImage: false});
    }

    // Separate media by type
    const images = [];
    const audios = [];
    const videos = [];
    
    mediaTypes.forEach((type, i) => {
        if (type.startsWith('image')) images.push(mediaUrls[i]);
        else if (type.startsWith('audio')) audios.push(mediaUrls[i]);
        else if (type.startsWith('video')) videos.push(mediaUrls[i]);
    });

    // Build popup with images/videos (visible)
    let popupHTML = '';
    images.forEach(url => popupHTML += `<img src="${url}" style="max-width:100%;margin:2px 0;">`);
    videos.forEach(url => popupHTML += `<video src="${url}" controls style="max-width:100%;margin:2px 0;"></video>`);
    
    popup.innerHTML = popupHTML;
    if (images.length > 0 || videos.length > 0) {
        popup.classList.add("show");
    }

    // Handle audio playback (invisible, background)
    const audioElements = audios.map(url => {
        const audio = new Audio(url);
        audio.style.cssText = "position:absolute;opacity:0;pointer-events:none;";
        return audio;
    });

    // If no audio, resolve quickly
    if (audioElements.length === 0) {
        setTimeout(() => {
            clearTimeout(timeoutId);
            resolve({hasAudio: false, hasImage: images.length > 0});
        }, 100);
        return;
    }

    // Play audio and wait for completion
    window.currentMediaElements = audioElements;
    let audioCompleted = 0;

    audioElements.forEach(audio => {
        audio.onended = () => {
            audioCompleted++;
            if (audioCompleted === audioElements.length) complete();
        };
        
        audio.onerror = () => {
            audioCompleted++;
            if (audioCompleted === audioElements.length) complete();
        };
    });

    function complete() {
        clearTimeout(timeoutId);
        popup.classList.remove("show");
        window.currentMediaElements = null;
        resolve({hasAudio: true, hasImage: images.length > 0});
    }

    // Start playing all audio files
    audioElements.forEach(audio => {
        audio.play().catch(err => {
            console.error("Audio play failed:", err);
            audio.onerror();
        });
    });
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
          const hasMedia = cell.dataset.mediaUrls && JSON.parse(cell.dataset.mediaUrls).length > 0;

          // Skip if language is Off, OR if there's no text AND no media attached
          if (lang === "Off" || (!text.trim() && !hasMedia)) continue;

          for (let rc = 0; rc < repeatCell; rc++) {
            if (!isReading) return;
            cell.classList.add("reading");
              // 1. Play media (image popup or audio/video playback)
            const mediaResult = await playCellMedia(cell);

if (!isReading) return; // Check again in case user clicked Stop during media

// 2. Read text via TTS (Only if there was no audio played)
if (!mediaResult.hasAudio) {
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

// ===============================
// EXPORT & SAVE (with Media)
// ===============================
async function exportTableData() { // <-- Now async
    const table = document.getElementById("sheet");
    if (!table) return null;

    const dataRows = table.rows.length - 2;
    const colCount = 26;
    const cells = [];
    const languages = [];
    const media = {}; // NEW: Stores media data

    // Get language settings
    const selectorRow = table.rows[1];
    for (let c = 0; c < colCount; c++) {
        const cell = selectorRow?.cells[c + 1];
        const select = cell?.querySelector("select");
        languages.push(select?.value || "Off");
    }

    // Process cells and media
    for (let r = 2; r < table.rows.length; r++) {
        const row = table.rows[r];
        const rowData = [];
        for (let c = 1; c <= colCount; c++) {
            const cell = row.cells[c];
            const text = cell?.innerText?.trim() || "";
            rowData.push(text);

            // Save media if present
            if (cell.dataset.mediaUrls && cell.dataset.mediaTypes) {
                try {
                    const urls = JSON.parse(cell.dataset.mediaUrls);
                    const types = JSON.parse(cell.dataset.mediaTypes);
                    if (urls.length > 0) {
                        const cellKey = `${r-2}-${c-1}`; // Use 0-based indices
                        media[cellKey] = { urls: [], types: types };
                        
                        // Convert each media file to Base64
                        for (let i = 0; i < urls.length; i++) {
                            const response = await fetch(urls[i]);
                            const blob = await response.blob();
                            const base64 = await blobToBase64(blob);
                            media[cellKey].urls.push(base64);
                        }
                    }
                } catch (err) {
                    console.error("Media export failed for cell", r, c, err);
                }
            }
        }
        cells.push(rowData);
    }

    return {
        createdAt: new Date().toISOString(),
        columns: colCount,
        rows: dataRows,
        cells,
        languages,
        media // <-- NEW
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

// ===============================
// SAVE TABLE (with Media + Custom Filename)
// ===============================
async function saveTable() {
    const defaultName = `language-table_${getTimestamp()}.json`;
    
    // First, ask for filename
    openSaveDialog(defaultName, async (finalName) => { // <-- Make callback async
        const data = await exportTableData();
        if (!data) return;

        // Warn if file is huge
        const jsonString = JSON.stringify(data, null, 2);
        const sizeMB = (new Blob([jsonString]).size / 1024 / 1024).toFixed(2);
        if (sizeMB > 10) {
            if (!confirm(`Warning: Save file is ${sizeMB}MB. Continue?`)) return;
        }

        downloadJSON(finalName.endsWith(".json") ? finalName : finalName + ".json", data);
    });
}
// ===============================
// UPLOAD TABLE (harmonised)
// ===============================
// ===============================
// UPLOAD TABLE (harmonised) - FIXED
// ===============================
// ===============================
// UPLOAD TABLE (with Media)
// ===============================
function uploadTable() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";

    input.onchange = function () {
        const file = input.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async function (e) { // <-- Now async
            try {
                const data = JSON.parse(e.target.result);

                if (!data.cells || !data.languages) {
                    throw new Error("Missing 'cells' or 'languages'");
                }

                const table = document.getElementById("sheet");
                if (!table) throw new Error("Table not found");

                // Clear existing rows
                while (table.rows.length > 2) {
                    table.deleteRow(2);
                }

                // Restore languages
                const selectorRow = table.rows[1];
                for (let c = 0; c < data.languages.length; c++) {
                    const cell = selectorRow.cells[c + 1];
                    const select = cell?.querySelector("select");
                    if (select) select.value = data.languages[c];
                }

                // Rebuild cells and restore media
                for (let r = 0; r < data.cells.length; r++) {
                    const rowArray = data.cells[r];
                    const newRow = table.insertRow();
                    const numberCell = newRow.insertCell();
                    numberCell.textContent = newRow.rowIndex - 1;
                    numberCell.className = "row-number";

                    for (let c = 0; c < rowArray.length; c++) {
                        const td = newRow.insertCell();
                        td.textContent = rowArray[c] || "";
                        td.contentEditable = "true";

                        // Restore media if exists
                        const cellKey = `${r}-${c}`;
                        if (data.media && data.media[cellKey]) {
                            const mediaInfo = data.media[cellKey];
                            const urls = [];
                            
                            // Convert Base64 back to blobs and URLs
                            for (let i = 0; i < mediaInfo.urls.length; i++) {
                                const base64 = mediaInfo.urls[i];
                                const blob = base64ToBlob(base64);
                                const url = URL.createObjectURL(blob);
                                urls.push(url);
                            }

                            td.dataset.mediaUrls = JSON.stringify(urls);
                            td.dataset.mediaTypes = JSON.stringify(mediaInfo.types);

                            // Restore emojis
                            const emojiMap = {
                                'image': '🖼️',
                                'audio': '🎵',
                                'video': '🎥'
                            };
                            const uniqueTypes = [...new Set(mediaInfo.types)];
                            uniqueTypes.forEach(type => {
                                const prefix = type.split('/')[0];
                                const emoji = emojiMap[prefix];
                                if (emoji && !td.innerHTML.includes(emoji)) {
                                    td.appendChild(document.createTextNode(` ${emoji}`));
                                }
                            });
                        }
                    }
                }

                alert("✅ Table and media uploaded successfully!");

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



document.getElementById("openTabler").addEventListener("click", function () {
  var w = window.open("", "_blank");
  if (!w) {
    alert("Allow pop-ups for this site to open Tabler.");
    return;
  }

  w.document.write(
    '<!DOCTYPE html><html lang="en"><head>' +
    '<meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1.0">' +
    "<title>Tabler</title>" +
    "<style>" +
    /* ── RESET ── */
    "*{box-sizing:border-box;margin:0;padding:0}" +

    /* ── BASE ── */
    "html,body{" +
      "width:100%;height:100%;" +
      "background:#0e0e10;color:#e0e0e0;" +
      "font-family:'Segoe UI','Helvetica Neue',sans-serif;" +
      "overflow:hidden;" +
    "}" +

    /* ── HEADER ── */
    ".hdr{" +
      "display:flex;align-items:stretch;gap:10px;" +
      "padding:10px 16px;background:#141416;" +
      "border-bottom:1px solid #2a2a2e;flex-wrap:wrap;" +
    "}" +
    ".hdr-brand{" +
      "display:flex;flex-direction:column;align-items:center;" +
      "justify-content:center;padding-right:14px;" +
      "border-right:1px solid #2a2a2e;min-width:90px;" +
    "}" +
    ".hdr-brand h1{" +
      "font-size:20px;font-weight:700;letter-spacing:3px;" +
      "color:#34ce57;text-transform:uppercase;" +
      "text-shadow:0 0 18px rgba(52,206,87,.25);" +
    "}" +
    ".hdr-brand .sub{" +
      "font-size:9px;color:#666;letter-spacing:1px;margin-top:2px;" +
    "}" +

    /* ── NAV BUTTONS ── */
    ".hdr-nav{" +
      "display:flex;align-items:center;gap:6px;" +
      "padding:0 10px;border-right:1px solid #2a2a2e;" +
    "}" +
    ".nbtn{" +
      "background:#1a1a2e;border:1px solid #2a2a3e;color:#ccc;" +
      "padding:7px 14px;border-radius:4px;font-size:11px;" +
      "font-weight:600;letter-spacing:1px;text-transform:uppercase;" +
      "cursor:pointer;transition:all .2s;white-space:nowrap;" +
    "}" +
    ".nbtn:hover{background:#2a2a3e;border-color:#444;}" +
    ".nbtn.on{" +
      "background:#34ce57;color:#111;border-color:#34ce57;" +
      "box-shadow:0 0 10px rgba(52,206,87,.3);" +
    "}" +

    /* ── FIELD GROUPS ── */
    ".hdr-fields{display:flex;gap:14px;flex:1;align-items:stretch;min-width:0;}" +
    ".fg{display:flex;flex-direction:column;gap:5px;flex:1;min-width:200px;}" +
    ".fg-label{" +
      "font-size:9px;font-weight:700;letter-spacing:2px;" +
      "text-transform:uppercase;color:#666;" +
    "}" +
    ".fg-row{display:flex;gap:6px;flex:1;align-items:stretch;}" +
    ".fg-ta{" +
      "flex:1;background:#1a1a2e;border:1px solid #2a2a3e;" +
      "border-radius:4px;color:#e0e0e0;" +
      "font-family:Consolas,'Fira Code',monospace;font-size:12px;" +
      "padding:7px 9px;resize:none;outline:none;min-height:44px;" +
      "transition:border-color .2s;" +
    "}" +
    ".fg-ta:focus{border-color:#34ce57;box-shadow:0 0 6px rgba(52,206,87,.2);}" +
    ".fg-btn{" +
      "background:#1a1a2e;border:1px solid #2a2a3e;color:#34ce57;" +
      "padding:0 16px;border-radius:4px;font-size:10px;" +
      "font-weight:700;letter-spacing:1.5px;text-transform:uppercase;" +
      "cursor:pointer;transition:all .2s;white-space:nowrap;" +
      "align-self:flex-end;" +
    "}" +
    ".fg-btn:hover{background:#34ce57;color:#111;box-shadow:0 0 12px rgba(52,206,87,.3);}" +
    ".fg-btn.sk{color:#6ecfff;border-color:#1a3a5a;}" +
    ".fg-btn.sk:hover{background:#6ecfff;color:#111;}" +

    /* ── ACTIONS ── */
    ".hdr-acts{" +
      "display:flex;align-items:center;gap:6px;" +
      "padding-left:10px;border-left:1px solid #2a2a2e;" +
    "}" +

    /* ── UNFOUND BAR ── */
    ".ubar{" +
      "display:none;background:#1a1200;border-bottom:1px solid #3a2a00;" +
      "padding:7px 16px;font-size:11px;color:#ffaa00;" +
      "align-items:flex-start;gap:10px;" +
    "}" +
    ".ubar.v{display:flex;}" +
    ".ubar strong{white-space:nowrap;flex-shrink:0;}" +
    ".uw{display:flex;flex-wrap:wrap;gap:5px;}" +
    ".uwi{" +
      "background:rgba(255,170,0,.12);border:1px solid rgba(255,170,0,.25);" +
      "padding:1px 7px;border-radius:3px;font-family:monospace;font-size:10px;" +
    "}" +

    /* ── SHEET CONTAINER ── */
    ".sc{" +
      "width:100%;height:calc(100vh - 112px);overflow:auto;" +
      "background:#f5f5f5;" +
    "}" +
    ".sc.wu{height:calc(100vh - 140px);}" +

    /* ── SHEET TABLE ── */
    "table.st{border-collapse:collapse;width:max-content;min-width:100%;}" +
    "table.st tr{border-bottom:1px solid #e0e0e0;}" +
    "table.st td{" +
      "background:#ffffff;color:#111;" +
      "padding:5px 11px;" +
      "font-family:Consolas,'Fira Code',monospace;font-size:12.5px;" +
      "border-right:1px solid #f0f0f0;" +
      "cursor:pointer;transition:background .12s,box-shadow .12s;" +
      "white-space:nowrap;user-select:none;min-width:36px;text-align:center;" +
    "}" +
    "table.st td:first-child{" +
      "position:sticky;left:0;z-index:2;" +
      "background:#f0f0f0;color:#999;font-size:10px;font-weight:600;" +
      "min-width:40px;border-right:2px solid #ddd;" +
    "}" +
    "table.st td.hl{" +
      "background:rgba(52,206,87,.16)!important;" +
      "color:#0a7a2a!important;font-weight:700;" +
      "box-shadow:inset 0 0 0 2px #34ce57;z-index:1;" +
    "}" +
    "table.st td.sel{" +
      "background:#34ce57!important;color:#fff!important;" +
      "font-weight:800;box-shadow:0 0 10px rgba(52,206,87,.5);z-index:3;" +
    "}" +

    /* ── EMPTY STATE ── */
    ".es{" +
      "display:flex;flex-direction:column;align-items:center;" +
      "justify-content:center;height:100%;color:#999;gap:10px;" +
    "}" +
    ".es .ic{font-size:44px;opacity:.25;}" +
    ".es p{font-size:13px;letter-spacing:.5px;}" +
    ".es .ht{font-size:10px;opacity:.4;}" +

    /* ── POPUP ── */
    ".po{" +
      "display:none;position:fixed;inset:0;background:rgba(0,0,0,.65);" +
      "z-index:1000;align-items:center;justify-content:center;" +
    "}" +
    ".po.v{display:flex;}" +
    ".pb{" +
      "background:#1a1a1e;border:1px solid #2a2a2e;border-radius:10px;" +
      "padding:24px 28px;min-width:320px;max-width:90vw;" +
      "box-shadow:0 16px 50px rgba(0,0,0,.6);" +
    "}" +
    ".pb h3{" +
      "font-size:13px;font-weight:700;letter-spacing:2px;" +
      "text-transform:uppercase;color:#34ce57;margin-bottom:14px;" +
    "}" +
    ".pi{" +
      "width:100%;background:#141416;border:1px solid #2a2a2e;" +
      "border-radius:4px;color:#e0e0e0;font-family:Consolas,monospace;" +
      "font-size:13px;padding:9px 12px;outline:none;margin-bottom:16px;" +
    "}" +
    ".pi:focus{border-color:#34ce57;}" +
    ".pa{display:flex;gap:8px;justify-content:flex-end;}" +
    ".pbtn{" +
      "background:#1a1a2e;border:1px solid #2a2a3e;color:#ccc;" +
      "padding:7px 18px;border-radius:4px;font-size:11px;" +
      "font-weight:600;letter-spacing:1px;text-transform:uppercase;" +
      "cursor:pointer;transition:all .2s;" +
    "}" +
    ".pbtn:hover{background:#2a2a3e;}" +
    ".pbtn.ok{background:#34ce57;color:#111;border-color:#34ce57;}" +
    ".pbtn.ok:hover{box-shadow:0 0 12px rgba(52,206,87,.3);}" +
    ".pbtn.cn{color:#777;}" +

    /* ── READER OVERLAY ── */
    ".ro{" +
      "display:none;position:fixed;inset:0;background:rgba(0,0,0,.88);" +
      "z-index:900;flex-direction:column;" +
    "}" +
    ".ro.v{display:flex;}" +
    ".rhdr{" +
      "display:flex;align-items:center;justify-content:space-between;" +
      "padding:12px 20px;background:#141416;" +
      "border-bottom:1px solid #2a2a2e;gap:12px;flex-wrap:wrap;" +
    "}" +
    ".rhdr h2{" +
      "font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#34ce57;" +
    "}" +
    ".rctrls{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}" +
    ".rctrls label{font-size:10px;color:#888;letter-spacing:1px;text-transform:uppercase;}" +
    ".rctrls select,.rctrls input[type=number]{" +
      "background:#1a1a2e;border:1px solid #2a2a3e;color:#e0e0e0;" +
      "border-radius:3px;padding:4px 7px;font-size:11px;outline:none;" +
    "}" +
    ".rctrls input[type=range]{" +
      "width:80px;accent-color:#34ce57;" +
    "}" +
    ".rctrls input[type=number]{width:52px;}" +
    ".rbtn{" +
      "background:#1a1a2e;border:1px solid #2a2a3e;color:#34ce57;" +
      "padding:6px 14px;border-radius:4px;font-size:11px;font-weight:700;" +
      "letter-spacing:1px;text-transform:uppercase;cursor:pointer;" +
      "transition:all .2s;" +
    "}" +
    ".rbtn:hover{background:#34ce57;color:#111;}" +
    ".rbtn.stop{color:#e05555;border-color:#4a1a1a;}" +
    ".rbtn.stop:hover{background:#e05555;color:#fff;}" +
    ".rclose{" +
      "background:0;border:1px solid #2a2a3e;color:#777;" +
      "width:30px;height:30px;border-radius:50%;font-size:15px;" +
      "cursor:pointer;transition:all .2s;display:flex;" +
      "align-items:center;justify-content:center;" +
    "}" +
    ".rclose:hover{border-color:#e05555;color:#e05555;}" +

    /* ── READER BODY ── */
    ".rbody{flex:1;overflow-y:auto;padding:32px;display:flex;justify-content:center;}" +
    ".rcont{" +
      "max-width:680px;width:100%;color:#e0e0e0;" +
      "font-family:Georgia,'Times New Roman',serif;" +
      "font-size:18px;line-height:1.85;" +
    "}" +
    ".rsent{" +
      "display:block;padding:5px 8px;margin-bottom:4px;" +
      "border-radius:4px;cursor:pointer;transition:background .2s;" +
      "border-bottom:1px solid rgba(255,255,255,.03);" +
    "}" +
    ".rsent:hover{background:rgba(52,206,87,.04);}" +
    ".rsent.rs-reading{" +
      "background:rgba(52,206,87,.1);border-left:3px solid #34ce57;" +
    "}" +
    ".rw{" +
      "cursor:pointer;transition:color .12s,background .12s;" +
      "border-radius:2px;padding:1px 2px;" +
    "}" +
    ".rw:hover{background:rgba(52,206,87,.12);color:#34ce57;}" +
    ".rw.rhl{" +
      "background:rgba(52,206,87,.16);color:#34ce57;" +
      "font-weight:700;box-shadow:inset 0 -2px 0 #34ce57;" +
    "}" +
    ".rw.ractive{" +
      "background:#34ce57;color:#fff;font-weight:800;" +
      "box-shadow:0 0 8px rgba(52,206,87,.5);" +
    "}" +

    /* ── SCROLLBARS ── */
    "::-webkit-scrollbar{width:8px;height:8px;}" +
    "::-webkit-scrollbar-track{background:#f1f1f1;}" +
    "::-webkit-scrollbar-thumb{background:#c1c1c1;border-radius:20px;}" +
    "::-webkit-scrollbar-thumb:hover{background:#a8a8a8;}" +
    ".rbody::-webkit-scrollbar-track{background:#1a1a1e;}" +
    ".rbody::-webkit-scrollbar-thumb{background:#444;}" +

    /* ── ANIMATION ── */
    "@keyframes fi{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:scale(1)}}" +
    ".fi{animation:fi .22s ease}" +

    "</style></head><body>" +

    /* ═══════════════════════════════════════════
       HEADER
       ═══════════════════════════════════════════ */
    '<div class="hdr">' +

      '<div class="hdr-brand">' +
        "<h1>Tabler</h1>" +
        '<span class="sub">text study engine</span>' +
      "</div>" +

      '<div class="hdr-nav">' +
        '<button class="nbtn on" id="btnTabler" onclick="switchMode(\'t\')">Tabler</button>' +
        '<button class="nbtn" id="btnReader" onclick="switchMode(\'r\')">Reader</button>' +
      "</div>" +

      '<div class="hdr-fields">' +

        '<div class="fg">' +
          '<div class="fg-label">Base Text</div>' +
          '<div class="fg-row">' +
            '<textarea class="fg-ta" id="baseIn" placeholder="Paste a chapter, passage, or any text here\u2026"></textarea>' +
            '<button class="fg-btn" onclick="uploadText()">Upload</button>' +
          "</div>" +
        "</div>" +

        '<div class="fg">' +
          '<div class="fg-label">Vocabulary List</div>' +
          '<div class="fg-row">' +
            '<textarea class="fg-ta" id="vocabIn" placeholder="Paste words, one per line\u2026"></textarea>' +
            '<button class="fg-btn sk" onclick="seekOut()">Seek Out</button>' +
          "</div>" +
        "</div>" +

      "</div>" +

      '<div class="hdr-acts">' +
        '<button class="nbtn" onclick="saveTbl()">Save</button>' +
        '<button class="nbtn" onclick="loadTbl()">Load</button>' +
        '<input type="file" id="fileIn" accept=".json" style="display:none">' +
      "</div>" +

    "</div>" +

    /* ═══════════════════════════════════════════
       UNFOUND BAR
       ═══════════════════════════════════════════ */
    '<div class="ubar" id="ubar">' +
      "<strong>Not found:</strong>" +
      '<div class="uw" id="uwc"></div>' +
    "</div>" +

    /* ═══════════════════════════════════════════
       SHEET
       ═══════════════════════════════════════════ */
    '<div class="sc" id="sc">' +
      '<div class="es" id="es">' +
        '<div class="ic">⊞</div>' +
        "<p>Paste text and hit <strong style=\"color:#34ce57\">Upload</strong> to parse</p>" +
        '<span class="ht">Every sentence becomes a row &middot; every token becomes a cell</span>' +
      "</div>" +
      '<table class="st" id="st" style="display:none"></table>' +
    "</div>" +

    /* ═══════════════════════════════════════════
       SAVE POPUP
       ═══════════════════════════════════════════ */
    '<div class="po" id="spop">' +
      '<div class="pb fi">' +
        "<h3>Save Table</h3>" +
        '<input class="pi" id="sfn" type="text" placeholder="my-study-session">' +
        '<div class="pa">' +
          '<button class="pbtn cn" onclick="closePop()">Cancel</button>' +
          '<button class="pbtn ok" onclick="doSave()">Save File</button>' +
        "</div>" +
      "</div>" +
    "</div>" +

    /* ═══════════════════════════════════════════
       READER OVERLAY
       ═══════════════════════════════════════════ */
    '<div class="ro" id="rov">' +
      '<div class="rhdr">' +
        "<h2>Reader</h2>" +
        '<div class="rctrls">' +
          "<label>Lang</label>" +
          '<select id="rLang" onchange="updRdr()">' +
            '<option value="en-US">English</option>' +
            '<option value="ar-SA">Arabic</option>' +
            '<option value="he-IL">Hebrew</option>' +
            '<option value="zh-CN">Chinese</option>' +
            '<option value="fr-FR">French</option>' +
            '<option value="es-ES">Spanish</option>' +
            '<option value="de-DE">German</option>' +
            '<option value="it-IT">Italian</option>' +
            '<option value="ja-JP">Japanese</option>' +
            '<option value="ko-KR">Korean</option>' +
            '<option value="pt-BR">Portuguese</option>' +
            '<option value="ru-RU">Russian</option>' +
            '<option value="hi-IN">Hindi</option>' +
            '<option value="Off">Off</option>' +
          "</select>" +
          "<label>Speed</label>" +
          '<input type="range" id="rSpd" min="0.5" max="2" step="0.1" value="1" oninput="updRdr()">' +
          '<span id="rSpdV" style="font-size:10px;color:#888;min-width:28px">1.0</span>' +
          "<label>Start</label>" +
          '<input type="number" id="rStart" min="1" value="1" style="width:48px">' +
          "<label>End</label>" +
          '<input type="number" id="rEnd" min="1" value="999" style="width:48px">' +
          "<label>Repeat</label>" +
          '<input type="number" id="rRpt" min="1" max="10" value="1" style="width:42px">' +
          '<button class="rbtn" id="rPlay" onclick="rPlay()">Play</button>' +
          '<button class="rbtn stop" id="rStop" onclick="rStop()">Stop</button>' +
        "</div>" +
        '<button class="rclose" onclick="closeRdr()">✕</button>' +
      "</div>" +
      '<div class="rbody">' +
        '<div class="rcont" id="rcont"></div>' +
      "</div>" +
    "</div>" +

    /* ═══════════════════════════════════════════
       JAVASCRIPT
       ═══════════════════════════════════════════ */
    "<script>" +

    /* ── STATE ── */
    "var TBL=[];var HLW={};var SEL=null;var isR=false;" +

    /* ── NORMALIZE ── */
    "function nt(t){return t.toLowerCase().replace(/[^a-z0-9']/g,'');}" +
    "function eh(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML;}" +
    "function ea(s){return s.replace(/\"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}" +

    /* ── TOKENIZER ── */
    "function tokenize(text){" +
      "var raw=text.replace(/\\r\\n/g,'\\n').replace(/\\r/g,'\\n').trim();" +
      "var lines=raw.split(/\\n+/);" +
      "var sents=[];" +
      "for(var i=0;i<lines.length;i++){" +
        "var ln=lines[i].trim();if(!ln)continue;" +
        "var parts=ln.split(/([.!?;:]+)\\s+/);" +
        "var buf='';" +
        "for(var j=0;j<parts.length;j++){" +
          "if(/^[.!?;:]+$/.test(parts[j])){" +
            "buf+=parts[j];" +
            "if(buf.trim().length>0)sents.push(buf.trim());" +
            "buf='';" +
          "}else{" +
            "buf+=(buf&&parts[j]?' ':'')+parts[j];" +
          "}" +
        "}" +
        "if(buf.trim().length>0)sents.push(buf.trim());" +
      "}" +
      "var result=[];" +
      "for(var k=0;k<sents.length;k++){" +
        "var tk=sents[k].match(/[\\w\\u00C0-\\u024F\\u0600-\\u06FF\\u0980-\\u09FF\\u3000-\\u9FFF\\uAC00-\\uD7AF]+|[^\\s]/g)||[];" +
        "if(tk.length>0)result.push(tk);" +
      "}" +
      "return result;" +
    "}" +

    /* ── UPLOAD TEXT ── */
    "function uploadText(){" +
      "var raw=document.getElementById('baseIn').value.trim();" +
      "if(!raw)return;" +
      "TBL=tokenize(raw);" +
      "HLW={};hideUF();" +
      "var re=document.getElementById('rEnd');" +
      "if(re)re.value=TBL.length;" +
      "render();" +
    "}" +

    /* ── RENDER SHEET ── */
    "function render(){" +
      "var tb=document.getElementById('st');" +
      "var es=document.getElementById('es');" +
      "if(TBL.length===0){tb.style.display='none';es.style.display='flex';return;}" +
      "es.style.display='none';tb.style.display='table';" +
      "var mx=0;for(var i=0;i<TBL.length;i++)if(TBL[i].length>mx)mx=TBL[i].length;" +
      "var h='';" +
      "for(var r=0;r<TBL.length;r++){" +
        "h+='<tr>';" +
        "h+='<td>'+(r+1)+'</td>';" +
        "for(var c=0;c<mx;c++){" +
          "var v=c<TBL[r].length?TBL[r][c]:'';" +
          "var nm=c<TBL[r].length?nt(TBL[r][c]):'';" +
          "var isH=nm&&HLW[nm];" +
          "h+='<td class=\"'+(isH?'hl':'')+'\" data-r=\"'+r+'\" data-c=\"'+c+'\" data-t=\"'+ea(nm)+'\" onclick=\"cc(this)\">'+eh(v)+'</td>';" +
        "}" +
        "h+='</tr>';" +
      "}" +
      "tb.innerHTML=h;" +
    "}" +

    /* ── CELL CLICK ── */
    "function cc(el){" +
      "var tk=el.dataset.t;if(!tk)return;" +
      "var all=document.querySelectorAll('#st td[data-t]');" +
      "for(var i=0;i<all.length;i++){" +
        "all[i].classList.remove('sel','hl');" +
      "}" +
      "HLW={};HLW[tk]=true;SEL=el;" +
      "el.classList.add('sel');" +
      "var matches=document.querySelectorAll('#st td[data-t=\"'+tk+'\"]');" +
      "for(var j=0;j<matches.length;j++){" +
        "if(matches[j]!==el)matches[j].classList.add('hl');" +
      "}" +
    "}" +

    /* ── SEEK OUT ── */
    "function seekOut(){" +
      "var raw=document.getElementById('vocabIn').value.trim();" +
      "if(!raw||TBL.length===0)return;" +
      "var words=raw.split(/[\\n,]+/);" +
      "var clean=[];" +
      "for(var i=0;i<words.length;i++){var w=words[i].trim();if(w)clean.push(w);}" +
      "var normList=[];" +
      "for(var i=0;i<clean.length;i++)normList.push(nt(clean[i]));" +
      "var allTk={};" +
      "for(var r=0;r<TBL.length;r++){" +
        "for(var c=0;c<TBL[r].length;c++){" +
          "var n=nt(TBL[r][c]);if(n)allTk[n]=true;" +
        "}" +
      "}" +
      "HLW={};var nf=[];" +
      "for(var i=0;i<normList.length;i++){" +
        "if(allTk[normList[i]]){HLW[normList[i]]=true;}" +
        "else{nf.push(clean[i]);}" +
      "}" +
      "render();" +
      "if(nf.length>0)showUF(nf);else hideUF();" +
    "}" +

    /* ── UNFOUND BAR ── */
    "function showUF(words){" +
      "var bar=document.getElementById('ubar');" +
      "var wc=document.getElementById('uwc');" +
      "var h='';" +
      "for(var i=0;i<words.length;i++)h+='<span class=\"uwi\">'+eh(words[i])+'</span>';" +
      "wc.innerHTML=h;" +
      "bar.classList.add('v');" +
      "document.getElementById('sc').classList.add('wu');" +
    "}" +
    "function hideUF(){" +
      "document.getElementById('ubar').classList.remove('v');" +
      "document.getElementById('sc').classList.remove('wu');" +
    "}" +

    /* ── SAVE ── */
    "function saveTbl(){" +
      "if(TBL.length===0)return;" +
      "document.getElementById('sfn').value='study-'+new Date().toISOString().slice(0,10);" +
      "document.getElementById('spop').classList.add('v');" +
      "document.getElementById('sfn').focus();" +
      "document.getElementById('sfn').select();" +
    "}" +
    "function closePop(){document.getElementById('spop').classList.remove('v');}" +
    "function doSave(){" +
      "var nm=document.getElementById('sfn').value.trim()||'table';" +
      "nm=nm.replace(/[^a-zA-Z0-9_-]/g,'_');" +
      "var p={v:1,ts:new Date().toISOString(),name:nm,tbl:TBL,hl:Object.keys(HLW),txt:document.getElementById('baseIn').value};" +
      "var blob=new Blob([JSON.stringify(p,null,2)],{type:'application/json'});" +
      "var url=URL.createObjectURL(blob);" +
      "var a=document.createElement('a');a.href=url;a.download=nm+'.json';a.click();" +
      "URL.revokeObjectURL(url);closePop();" +
    "}" +

    /* ── LOAD ── */
    "function loadTbl(){document.getElementById('fileIn').click();}" +
    "document.getElementById('fileIn').addEventListener('change',function(ev){" +
      "var f=ev.target.files[0];if(!f)return;" +
      "var rd=new FileReader();" +
      "rd.onload=function(e){" +
        "try{" +
          "var p=JSON.parse(e.target.result);" +
          "if(p.tbl&&p.tbl.length){" +
            "TBL=p.tbl;HLW={};" +
            "if(p.hl)for(var i=0;i<p.hl.length;i++)HLW[p.hl[i]]=true;" +
            "if(p.txt)document.getElementById('baseIn').value=p.txt;" +
            "hideUF();render();" +
            "var re=document.getElementById('rEnd');if(re)re.value=TBL.length;" +
          "}" +
        "}catch(err){alert('Invalid table file.');}" +
      "};" +
      "rd.readAsText(f);ev.target.value='';" +
    "});" +

    /* ── MODE SWITCH ── */
    "function switchMode(m){" +
      "document.getElementById('btnTabler').classList.remove('on');" +
      "document.getElementById('btnReader').classList.remove('on');" +
      "if(m==='r'){" +
        "document.getElementById('btnReader').classList.add('on');" +
        "openRdr();" +
      "}else{" +
        "document.getElementById('btnTabler').classList.add('on');" +
        "closeRdr();" +
      "}" +
    "}" +

    /* ═══════════════════════════════════════════
       READER ENGINE
       ═══════════════════════════════════════════ */

    /* ── OPEN READER ── */
    "function openRdr(){" +
      "if(TBL.length===0)return;" +
      "buildRdr();" +
      "document.getElementById('rov').classList.add('v');" +
      "document.getElementById('rEnd').value=TBL.length;" +
    "}" +
    "function closeRdr(){" +
      "rStop();" +
      "document.getElementById('rov').classList.remove('v');" +
    "}" +

    /* ── BUILD READER CONTENT ── */
    "function buildRdr(){" +
      "var rc=document.getElementById('rcont');" +
      "var h='';" +
      "for(var s=0;s<TBL.length;s++){" +
        "h+='<span class=\"rsent\" data-si=\"'+s+'\">';" +
        "for(var w=0;w<TBL[s].length;w++){" +
          "var nm=nt(TBL[s][w]);" +
          "var isH=nm&&HLW[nm];" +
          "h+='<span class=\"rw'+(isH?' rhl':'')+'\" data-t=\"'+ea(nm)+'\" onclick=\"rwClick(this)\">'+eh(TBL[s][w])+'</span> ';" +
        "}" +
        "h+='</span>';" +
      "}" +
      "rc.innerHTML=h;" +
    "}" +

    /* ── READER WORD CLICK ── */
    "function rwClick(el){" +
      "var tk=el.dataset.t;if(!tk)return;" +
      "if(HLW[tk]){delete HLW[tk];}else{HLW[tk]=true;}" +
      "var all=document.querySelectorAll('.rw');" +
      "for(var i=0;i<all.length;i++){" +
        "if(HLW[all[i].dataset.t])all[i].classList.add('rhl');" +
        "else all[i].classList.remove('rhl');" +
      "}" +
      "render();" +
    "}" +

    /* ── UPDATE READER STYLE ── */
    "function updRdr(){" +
      "document.getElementById('rSpdV').textContent=parseFloat(document.getElementById('rSpd').value).toFixed(1);" +
    "}" +

    /* ── SPEAK (TTS) ── */
    "function rSpeak(text,lang,rate){" +
      "return new Promise(function(resolve){" +
        "if(!text||!text.trim())return resolve();" +
        "if(!('speechSynthesis' in window))return resolve();" +
        "var u=new SpeechSynthesisUtterance(text);" +
        "u.lang=lang||'en-US';" +
        "u.rate=rate||1;" +
        "u.onend=resolve;u.onerror=resolve;" +
        "speechSynthesis.speak(u);" +
      "});" +
    "}" +

    /* ── PLAY / STOP ── */
    "function rPlay(){" +
      "if(isR||TBL.length===0)return;" +
      "isR=true;" +
      "var lang=document.getElementById('rLang').value;" +
      "if(lang==='Off')lang='en-US';" +
      "var spd=parseFloat(document.getElementById('rSpd').value)||1;" +
      "var start=Math.max(1,parseInt(document.getElementById('rStart').value)||1)-1;" +
      "var end=Math.min(TBL.length,parseInt(document.getElementById('rEnd').value)||TBL.length)-1;" +
      "var rpt=Math.max(1,parseInt(document.getElementById('rRpt').value)||1);" +
      "(async function(){" +
        "for(var rt=0;rt<rpt;rt++){" +
          "for(var si=start;si<=end;si++){" +
            "if(!isR)return;" +
            "var row=TBL[si];if(!row)continue;" +
            "var sent=document.querySelector('.rsent[data-si=\"'+si+'\"]');" +
            "if(sent)sent.classList.add('rs-reading');" +
            "if(sent)sent.scrollIntoView({behavior:'smooth',block:'center'});" +
            "for(var wi=0;wi<row.length;wi++){" +
              "if(!isR){" +
                "if(sent)sent.classList.remove('rs-reading');" +
                "return;" +
              "}" +
              "var wEl=sent?sent.querySelectorAll('.rw')[wi]:null;" +
              "if(wEl)wEl.classList.add('ractive');" +
              "var clean=row[wi].replace(/[\\u{1F600}-\\u{1F64F}]/gu,'').trim();" +
              "if(clean)await rSpeak(clean,lang,spd);" +
              "if(wEl)wEl.classList.remove('ractive');" +
            "}" +
            "if(sent)sent.classList.remove('rs-reading');" +
          "}" +
        "}" +
        "isR=false;" +
      "})();" +
    "}" +
    "function rStop(){" +
      "isR=false;" +
      "if('speechSynthesis' in window)speechSynthesis.cancel();" +
      "var act=document.querySelectorAll('.ractive');" +
      "for(var i=0;i<act.length;i++)act[i].classList.remove('ractive');" +
      "var rds=document.querySelectorAll('.rs-reading');" +
      "for(var j=0;j<rds.length;j++)rds[j].classList.remove('rs-reading');" +
    "}" +

    /* ── KEYBOARD SHORTCUTS ── */
    "document.addEventListener('keydown',function(e){" +
      "if(e.key==='Escape'){closePop();closeRdr();switchMode('t');}" +
      "if(e.ctrlKey&&e.key==='s'){e.preventDefault();saveTbl();}" +
      "if(e.ctrlKey&&e.key==='Enter'){e.preventDefault();uploadText();}" +
    "});" +

    "<\/script></body></html>"
  );

  w.document.close();
});

// ===============================
// RECORDER BUTTON EVENTS
// ===============================
document.getElementById("recordBtn")?.addEventListener("click", startRecording);
document.getElementById("stopRecordBtn")?.addEventListener("click", stopRecording);
