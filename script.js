// ===============================
// SPEECH TABLE SYSTEM
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
// DOM
// ===============================

const table = document.getElementById("sheet");

// ===============================
// COLUMN NAME
// ===============================

function colName(n) {
  return String.fromCharCode(65 + n);
}

// ===============================
// BUILD TABLE
// ===============================

function buildTable() {

  // HEADER ROW
  let header = "<tr><th></th>";

  for (let c = 0; c < cols; c++) {
    header += `<th>${colName(c)}</th>`;
  }

  header += "</tr>";

  // LANGUAGE SELECTOR ROW
  let selector = "<tr><th></th>";

  for (let c = 0; c < cols; c++) {

    selector += `
    <th>
      <select class="col-select">
        <option>Off</option>
        <option>EN</option>
        <option>IT</option>
        <option>ES</option>
        <option>FR</option>
        <option>DE</option>
      </select>
    </th>`;
  }

  selector += "</tr>";

  table.innerHTML = header + selector;

  // DATA ROWS
  for (let r = 1; r <= rows; r++) {

    let row = `<tr>
      <th class="row-head">${r}</th>`;

    for (let c = 0; c < cols; c++) {
      row += `<td contenteditable="true"></td>`;
    }

    row += "</tr>";

    table.innerHTML += row;
  }

  // UPLOAD COLUMN OPTIONS
  const uploadSelect =
    document.getElementById("uploadColumn");

  for (let c = 0; c < cols; c++) {

    const option =
      document.createElement("option");

    option.value = c;
    option.textContent =
      `Column ${colName(c)}`;

    uploadSelect.appendChild(option);
  }
}

// ===============================
// UI TOGGLES
// ===============================

function toggleUpload() {

  const box =
    document.getElementById("uploadBox");

  box.style.display =
    box.style.display === "block"
      ? "none"
      : "block";
}

function toggleReader() {

  const bar =
    document.getElementById("toolbar");

  bar.style.display =
    bar.style.display === "flex"
      ? "none"
      : "flex";
}

// expose globally
window.toggleUpload = toggleUpload;
window.toggleReader = toggleReader;

// ===============================
// CELL HELPERS
// ===============================

function cellToIndex(cell) {

  const clean =
    cell.toUpperCase().trim();

  const col =
    clean.charCodeAt(0) - 65;

  const row =
    parseInt(clean.slice(1)) - 1;

  return { row, col };
}

function getCell(row, col) {

  return document
    .querySelectorAll("#sheet tr")
    [row + 2]
    ?.children[col + 1];
}

// ===============================
// HIGHLIGHT
// ===============================

function clearHighlights() {

  document
    .querySelectorAll(".active-cell")
    .forEach(cell => {
      cell.classList.remove("active-cell");
    });
}

// ===============================
// SPEECH
// ===============================

function speak(text, speed = 1) {

  return new Promise(resolve => {

    if (state.stopped) {
      resolve();
      return;
    }

    const utter =
      new SpeechSynthesisUtterance(text);

    utter.rate = speed;

    utter.onend = () => {
      resolve();
    };

    utter.onerror = () => {
      resolve();
    };

    speechSynthesis.speak(utter);
  });
}

// ===============================
// READ CELL
// ===============================

async function readCell(row, col) {

  if (state.stopped) return;

  const cell =
    getCell(row, col);

  if (!cell) return;

  const text =
    cell.innerText.trim();

  if (!text) return;

  // HIGHLIGHT
  clearHighlights();

  cell.classList.add("active-cell");

  // AUTO SCROLL
  cell.scrollIntoView({
    behavior: "smooth",
    block: "center",
    inline: "center"
  });

  // REPEAT CELL
  for (
    let i = 0;
    i < state.repeatCell;
    i++
  ) {

    if (state.stopped) return;

    await speak(
      text,
      state.speed
    );
  }

  cell.classList.remove("active-cell");
}

// ===============================
// READ ROW
// ===============================

