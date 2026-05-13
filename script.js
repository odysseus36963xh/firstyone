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
  speaking: false
};

// ===============================
// SPEECH ENGINE
// ===============================

function speak(text, speed = 1) {
  return new Promise(resolve => {
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
  const col = cell.charCodeAt(0) - 65;
  const row = parseInt(cell.slice(1)) - 1;
  return { row, col };
}

function getCell(row, col) {
  return document.querySelectorAll("#sheet tr")[row + 2]
    ?.children[col + 1];
}

// ===============================
// READ CELL
// ===============================

async function readCell(row, col) {
  const cell = getCell(row, col);
  if (!cell) return;

  const text = cell.innerText.trim();
  if (!text) return;

  const repeat = state.repeatCell;

  for (let i = 0; i < repeat; i++) {
    await speak(text, state.speed);
  }
}

// ===============================
// READ ROW
// ===============================

async function readRow(row) {
  const order = [...Array(cols).keys()];

  if (state.reverse) order.reverse();

  for (let c of order) {
    await readCell(row, c);
  }

  for (let i = 1; i < state.repeatRow; i++) {
    for (let c of order) {
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

  const start = cellToIndex(state.startCell);
  const end = cellToIndex(state.endCell);

  const rowOrder = [];

  for (let r = start.row; r <= end.row; r++) {
    rowOrder.push(r);
  }

  if (state.reverse) rowOrder.reverse();

  for (let loop = 0; loop < state.repeatTable; loop++) {
    for (let r of rowOrder) {
      await readRow(r);
    }
  }

  state.speaking = false;
}

// ===============================
// EVENT BINDING
// ===============================

// Hook toolbar inputs if they exist
window.addEventListener("DOMContentLoaded", () => {
  const toolbar = document.getElementById("toolbar");

  if (!toolbar) return;

  const inputs = toolbar.querySelectorAll("input");

  inputs.forEach(input => {
    input.addEventListener("input", () => {
      const label = input.closest("label")?.innerText.toLowerCase();

      if (!label) return;

      if (label.includes("speed")) state.speed = input.value;
      if (label.includes("repeat row")) state.repeatRow = +input.value;
      if (label.includes("repeat table")) state.repeatTable = +input.value;
      if (label.includes("repeat cell")) state.repeatCell = +input.value;
      if (label.includes("start")) state.startCell = input.value.toUpperCase();
      if (label.includes("end")) state.endCell = input.value.toUpperCase();
      if (input.type === "checkbox") state.reverse = input.checked;
    });
  });
});

// ===============================
// BUTTONS (you can connect later)
// ===============================

// expose for HTML buttons
window.readTable = readTable;

// placeholder save
window.saveTable = function () {
  const data = [];

  document.querySelectorAll("#sheet tr").forEach((row, i) => {
    const rowData = [];

    row.querySelectorAll("td").forEach(cell => {
      rowData.push(cell.innerText);
    });

    if (rowData.length) data.push(rowData);
  });

  localStorage.setItem("sheetData", JSON.stringify(data));
  alert("Saved!");
};

// placeholder load
window.loadTable = function () {
  const data = JSON.parse(localStorage.getItem("sheetData") || "[]");

  const rows = document.querySelectorAll("#sheet tr");

  data.forEach((row, r) => {
    row.forEach((val, c) => {
      const cell = rows[r + 2]?.children[c + 1];
      if (cell) cell.innerText = val;
    });
  });
};
