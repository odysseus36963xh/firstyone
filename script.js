// ===============================
// SPEECH SHEET ENGINE
// ===============================

const rows = 26;
const cols = 26;

// ===============================
// STATE
// ===============================

const state = {
  speed: 1,
  repeatRow: 1,
  repeatTable: 1,
  repeatCell: 1,
  startCell: "A1",
  endCell: "Z26",
  reverse: false,
  speaking: false,
  stopped: false
};

// ===============================
// SPEECH ENGINE
// ===============================

function speak(text, speed = 1) {
  return new Promise(resolve => {

    if (state.stopped) {
      resolve();
      return;
    }

    const utter = new SpeechSynthesisUtterance(text);

    utter.rate = speed;

    utter.onend = () => resolve();

    speechSynthesis.speak(utter);
  });
}

// ===============================
// CELL PARSING
// ===============================

function cellToIndex(cell) {

  cell = cell.toUpperCase().trim();

  const col = cell.charCodeAt(0) - 65;
  const row = parseInt(cell.slice(1)) - 1;

  return { row, col };
}

function getCell(row, col) {

  return document.querySelectorAll("#sheet tr")[row + 2]
    ?.children[col + 1];
}

// ===============================
// HIGHLIGHT
// ===============================

function clearHighlights() {
  document.querySelectorAll(".reading")
    .forEach(cell => cell.classList.remove("reading"));
}

function highlightCell(cell) {
  clearHighlights();

  if (cell) {
    cell.classList.add("reading");
    cell.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "center"
    });
  }
}

// ===============================
// READ CELL
// ===============================

async function readCell(row, col) {

  if (state.stopped) return;

  const cell = getCell(row, col);

  if (!cell) return;

  const text = cell.innerText.trim();

  if (!text) return;

  // LIGHT UP CELL
  clearHighlights();

  cell.classList.add("active-cell");

  // auto-scroll
  cell.scrollIntoView({
    behavior: "smooth",
    block: "center",
    inline: "center"
  });

  // repeat speaking
  for (let i = 0; i < state.repeatCell; i++) {

    if (state.stopped) return;

    await speak(text, state.speed);
  }

  // remove highlight AFTER speech finishes
  cell.classList.remove("active-cell");
}

// ===============================
// READ ROW
// ===============================

async function readRow(row, startCol, endCol) {

  let order = [];

  for (let c = startCol; c <= endCol; c++) {
    order.push(c);
  }

  if (state.reverse) {
    order.reverse();
  }

  for (let loop = 0; loop < state.repeatRow; loop++) {

    for (let c of order) {

      if (state.stopped) return;

      await readCell(row, c);
    }
  }
}

// ===============================
// READ TABLE
// ===============================

async function readTable() {

  if (state.speaking) return;

  state.speaking = true;
  state.stopped = false;

  const start = cellToIndex(state.startCell);
  const end = cellToIndex(state.endCell);

  let rowOrder = [];

  for (let r = start.row; r <= end.row; r++) {
    rowOrder.push(r);
  }

  if (state.reverse) {
    rowOrder.reverse();
  }

  for (let tableLoop = 0;
       tableLoop < state.repeatTable;
       tableLoop++) {

    for (let r of rowOrder) {

      if (state.stopped) break;

      await readRow(r, start.col, end.col);
    }
  }

  clearHighlights();

  state.speaking = false;
}

// ===============================
// STOP
// ===============================

function stopReading() {

  state.stopped = true;
  state.speaking = false;

  speechSynthesis.cancel();

  clearHighlights();
}

// ===============================
// SAVE
// ===============================

function saveTable() {

  const data = [];

  document.querySelectorAll("#sheet tr").forEach((row, i) => {

    const rowData = [];

    row.querySelectorAll("td").forEach(cell => {
      rowData.push(cell.innerText);
    });

    if (rowData.length) {
      data.push(rowData);
    }
  });

  localStorage.setItem(
    "sheetData",
    JSON.stringify(data)
  );

  alert("Saved!");
}

// ===============================
// LOAD
// ===============================

function loadTable() {

  const data = JSON.parse(
    localStorage.getItem("sheetData") || "[]"
  );

  const rows = document.querySelectorAll("#sheet tr");

  data.forEach((row, r) => {

    row.forEach((val, c) => {

      const cell = rows[r + 2]?.children[c + 1];

      if (cell) {
        cell.innerText = val;
      }
    });
  });

  alert("Loaded!");
}

// ===============================
// TOOLBAR BINDINGS
// ===============================

window.addEventListener("DOMContentLoaded", () => {

  document.getElementById("speedInput")
    .addEventListener("input", e => {
      state.speed = parseFloat(e.target.value);
    });

  document.getElementById("repeatRowInput")
    .addEventListener("input", e => {
      state.repeatRow = +e.target.value;
    });

  document.getElementById("repeatTableInput")
    .addEventListener("input", e => {
      state.repeatTable = +e.target.value;
    });

  document.getElementById("repeatCellInput")
    .addEventListener("input", e => {
      state.repeatCell = +e.target.value;
    });

  document.getElementById("startCellInput")
    .addEventListener("input", e => {
      state.startCell = e.target.value.toUpperCase();
    });

  document.getElementById("endCellInput")
    .addEventListener("input", e => {
      state.endCell = e.target.value.toUpperCase();
    });

  document.getElementById("reverseInput")
    .addEventListener("change", e => {
      state.reverse = e.target.checked;
    });
});

// expose globally
window.readTable = readTable;
window.stopReading = stopReading;
window.saveTable = saveTable;
window.loadTable = loadTable;
