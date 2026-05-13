let isReading = false;
let voices = [];

speechSynthesis.onvoiceschanged = () => {
  voices = speechSynthesis.getVoices();
};

// fallback in case already loaded
voices = speechSynthesis.getVoices();

function colToIndex(col) {
  return col.toUpperCase().charCodeAt(0) - 65;
}

function parseCell(ref) {
  if (!ref) return null;
  const match = ref.match(/^([A-Z]+)(\d+)$/i);
  if (!match) return null;

  return {
    col: colToIndex(match[1]),
    row: parseInt(match[2])
  };
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

  const speed = parseFloat(document.querySelector('#toolbar input[type="range"]')?.value || 1);

  const repeatRow = parseInt(document.querySelectorAll('#toolbar input[type="number"]')[0]?.value || 1);
  const repeatTable = parseInt(document.querySelectorAll('#toolbar input[type="number"]')[1]?.value || 1);
  const repeatCell = parseInt(document.querySelectorAll('#toolbar input[type="number"]')[2]?.value || 1);

  const startRef = document.querySelector('#toolbar input[type="text"]:nth-of-type(1)')?.value;
  const endRef = document.querySelector('#toolbar input[type="text"]:nth-of-type(2)')?.value;

  const reverse = document.querySelector('#toolbar input[type="checkbox"]')?.checked;

  const start = parseCell(startRef) || { row: 1, col: 0 };
  const end = parseCell(endRef) || { row: 26, col: 25 };

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

      for (let rr = 0; rr < repeatRow; rr++) {
        const row = table.rows[r + 1]; // offset for header

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
