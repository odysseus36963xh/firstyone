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




// ===============================
// TABLER FUNCTION AND THE EVENTS
// ===============================

document.getElementById("openTabler").addEventListener("click", function() {
  var newTab = window.open("", "_blank");
  if (!newTab) {
    alert("Allow pop-ups for this site to open the Tabler.");
    return;
  }
  
  // We define the entire UI here as one clean string
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Tabler — Text Analyzer</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{ font-family:'Segoe UI',Arial,sans-serif; background:#f1f3f4;color:#202124; display:flex;flex-direction:column;height:100vh;overflow:hidden; }
header{ min-height:52px;background:#fff; border-bottom:1px solid #dadce0; display:flex;align-items:center;gap:10px; padding:0 14px;position:sticky;top:0;z-index:1000; flex-wrap:wrap; }
button{ border:none;background:#1a73e8;color:#fff; padding:8px 14px;border-radius:4px;font-size:13px; font-weight:500;cursor:pointer;transition:0.15s; }
button:hover{background:#1765cc}
button:disabled{opacity:.5;cursor:wait}
.btn-green{background:#34a853!important}
.btn-green:hover{background:#2d9249!important}
.btn-orange{background:#e8710a!important}
.btn-orange:hover{background:#d35f00!important}
.btn-orange:disabled{background:#e8710a!important}
#toolbar{ display:none;background:#fff; border-bottom:1px solid #dadce0; padding:10px 14px;gap:14px; flex-wrap:wrap;align-items:center; align-items: center;}
label{font-size:13px;color:#5f6368;display:flex;align-items:center;gap:6px}
input,textarea,select{ border:1px solid #dadce0;border-radius:4px; padding:6px 8px;font-size:13px;outline:none; }
input:focus,textarea:focus,select:focus{border-color:#1a73e8}
#inputPanel{ display:flex;gap:16px;padding:14px; background:#fff;border-bottom:1px solid #dadce0; }
.panel-left,.panel-right{flex:1;display:flex;flex-direction:column;gap:8px;min-width:0}
.panel-left label,.panel-right label{font-size:14px;font-weight:700;color:#202124}
.panel-left textarea,.panel-right textarea{ width:100%;height:110px;padding:10px;font-size:13px; border:1px solid #dadce0;border-radius:4px;resize:vertical; }
#absentWords{ display:none;padding:10px 14px;background:#fff3cd; border-bottom:1px solid #dadce0;font-size:13px;color:#856404;line-height:1.6; }
#absentWords strong{display:block;margin-bottom:4px}
#absentWords .absent-list{font-weight:600;word-break:break-word}
#absentWords .found-msg{ color:#155724;background:#d4edda; border-radius:4px;padding:6px 10px;display:inline-block; }
#sheetWrap{flex:1;overflow:auto;background:#fff; position: relative;}
table{border-collapse:collapse;table-layout:fixed;width: 100%;}
th{ border:1px solid #e0e0e0;background:#f8f9fa;color:#5f6368; font-weight:500;text-align:center;height:32px;min-width:60px; width:60px;font-size:12px;position:sticky;top:0;z-index:20; overflow:hidden; white-space:nowrap; }
.row-head{ min-width:50px;width:50px;left:0;z-index:30; position:sticky;background:#f8f9fa; border-right: 1px solid #e0e0e0;}
td{ border:1px solid #e0e0e0;width:60px;height:32px; padding:4px 8px;font-size:13px;text-align:left; vertical-align:middle;background:#fff;position:relative; cursor:pointer;transition:background-color .12s; white-space: pre-wrap; word-break: break-word; overflow: hidden; }
td:hover{background:#f0f7ff}
td:focus{outline:none;border:2px solid #1a73e8;z-index:50}
td.highlighted{ background-color:#34ce57!important;color:#141414!important; }
td.reading{ background-color:#34ce57!important;color:#141414!important; box-shadow:inset 0 0 0 2px #1a73e8; }
.col-select{width:90%;border:none;background:transparent;font-size:11px;color:#5f6368; text-align: center; appearance:none; background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23007CB2%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E'); background-repeat: no-repeat; background-position: right .7em top 50%; background-size: .65em auto;}
.title{font-size:17px;font-weight:700;color:#202124;white-space:nowrap;margin-right:6px}
.hint{font-size:11px;color:#999;margin-left:4px}
::-webkit-scrollbar{width:10px;height:10px}
::-webkit-scrollbar-track{background:#f1f1f1}
::-webkit-scrollbar-thumb{background:#c1c1c1;border-radius:20px}
::-webkit-scrollbar-thumb:hover{background:#a8a8a8}
/* Scrollbar fix */
#sheetWrap{ position: relative; }
#sheet { position: relative; z-index: 20; }
</style>
</head>
<body>

<header>
  <span class="title">\uD83D\uDCCB Tabler</span>
  <button onclick="saveTablerTable()">\uD83D\uDCBE Save</button>
  <button onclick="uploadTablerTable()">\uD83D\uDCC1 Upload</button>
  <button onclick="toggleTablerReader()">\uD83D\uDD27 Reader</button>
  <button onclick="startTablerReading()">\u25B6 Read</button>
  <button onclick="stopTablerReading()">\u23F9 Stop</button>
  <span class="hint">Click any word to highlight • Paste vocab to seekout</span>
</header>

<div id="toolbar">
  <label>Speed <input id="speed" type="range" min="0.5" max="2" step="0.1" value="1"></label>
  <label>Repeat <input id="repeatCell" type="number" min="1" value="1" style="width:50px"></label>
  <label>Start <input id="startCell" type="text" placeholder="A1" style="width:60px"></label>
  <label>End <input id="endCell" type="text" placeholder="Z26" style="width:60px"></label>
  <label>Reverse <input id="reverse" type="checkbox"></label>
</div>

<div id="inputPanel">
  <div class="panel-left">
    <label>\uD83D\uDCD6 Base Text</label>
    <textarea id="baseText" placeholder="Paste your text — Bible, Quran, Tao Te Ching. Sentences become rows."></textarea>
    <button class="btn-green" onclick="uploadBaseText()">\u2B06 Parse Text</button>
  </div>
  <div class="panel-right">
    <label>\uD83D\uDD0D Vocabulary List</label>
    <textarea id="vocabList" placeholder="Paste words to study — one per line or comma-separated. Hit Seekout."></textarea>
    <button class="btn-orange" id="seekoutBtn" onclick="seekoutVocab()">\uD83C\uDFAF Seekout</button>
  </div>
</div>

<div id="absentWords"></div>

<div id="sheetWrap">
  <table id="sheet"></table>
</div>

<script>
// ============================
// STATE
// ============================
var TC = 26, tRows = 26, curHL = null, isReading = false, tVoices = [];
var tTable = document.getElementById("sheet");

// ============================
// VOICES
// ============================
function tLoadVoices(){ tVoices = speechSynthesis.getVoices() || [] }
if("speechSynthesis" in window){
  speechSynthesis.onvoiceschanged = tLoadVoices;
  // Retry loading voices as some browsers delay this
  setTimeout(tLoadVoices, 250);
  setTimeout(tLoadVoices, 1000);
}
var TLM={EN:"en",IT:"it",ES:"es",FR:"fr",DE:"de"};
function tNorm(c){return c?c.trim().replace("_","-").toLowerCase():""}
function tGetVoice(lc){
  if(!tVoices.length)tVoices=speechSynthesis.getVoices()||[];
  var m=TLM[lc]||lc,w=tNorm(m);
  if(!w||w==="off")return null;
  var v=null;
  // First exact match
  for(var i=0;i<tVoices.length;i++){if(tNorm(tVoices[i].lang)===w){v=tVoices[i];break;}}
  if(v)return v;
  // Fallback base language (e.g. 'en-US' -> 'en')
  var base=w.split("-")[0];
  for(var i=0;i<tVoices.length;i++){if(tNorm(tVoices[i].lang).split("-")[0]===base)return tVoices[i];}
  return null;
}
function tSpeak(text,lang,rate){
  return new Promise(function(res){
    if(!text||!text.trim())return res();
    var u=new SpeechSynthesisUtterance(text);
    var v=tGetVoice(lang);
    if(v){u.voice=v;u.lang=v.lang;}
    else if(lang&&lang!=="Off"){u.lang=TLM[lang]||lang;}
    u.rate=rate||1;
    u.onend=res; u.onerror=res;
    speechSynthesis.speak(u);
  });
}
function tParseCell(ref){
  if(!ref||!ref.trim())return null;
  var m=ref.trim().toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if(!m)return null;
  return{col:m[1].charCodeAt(0)-65,row:parseInt(m[2])};
}

// ============================
// TABLE INIT
// ============================
function initTablerTable(){
  var h='<tr><th></th>';
  for(var c=0;c<TC;c++)h+='<th>'+String.fromCharCode(65+c)+'</th>';
  h+='</tr><tr><th></th>';
  for(var c=0;c<TC;c++)h+='<th><select class="col-select"><option>Off</option><option>English</option><option>Italian</option><option>Spanish</option><option>French</option><option>German</option></select></th>';
  h+='</tr>';
  for(var r=1;r<=tRows;r++){
    h+='<tr><th class="row-head">'+r+'</th>';
    for(var c=0;c<TC;c++)h+='<td></td>';
    h+='</tr>';
  }
  tTable.innerHTML=h;
}

function addTablerRows(n){
  if(n<=0)return;
  var b="";
  for(var i=0;i<n;i++){
    tRows++;
    b+='<tr><th class="row-head">'+tRows+'</th>';
    for(var c=0;c<TC;c++)b+='<td></td>';
    b+='</tr>';
  }
  tTable.insertAdjacentHTML("beforeend",b);
}
function tRowCount(){return tTable.rows.length-2;}
function tClearData(){
  for(var r=2;r<tTable.rows.length;r++){
    for(var c=1;c<=TC;c++){
      var cell=tTable.rows[r].cells[c];
      if(cell){cell.textContent="";cell.removeAttribute("data-word");cell.classList.remove("highlighted","reading");}
    }
  }
}
function tCell(ri,ci){
  var row=tTable.rows[ri+2];
  return row?row.cells[ci+1]||null:null;
}

// ============================
// TEXT PARSING
// ============================
function splitSentences(t){
  t=t.replace(/\r\n/g,"\n").replace(/\r/g,"\n");
  var lines=t.split("\n"),out=[];
  for(var i=0;i<lines.length;i++){
    var l=lines[i].trim();if(!l)continue;
    // Split by punctuation followed by space or end
    var p=l.match(/[^.!?]+\.[.!?\s]+/g);
    if(p && p.length){
      for(var j=0;j<p.length;j++){
        var s=p[j].trim();
        if(s)out.push(s);
      }
      var cap=0;for(var j=0;j<p.length;j++)cap+=p[j].length;
      var rem=l.substring(cap).trim();if(rem)out.push(rem);
    }else{out.push(l);}
  }
  return out.filter(function(x){return x.length>0;});
}

function tokenizeSent(s){
  // Robust tokenizer
  return s.match(/[a-zA-ZÀ-ÿ]+|[0-9]+|[^\\s\\p{L}\\p{N}]+/g) || s.split(/\\s+/); 
}

function uploadBaseText(){
  var text=document.getElementById("baseText").value.trim();
  if(!text){alert("Paste some text first.");return;}
  
  // Confirmation if sheet not empty
  var has=false;
  for(var r=2;r<tTable.rows.length&&!has;r++)
    for(var c=1;c<=TC&&!has;c++)
      if(tTable.rows[r].cells[c]&&tTable.rows[r].cells[c].textContent.trim())has=true;
      
  if(has && !confirm("Clear current sheet and load new text?"))return;
  
  curHL=null;
  var prev=document.querySelectorAll(".highlighted");
  for(var i=0;i<prev.length;i++)prev[i].classList.remove("highlighted");
  document.getElementById("absentWords").style.display="none";
  
  var units=splitSentences(text);
  if(!units.length){alert("No sentences found.");return;}
  
  // Add rows if needed
  if(units.length>tRowCount()){addTablerRows(units.length-tRowCount());}
  
  tClearData();
  var maxC=0;
  for(var i=0;i<units.length;i++){
    var tk=tokenizeSent(units[i]);
    for(var j=0;j<tk.length&&j<TC;j++){
      var cell=tCell(i,j);
      if(cell){cell.textContent=tk[j];cell.setAttribute("data-word",tk[j].toLowerCase().replace(/[^a-z0-9]/gi,""));}
    }
    if(tk.length>maxC)maxC=tk.length;
  }
  alert("✅ Parsed "+units.length+" sentences ("+maxC+" columns used).");
}

// ============================
// CLICK HIGHLIGHT
// ============================
tTable.addEventListener("click",function(e){
  var tgt=e.target;if(tgt.tagName!=="TD")return;
  var w=tgt.getAttribute("data-word");if(!w)return;
  
  // Toggle off if clicking same word
  if(curHL===w){
    curHL=null;
    var p=document.querySelectorAll(".highlighted");
    for(var i=0;i<p.length;i++)p[i].classList.remove("highlighted");
    return;
  }
  
  // Clear old highlights
  var p=document.querySelectorAll(".highlighted");
  for(var i=0;i<p.length;i++)p[i].classList.remove("highlighted");
  
  curHL=w;
  // Highlight all matches
  var all=document.querySelectorAll("#sheet td[data-word]");
  for(var i=0;i<all.length;i++){
    if(all[i].getAttribute("data-word")===w)all[i].classList.add("highlighted");
  }
});

// ============================
// SEEKOUT VOCAB
// ============================
function seekoutVocab(){
  var list=document.getElementById("vocabList").value.trim();
  if(!list){alert("Paste vocabulary first.");return;}
  var raw=list.split(/[\n,;]+/);
  var words=[];
  for(var i=0;i<raw.length;i++){var w=raw[i].trim().toLowerCase();if(w)words.push(w);}
  if(!words.length){alert("No words found.");return;}
  
  curHL=null;
  var prev=document.querySelectorAll(".highlighted");
  for(var i=0;i<prev.length;i++)prev[i].classList.remove("highlighted");
  
  var found=[],notFound=[];
  var allCells=document.querySelectorAll("#sheet td[data-word]");
  
  // Mark cells
  for(var w=0;w<words.length;w++){
    var ok=false;
    for(var c=0;c<allCells.length;c++){
      // Simple matching
      if(allCells[c].getAttribute("data-word")===words[w]){allCells[c].classList.add("highlighted");ok=true;}
    }
    if(ok)found.push(words[w]);else notFound.push(words[w]);
  }
  
  var box=document.getElementById("absentWords");
  if(notFound.length){
    box.innerHTML='<strong>⚠️ NOT found ('+notFound.length+' of '+words.length+'):</strong><div class="absent-list">'+notFound.join(", ")+'</div>';
    box.style.display="block";
  }else{
    box.innerHTML='<div class="found-msg">✅ All '+found.length+' words found and highlighted!</div>';
    box.style.display="block";
    setTimeout(function(){box.style.display="none";},4000);
  }
}

// ============================
// READER
// ============================
function clearTablerReading(){var e=document.querySelectorAll(".reading");for(var i=0;i<e.length;i++)e[i].classList.remove("reading");}
function stopTablerReading(){isReading=false;speechSynthesis.cancel();clearTablerReading();}

function startTablerReading(){
  if(isReading)return; isReading=true;
  
  var spd=parseFloat(document.getElementById("speed").value)||1;
  var rep=parseInt(document.getElementById("repeatCell").value)||1;
  
  // Handle defaults if inputs are empty
  var sStr=document.getElementById("startCell").value || "A1";
  var eStr=document.getElementById("endCell").value || "Z"+tRows;
  
  var s=tParseCell(sStr) || {row:1,col:0};
  var e=tParseCell(eStr) || {row:tRows,col:TC-1};
  
  var rev=document.getElementById("reverse").checked;
  
  // Define ranges
  var rr=[],cr=[];
  for(var r=s.row;r<=e.row;r++)rr.push(r);
  for(var c=s.col;c<=e.col;c++)cr.push(c);
  
  if(rev){rr.reverse(); cr.reverse();}
  
  // Reading Loop
  (async function(){
    for(var ri=0;ri<rr.length;ri++){
      if(!isReading)break;
      var row=tTable.rows[rr[ri]+1];if(!row)continue;
      for(var ci=0;ci<cr.length;ci++){
        if(!isReading)break;
        var cell=row.cells[cr[ci]+1];if(!cell)continue;
        
        var txt=cell.textContent||"";
        // Get Language
        var sel=tTable.rows[1]&&tTable.rows[1].cells[cr[ci]+1]?tTable.rows[1].cells[cr[ci]+1].querySelector("select"):null;
        var lang=sel?sel.value:"English"; 
        
        if(lang==="Off"||lang==="English"||!txt.trim())continue; // English is default/off
        
        for(var rc=0;rc<rep;rc++){
          if(!isReading)break;
          cell.classList.add("reading");
          await tSpeak(txt.trim(),lang,spd);
          cell.classList.remove("reading");
        }
      }
    }
    isReading=false;
  })();
}

function toggleTablerReader(){
  var b=document.getElementById("toolbar");
  if(b.style.display==="flex") b.style.display="none";
  else b.style.display="flex";
}

// ============================
// KEYBOARD NAVIGATION
// ============================
tTable.addEventListener("keydown",function(e){
  var tgt=e.target;if(tgt.tagName!=="TD")return;
  if(e.key==="Tab"){
    e.preventDefault();
    var ch=tgt.parentElement.children;
    var nxt=null;
    var ci=-1;
    for(var i=0;i<ch.length;i++){if(ch[i]===tgt){ci=i;break;}}
    
    if(ci>=TC){
      // Wrap to next row
      var ar=tTable.querySelectorAll("tr"),ri=-1;
      for(var i=0;i<ar.length;i++){if(ar[i]===tgt.parentElement){ri=i;break;}}
      if(ri>=tTable.rows.length-1){
        addTablerRows(1);
        nxt=tTable.rows[tTable.rows.length-1].cells[1];
      }else{nxt=tTable.rows[ri+1]?tTable.rows[ri+1].cells[1]:null;}
    }else{nxt=tgt.nextElementSibling;}
    
    if(nxt&&nxt.tagName==="TD")nxt.focus();
  }
});

// ============================
// SAVE / UPLOAD
// ============================
function tTimestamp(){
  var d=new Date(),p=function(n){return String(n).padStart(2,"0");};
  return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate())+"_"+p(d.getHours())+"-"+p(d.getMinutes())+"-"+p(d.getSeconds());
}

function tExportData(){
  var cells=[],langs=[];
  var sr=tTable.rows[1];
  for(var c=0;c<TC;c++){
    var s=sr&&sr.cells[c+1]?sr.cells[c+1].querySelector("select"):null;
    langs.push(s?s.value:"Off");
  }
  for(var r=2;r<tTable.rows.length;r++){
    var rd=[];
    for(var c=1;c<=TC;c++){var cl=tTable.rows[r].cells[c];rd.push(cl?cl.textContent.trim():"");}
    cells.push(rd);
  }
  return{createdAt:new Date().toISOString(),tool:"Tabler",columns:TC,rows:cells.length,cells:cells,languages:langs};
}

function tDownload(name,data){
  var b=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  var u=URL.createObjectURL(b),a=document.createElement("a");
  a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(u);
}

function tSaveDialog(def,cb){
  var ov=document.createElement("div");
  ov.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:9999;";
  var bx=document.createElement("div");
  bx.style.cssText="background:#fff;padding:24px;border-radius:12px;width:380px;font-family:Arial,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,0.35);";
  bx.innerHTML='<h3 style="margin:0 0 6px;color:#202124;font-size:18px">💾 Save Table</h3><p style="font-size:13px;color:#5f6368;margin:0 0 12px">Name your file:</p><input id="tFN" style="width:100%;padding:10px 12px;font-size:14px;border:1px solid #dadce0;border-radius:6px;outline:none" value="'+def+'"><div style="margin-top:16px;display:flex;justify-content:flex-end;gap:10px"><button id="tCancel" style="background:#f1f1f1;color:#333;padding:8px 18px">Cancel</button><button id="tSave" style="background:#34a853;padding:8px 22px;font-weight:600">Save</button></div>';
  ov.appendChild(bx);document.body.appendChild(ov);
  
  var inp=document.getElementById("tFN");inp.focus();inp.select();
  
  document.getElementById("tCancel").onclick=function(){ov.remove();};
  document.getElementById("tSave").onclick=function(){var n=document.getElementById("tFN").value.trim();ov.remove();cb(n||def);};
  inp.addEventListener("keydown",function(e){if(e.key==="Enter")document.getElementById("tSave").click();});
}

function saveTablerTable(){
  tSaveDialog("tabler_"+tTimestamp()+".json",function(n){
    if(!n.endsWith(".json"))n+=".json";
    tDownload(n,tExportData());
  });
}

function uploadTablerTable(){
  var inp=document.createElement("input");inp.type="file";inp.accept=".json";
  inp.onchange=function(){
    var f=inp.files[0];if(!f)return;
    var reader=new FileReader();
    reader.onload=function(ev){
      try{
        var d=JSON.parse(ev.target.result);
        if(!d.cells||!d.languages)throw new Error("Invalid format");
        if(d.cells.length>tRowCount())addTablerRows(d.cells.length-tRowCount());
        var sr=tTable.rows[1];
        
        // Restore Languages
        for(var c=0;c<d.languages.length&&c<TC;c++){
          var s=sr&&sr.cells[c+1]?sr.cells[c+1].querySelector("select"):null;
          if(s)s.value=d.languages[c];
        }
        
        tClearData();
        
        // Restore Data
        for(var r=0;r<d.cells.length;r++){
          for(var c=0;c<d.cells[r].length&&c<TC;c++){
            var cell=tCell(r,c);
            if(cell&&d.cells[r][c]){cell.textContent=d.cells[r][c];cell.setAttribute("data-word",d.cells[r][c].toLowerCase());}
          }
        }
        curHL=null;
        alert("✅ Table uploaded! "+d.cells.length+" rows restored.");
      }catch(err){alert("Invalid JSON: "+(err.message||""));}
    };
    reader.readAsText(f);
  };
  inp.click();
}

// ============================
// LANGUAGE DROPDOWNS AUTO-FILL
// ============================
function tUpdateLangs(){
  var sr=tTable.rows[1];if(!sr)return;
  var unique={};
  // Only use known languages from dictionary
  ["en","it","es","fr","de"].forEach(function(k){
     unique[k] = k.toUpperCase();
  });
  
  for(var c=1;c<sr.cells.length;c++){
    var sel=sr.cells[c]?sr.cells[c].querySelector("select"):null;
    if(!sel)continue;
    var cur=sel.value||"Off";
    sel.innerHTML="<option>Off</option>";
    
    Object.keys(unique).forEach(function(k){
      var o=document.createElement("option");
      o.value=k;
      o.textContent=unique[k];
      sel.appendChild(o);
    });
    sel.value=cur;
  }
}

// Initialize Everything
initTablerTable();
tUpdateLangs();
</script>
</body>
</html>`;

  newTab.document.write(htmlContent);
  newTab.document.close();
});
```



// ===============================
// RECORDER BUTTON EVENTS
// ===============================
document.getElementById("recordBtn")?.addEventListener("click", startRecording);
document.getElementById("stopRecordBtn")?.addEventListener("click", stopRecording);
