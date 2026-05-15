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
function clearHighlight() {
  document.querySelectorAll(".reading").forEach(c => c.classList.remove("reading"));
}

function stopReading() {
  isReading = false;
  speechSynthesis.cancel();
  clearHighlight();
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
      // table.rows[0] = header, table.rows[1] = selectors, table.rows[2+] = data
      const row = table.rows[r + 1];
      if (!row) continue;

      for (let rr = 0; rr < repeatRow; rr++) {
        for (let c of colRange) {
          if (!isReading) return;
          const cell = row.cells[c + 1]; // +1 skips row number header
          if (!cell) continue;
          const text = cell.innerText || "";

          const selector = table.rows[1]?.cells[c + 1]?.querySelector("select");
          const lang = selector?.value || "Off";

          if (lang === "Off" || !text.trim()) continue;

          for (let rc = 0; rc < repeatCell; rc++) {
            if (!isReading) return;
            cell.classList.add("reading");
            await speak(text, lang, speed);
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
  const data = [];
  const selectorRow = table.rows[1];

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
  return { createdAt: new Date().toISOString(), columns: 26, rows: data.length, data };
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
// UI TOGGLES
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



// ===============================
// FREQUENCY FINDER (UNIVERSAL LANGUAGE SUPPORT)
// ===============================
// ===============================
// FREQUENCY FINDER (BULLETPROOF)
// ===============================
document.getElementById("openFinder").addEventListener("click", () => {
  const newTab = window.open("", "_blank");
  if (!newTab) return; // Popup blocked

  const innerJS = `
    document.addEventListener("DOMContentLoaded", function() {
      document.getElementById("findBtn").addEventListener("click", function() {
        var raw = document.getElementById("textInput").value;
        var size = parseInt(document.getElementById("comboSize").value) || 1;
        if (!raw.trim()) { alert("Please paste text first."); return; }
        
        try {
          var text = raw.normalize("NFKC");
          // Remove numbers, punctuation & symbols. Keep letters + spaces
          text = text.replace(/[\\p{N}\\p{P}\\p{S}]/gu, " ");
          text = text.toLowerCase().replace(/\\s+/g, " ").trim();
          
          // Extract all letter sequences (works for ALL Unicode scripts)
          var tokens = text.match(/[\\p{L}]+/gu) || [];
          if (tokens.length === 0) { alert("No valid words/characters found."); return; }

          // Generate sliding window combinations
          var combos = [];
          for (var i = 0; i <= tokens.length - size; i++) {
            combos.push(tokens.slice(i, i + size).join(" "));
          }

          // Count frequency
          var freq = {};
          combos.forEach(function(c) { freq[c] = (freq[c] || 0) + 1; });
          
          // Sort descending
          var sorted = Object.entries(freq).sort(function(a, b) { return b[1] - a[1]; });

          // Render table
          var tbody = document.querySelector("#resultTable tbody");
          tbody.innerHTML = "";
          sorted.forEach(function(item) {
            var w = item[0];
            var c = item[1];
            var pct = ((c / combos.length) * 100).toFixed(4);
            var tr = document.createElement("tr");
            tr.innerHTML = '<td>' + w + '</td><td>' + c + '</td><td>' + pct + '%</td>';
            tbody.appendChild(tr);
          });
        } catch(e) {
          alert("Processing error: " + e.message);
        }
      });
    });
  `;

  const html = `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Frequency Finder</title>
      <style>
        body{font-family:Arial,sans-serif;background:#101010;color:white;padding:20px;}
        textarea{width:100%;height:300px;padding:15px;font-size:16px;border-radius:10px;border:none;resize:vertical;margin-top:10px;background:#222;color:white;}
        input[type=number]{padding:10px;width:260px;font-size:16px;border:none;border-radius:8px;margin-top:10px;background:#333;color:white;}
        button{background:#2b7cff;color:white;border:none;padding:12px 20px;border-radius:10px;cursor:pointer;font-size:17px;margin-top:10px;}
        button:hover{background:#1e63da;}
        table{width:100%;border-collapse:collapse;margin-top:25px;background:#1a1a1a;}
        th,td{border:1px solid #333;padding:12px;text-align:left;}
        th{background:#222;}
        tr:nth-child(even){background:#151515;}
        h1{color:#61a8ff;}
        .small{color:#bbb;margin-bottom:15px;}
      </style>
    </head>
    <body>
      <h1>Frequency Finder</h1>
      <div class="small">Universal: English, Arabic, Chinese, Korean, Hindi, Russian, Georgian, etc.</div>
      <textarea id="textInput" placeholder="Paste text here..."></textarea><br>
      <input id="comboSize" type="number" min="1" max="10" value="1" placeholder="Words/Chars per combo"><br>
      <button id="findBtn">Find Frequency</button>
      <table id="resultTable">
        <thead><tr><th>Word / Combination</th><th>Total Appearances</th><th>Percentage</th></tr></thead>
        <tbody></tbody>
      </table>
      <script>${innerJS}<\\/script>
    </body>
    </html>`;

  newTab.document.write(html);
  newTab.document.close();
});