async function readRow(
  row,
  startCol,
  endCol
) {

  let order = [];

  for (
    let c = startCol;
    c <= endCol;
    c++
  ) {
    order.push(c);
  }

  if (state.reverse) {
    order.reverse();
  }

  for (
    let repeat = 0;
    repeat < state.repeatRow;
    repeat++
  ) {

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

  document
    .getElementById("startBtn")
    .disabled = true;

  const start =
    cellToIndex(state.startCell);

  const end =
    cellToIndex(state.endCell);

  let rowOrder = [];

  for (
    let r = start.row;
    r <= end.row;
    r++
  ) {
    rowOrder.push(r);
  }

  if (state.reverse) {
    rowOrder.reverse();
  }

  for (
    let loop = 0;
    loop < state.repeatTable;
    loop++
  ) {

    for (let r of rowOrder) {

      if (state.stopped) break;

      await readRow(
        r,
        start.col,
        end.col
      );
    }
  }

  finishReading();
}

// ===============================
// STOP
// ===============================

function stopReading() {

  state.stopped = true;

  speechSynthesis.cancel();

  finishReading();
}

function finishReading() {

  state.speaking = false;

  clearHighlights();

  document
    .getElementById("startBtn")
    .disabled = false;
}

// expose globally
window.readTable = readTable;
window.stopReading = stopReading;

// ===============================
// SAVE
// ===============================

function saveTable() {

  const data = [];

  document
    .querySelectorAll("#sheet tr")
    .forEach((row, i) => {

      if (i < 2) return;

      const rowData = [];

      row.querySelectorAll("td")
      .forEach(cell => {

        rowData.push(
          cell.innerText
        );
      });

      data.push(rowData);
    });

  localStorage.setItem(
    "sheetData",
    JSON.stringify(data)
  );

  alert("Saved!");
}

window.saveTable = saveTable;

// ===============================
// LOAD
// ===============================

function loadTable() {

  const data =
    JSON.parse(
      localStorage.getItem("sheetData")
      || "[]"
    );

  const rowsDOM =
    document.querySelectorAll("#sheet tr");

  data.forEach((row, r) => {

    row.forEach((val, c) => {

      const cell =
        rowsDOM[r + 2]
        ?.children[c + 1];

      if (cell) {
        cell.innerText = val;
      }
    });
  });

  alert("Loaded!");
}

window.loadTable = loadTable;

// ===============================
// UPLOAD COLUMN
// ===============================

function uploadColumnData() {

  const textarea =
    document.getElementById("uploadText");

  const select =
    document.getElementById("uploadColumn");

  const lines =
    textarea.value.split("\n");

  const col =
    parseInt(select.value);

  lines.forEach((line, rowIndex) => {

    const cell =
      getCell(rowIndex, col);

    if (cell) {
      cell.innerText =
        line.trim();
    }
  });
}

window.uploadColumnData =
  uploadColumnData;

// ===============================
// INPUT BINDINGS
// ===============================

function bindInputs() {

  document
    .getElementById("speedInput")
    .addEventListener("input", e => {

      state.speed =
        parseFloat(e.target.value);
    });

  document
    .getElementById("repeatRowInput")
    .addEventListener("input", e => {

      state.repeatRow =
        +e.target.value || 1;
    });

  document
    .getElementById("repeatTableInput")
    .addEventListener("input", e => {

      state.repeatTable =
        +e.target.value || 1;
    });

  document
    .getElementById("repeatCellInput")
    .addEventListener("input", e => {

      state.repeatCell =
        +e.target.value || 1;
    });

  document
    .getElementById("startCellInput")
    .addEventListener("input", e => {

      state.startCell =
        e.target.value.toUpperCase();
    });

  document
    .getElementById("endCellInput")
    .addEventListener("input", e => {

      state.endCell =
        e.target.value.toUpperCase();
    });

  document
    .getElementById("reverseInput")
    .addEventListener("change", e => {

      state.reverse =
        e.target.checked;
    });
}

// ===============================
// INIT
// ===============================

window.addEventListener(
  "DOMContentLoaded",
  () => {

    buildTable();

    bindInputs();
  }
);
