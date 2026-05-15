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


document.getElementById("openFinder").addEventListener("click", () => {

    const newTab = window.open("", "_blank");

    newTab.document.write(`
<!DOCTYPE html>
<html lang="en">

<head>
<meta charset="UTF-8">
<title>Frequency Finder</title>

<style>

body{
    font-family:Arial,sans-serif;
    background:#101010;
    color:white;
    padding:20px;
}

textarea{
    width:100%;
    height:300px;
    padding:15px;
    font-size:16px;
    border-radius:10px;
    border:none;
    resize:vertical;
    margin-top:10px;
}

input{
    padding:10px;
    width:260px;
    font-size:16px;
    border:none;
    border-radius:8px;
    margin-top:10px;
}

button{
    background:#2b7cff;
    color:white;
    border:none;
    padding:12px 20px;
    border-radius:10px;
    cursor:pointer;
    font-size:17px;
    margin-top:10px;
}

button:hover{
    background:#1e63da;
}

table{
    width:100%;
    border-collapse:collapse;
    margin-top:25px;
    background:#1a1a1a;
}

th, td{
    border:1px solid #333;
    padding:12px;
    text-align:left;
}

th{
    background:#222;
}

tr:nth-child(even){
    background:#151515;
}

h1{
    color:#61a8ff;
}

.small{
    color:#bbb;
    margin-bottom:15px;
}

</style>

</head>

<body>

<h1>Frequency Finder</h1>

<div class="small">
Works with English, Arabic, Chinese, Hindi, Russian, Georgian, and most world alphabets.
</div>

<div style="margin-top:20px;">

<button id="toggleLanguages"
style="
background:#28a745;
color:white;
border:none;
padding:10px 18px;
border-radius:8px;
cursor:pointer;
font-size:16px;
">
Show Compatible Languages
</button>

<div id="languageBox"
style="
display:none;
margin-top:15px;
max-height:350px;
overflow-y:auto;
border:1px solid #333;
border-radius:10px;
">

<table style="
width:100%;
border-collapse:collapse;
background:#181818;
color:white;
">

<thead>
<tr>
<th style="padding:10px;border:1px solid #333;">Language</th>
<th style="padding:10px;border:1px solid #333;">Script</th>
<th style="padding:10px;border:1px solid #333;">Example</th>
</tr>
</thead>

<tbody>

<tr><td>English</td><td>Latin</td><td>Hello world</td></tr>
<tr><td>Spanish</td><td>Latin</td><td>Hola mundo</td></tr>
<tr><td>French</td><td>Latin</td><td>Bonjour monde</td></tr>
<tr><td>German</td><td>Latin</td><td>Hallo Welt</td></tr>
<tr><td>Italian</td><td>Latin</td><td>Ciao mondo</td></tr>
<tr><td>Portuguese</td><td>Latin</td><td>Olá mundo</td></tr>
<tr><td>Dutch</td><td>Latin</td><td>Hallo wereld</td></tr>
<tr><td>Polish</td><td>Latin</td><td>Witaj świecie</td></tr>
<tr><td>Turkish</td><td>Latin</td><td>Merhaba dünya</td></tr>
<tr><td>Vietnamese</td><td>Latin</td><td>Xin chào</td></tr>

<tr><td>Russian</td><td>Cyrillic</td><td>Привет мир</td></tr>
<tr><td>Ukrainian</td><td>Cyrillic</td><td>Привіт світ</td></tr>
<tr><td>Bulgarian</td><td>Cyrillic</td><td>Здравей свят</td></tr>
<tr><td>Serbian</td><td>Cyrillic</td><td>Здраво свете</td></tr>

<tr><td>Arabic</td><td>Arabic</td><td>مرحبا بالعالم</td></tr>
<tr><td>Persian</td><td>Arabic</td><td>سلام دنیا</td></tr>
<tr><td>Urdu</td><td>Arabic</td><td>ہیلو دنیا</td></tr>

<tr><td>Hebrew</td><td>Hebrew</td><td>שלום עולם</td></tr>

<tr><td>Hindi</td><td>Devanagari</td><td>नमस्ते दुनिया</td></tr>
<tr><td>Sanskrit</td><td>Devanagari</td><td>नमस्ते</td></tr>
<tr><td>Marathi</td><td>Devanagari</td><td>नमस्कार</td></tr>
<tr><td>Nepali</td><td>Devanagari</td><td>नमस्ते</td></tr>

<tr><td>Chinese</td><td>Han</td><td>你好世界</td></tr>
<tr><td>Japanese</td><td>Kana/Kanji</td><td>こんにちは世界</td></tr>
<tr><td>Korean</td><td>Hangul</td><td>안녕하세요</td></tr>

<tr><td>Thai</td><td>Thai</td><td>สวัสดี</td></tr>
<tr><td>Lao</td><td>Lao</td><td>ສະບາຍດີ</td></tr>
<tr><td>Khmer</td><td>Khmer</td><td>សួស្តី</td></tr>

<tr><td>Georgian</td><td>Georgian</td><td>გამარჯობა</td></tr>
<tr><td>Armenian</td><td>Armenian</td><td>Բարեւ աշխարհ</td></tr>

<tr><td>Greek</td><td>Greek</td><td>Γειά σου κόσμε</td></tr>

<tr><td>Tamil</td><td>Tamil</td><td>வணக்கம்</td></tr>
<tr><td>Telugu</td><td>Telugu</td><td>హలో</td></tr>
<tr><td>Kannada</td><td>Kannada</td><td>ಹಲೋ</td></tr>
<tr><td>Malayalam</td><td>Malayalam</td><td>ഹലോ</td></tr>
<tr><td>Bengali</td><td>Bengali</td><td>হ্যালো</td></tr>
<tr><td>Punjabi</td><td>Gurmukhi</td><td>ਸਤ ਸ੍ਰੀ ਅਕਾਲ</td></tr>

<tr><td>Swahili</td><td>Latin</td><td>Habari dunia</td></tr>
<tr><td>Zulu</td><td>Latin</td><td>Sawubona</td></tr>

</tbody>

</table>

</div>

</div>

<textarea id="textInput"
placeholder="Paste large or small text here..."></textarea>

<br>

<input id="comboSize"
type="number"
min="1"
max="10"
value="1"
placeholder="Words per combo">

<br>

<button id="findBtn">Find Frequency</button>

<table id="resultTable">

<thead>
<tr>
<th>Word / Combination</th>
<th>Total Appearances</th>
<th>Percentage of Text</th>
</tr>
</thead>

<tbody></tbody>

</table>

<script>

function normalizeText(text){

    text = text.normalize("NFKC");

    text = text.replace(/[\\\\p{N}]/gu, " ");

    text = text.toLocaleLowerCase();

    text = text.replace(/[\\\\p{P}\\\\p{S}]/gu, " ");

    text = text.replace(/\\\\s+/g, " ").trim();

    return text;
}

function tokenize(text){

    const words = text.match(/[\\\\p{L}]+/gu);

    return words || [];
}

function generateCombinations(words, size){

    const combos = [];

    for(let i = 0; i <= words.length - size; i++){

        const combo = words.slice(i, i + size).join(" ");

        combos.push(combo);
    }

    return combos;
}

document.getElementById("findBtn")
.addEventListener("click", () => {

    const rawText =
        document.getElementById("textInput").value;

    const comboSize =
        parseInt(document.getElementById("comboSize").value) || 1;

    if(!rawText.trim()){

        alert("Please paste text first.");

        return;
    }

    const cleaned = normalizeText(rawText);

    const words = tokenize(cleaned);

    const units =
        generateCombinations(words, comboSize);

    const frequency = {};

    for(const unit of units){

        frequency[unit] =
            (frequency[unit] || 0) + 1;
    }

    const totalUnits = units.length;

    const sorted =
        Object.entries(frequency)
        .sort((a,b) => b[1] - a[1]);

    const tbody =
        document.querySelector("#resultTable tbody");

    tbody.innerHTML = "";

    sorted.forEach(([word, count]) => {

        const percentage =
            ((count / totalUnits) * 100).toFixed(4);

        const row =
            document.createElement("tr");

        row.innerHTML =
            "<td>" + word + "</td>" +
            "<td>" + count + "</td>" +
            "<td>" + percentage + "%</td>";

        tbody.appendChild(row);
    });

});

document.getElementById("toggleLanguages")
.addEventListener("click", () => {

    const box =
        document.getElementById("languageBox");

    if(box.style.display === "none"){

        box.style.display = "block";

    } else {

        box.style.display = "none";
    }

});

</script>

</body>
</html>
`);
