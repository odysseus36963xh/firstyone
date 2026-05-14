let isReading = false;
let voices = [];

speechSynthesis.onvoiceschanged = () => {
  voices = speechSynthesis.getVoices();
};

voices = speechSynthesis.getVoices();

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

function getVoice(langCode) {
  const map = { EN: "en", IT: "it", ES: "es", FR: "fr", DE: "de" };
  const lang = map[langCode];
  if (!lang) return null;

  return voices.find(v => v.lang.toLowerCase().startsWith(lang));
}

function speak(text, lang, rate) {
  return new Promise(resolve => {
    if (!text.trim()) return resolve();

    const utter = new SpeechSynthesisUtterance(text);
    const voice = getVoice(lang);

    if (voice) utter.voice = voice;
    utter.rate = rate;

    utter.onend = resolve;
    utter.onerror = resolve;

    speechSynthesis.speak(utter);
  });
}

function clearHighlight() {
  document.querySelectorAll(".reading").forEach(c => c.classList.remove("reading"));
}

function stopReading() {
  isReading = false;
  speechSynthesis.cancel();
  clearHighlight();
}

async function startReading() {
  if (isReading) return;
  isReading = true;

  const table = document.getElementById("sheet");

  const speed = parseFloat(document.getElementById("speed").value);
  const repeatRow = parseInt(document.getElementById("repeatRow").value);
  const repeatTable = parseInt(document.getElementById("repeatTable").value);
  const repeatCell = parseInt(document.getElementById("repeatCell").value);

  const start = parseCell(document.getElementById("startCell").value) || { row: 1, col: 0 };
  const end = parseCell(document.getElementById("endCell").value) || { row: 26, col: 25 };

  const reverse = document.getElementById("reverse").checked;

  let rowRange = [];
  for (let r = start.row; r <= end.row; r++) rowRange.push(r);

  let colRange = [];
  for (let c = start.col; c <= end.col; c++) colRange.push(c);

  if (reverse) {
    rowRange.reverse();
    colRange.reverse();
  }

  for (let t = 0; t < repeatTable; t++) {
    for (let r of rowRange) {
      if (!isReading) return;

      const row = table.rows[r + 1];

      for (let rr = 0; rr < repeatRow; rr++) {

        for (let c of colRange) {
          if (!isReading) return;

          const cell = row.cells[c + 1];
          const text = cell.innerText;

          const selector = table.rows[1].cells[c + 1].querySelector("select");
          const lang = selector.value;

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
// SAVE TABLE AS JSON (FULL FEATURE)
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
}

// Build table JSON
function exportTableData() {
  const table = document.getElementById("sheet");

  const data = [];
  const selectors = [];

  // language selector row is index 1
  const selectorRow = table.rows[1];

  for (let r = 2; r < table.rows.length; r++) {
    const row = table.rows[r];
    const rowData = [];

    for (let c = 1; c < row.cells.length; c++) {
      const cell = row.cells[c];
      const selector = selectorRow.cells[c].querySelector("select");

      rowData.push({
        value: cell.innerText,
        lang: selector ? selector.value : "Off"
      });
    }

    data.push(rowData);
  }

  return {
    createdAt: new Date().toISOString(),
    columns: 26,
    rows: 26,
    data
  };
}

// Download JSON file
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

  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ===============================
// SAVE DIALOG (POPUP)
// ===============================
function openSaveDialog(defaultName, onConfirm) {
  const overlay = document.createElement("div");
  overlay.style = `
    position:fixed;
    top:0;left:0;
    width:100%;height:100%;
    background:rgba(0,0,0,0.4);
    display:flex;
    align-items:center;
    justify-content:center;
    z-index:9999;
  `;

  const box = document.createElement("div");
  box.style = `
    background:white;
    padding:20px;
    border-radius:8px;
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
    </div>
  `;

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  document.getElementById("cancelSave").onclick = () => {
    overlay.remove();
  };

  document.getElementById("confirmSave").onclick = () => {
    const name = document.getElementById("saveFileName").value.trim();
    overlay.remove();
    onConfirm(name || defaultName);
  };
}

// ===============================
// MAIN SAVE FUNCTION
// ===============================
function saveTable() {
  const autoName = `language-table_${getTimestamp()}.json`;
  const data = exportTableData();

  openSaveDialog(autoName, (filename) => {
    downloadJSON(filename.endsWith(".json") ? filename : filename + ".json", data);
  });
}

// ===============================
// CONNECT BUTTON
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.querySelector("header button");
  if (btn) {
    btn.onclick = saveTable;
  }
});


