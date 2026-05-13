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
