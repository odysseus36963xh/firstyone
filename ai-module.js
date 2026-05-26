// ===============================
// LIGHTWEIGHT AI MODULE
// GitHub Pages Friendly
// Uses LibreTranslate API
// NO Xenova
// NO WASM downloads
// NO browser crashes
// ===============================

class SpreadsheetAI {
  constructor(tableElement) {
    this.table = tableElement;
    this.isRunning = false;
    this.stopRequested = false;
    this.isLoaded = false;

    // FREE PUBLIC ENDPOINT
    // You can replace later with your own server
    this.API_URL = "https://libretranslate.de/translate";

    // UI Elements
    this.statusEl = document.getElementById('aiStatus');
    this.progressEl = document.getElementById('aiProgress');
    this.progressFill = document.getElementById('aiProgressFill');
    this.progressText = document.getElementById('aiProgressText');
    this.currentCellEl = document.getElementById('aiCurrentCell');
    this.stopBtn = document.getElementById('aiStop');
    this.commandStatus = document.getElementById('aiCommandStatus');
    this.executeBtn = document.getElementById('aiExecute');
    this.commandInput = document.getElementById('aiCommand');
    this.activateBtn = document.getElementById('aiActivate');
    this.toggleBtn = document.getElementById('aiToggle');
    this.closeBtn = document.getElementById('aiClose');
    this.panel = document.getElementById('aiPanel');

    this.languageMap = {
      english: 'en',
      spanish: 'es',
      espanol: 'es',
      french: 'fr',
      german: 'de',
      italian: 'it',
      portuguese: 'pt',
      dutch: 'nl',
      russian: 'ru',

      en: 'en',
      es: 'es',
      fr: 'fr',
      de: 'de',
      it: 'it',
      pt: 'pt',
      nl: 'nl',
      ru: 'ru'
    };

    this.initUI();
  }

  // ===============================
  // UI INIT
  // ===============================
  initUI() {

    if (this.activateBtn) {
      this.activateBtn.onclick = () => this.activateAI();
    }

    if (this.toggleBtn) {
      this.toggleBtn.onclick = () => {
        this.panel.classList.toggle('active');
      };
    }

    if (this.closeBtn) {
      this.closeBtn.onclick = () => {
        this.panel.classList.remove('active');
      };
    }

    if (this.executeBtn) {
      this.executeBtn.onclick = () => this.executeCommand();
    }

    if (this.commandInput) {
      this.commandInput.addEventListener('keydown', (e) => {

        // CTRL + ENTER
        if (e.ctrlKey && e.key === 'Enter') {
          e.preventDefault();
          this.executeCommand();
        }
      });
    }

    if (this.stopBtn) {
      this.stopBtn.onclick = () => {
        this.stopRequested = true;
        this.progressText.textContent = '⏹ Stopping...';
      };
    }

    this.setStatus('Click "Turn On AI"');
  }

  // ===============================
  // ACTIVATE
  // ===============================
  async activateAI() {

    this.isLoaded = true;

    this.activateBtn.textContent = '✅ AI Ready';
    this.activateBtn.style.background = '#28a745';

    this.toggleBtn.classList.add('active');

    this.executeBtn.disabled = false;

    this.panel.classList.add('active');

    this.setStatus('✅ Ready');

    this.setCommandStatus(
      'Example: translate column a to column b spanish'
    );
  }

  // ===============================
  // STATUS HELPERS
  // ===============================
  setStatus(msg) {
    if (this.statusEl) {
      this.statusEl.textContent = msg;
    }
  }

  setCommandStatus(msg) {
    if (this.commandStatus) {
      this.commandStatus.classList.add('active');
      this.commandStatus.textContent = msg;
    }
  }

  showProgress(label) {

    this.progressEl.classList.add('active');

    this.progressFill.style.width = '0%';

    this.progressText.textContent = label;

    this.stopBtn.style.display = 'block';
  }

  hideProgress() {

    setTimeout(() => {

      this.progressEl.classList.remove('active');

      this.stopBtn.style.display = 'none';

    }, 1000);
  }

  updateProgress(done, total, text, row) {

    const pct = Math.round((done / total) * 100);

    this.progressFill.style.width = pct + '%';

    this.progressText.textContent =
      `Row ${row} • ${done}/${total} (${pct}%)`;

    this.currentCellEl.textContent =
      text.length > 50
        ? text.substring(0, 50) + '...'
        : text;
  }

  // ===============================
  // CELL HELPERS
  // ===============================
  getCellText(colIndex, rowIndex) {

    const row = this.table.rows[rowIndex];

    if (!row) return '';

    const cell = row.cells[colIndex + 1];

    return cell ? cell.textContent.trim() : '';
  }

  setCellText(colIndex, rowIndex, value) {

    const row = this.table.rows[rowIndex];

    if (!row) return;

    const cell = row.cells[colIndex + 1];

    if (cell) {
      cell.textContent = value;
    }
  }

  markCell(colIndex, rowIndex, processing = true) {

    const row = this.table.rows[rowIndex];

    if (!row) return;

    const cell = row.cells[colIndex + 1];

    if (!cell) return;

    if (processing) {

      cell.classList.add('cell-processing');

    } else {

      cell.classList.remove('cell-processing');

      cell.classList.add('cell-completed');

      setTimeout(() => {
        cell.classList.remove('cell-completed');
      }, 1200);
    }
  }


  

  // ===============================
  // COMMAND PARSER
  // ===============================
interpretCommand(command) {

  const cmd = command.toLowerCase();

  if (cmd.includes('delete column')) {

    const match =
      cmd.match(/delete column\s+([a-z])/i);

    return {
      action: 'delete_column',
      targetColumn:
        match[1].toUpperCase().charCodeAt(0) - 65
    };
  }

  if (cmd.includes('clear')) {

    const match =
      cmd.match(/([a-z]+\d+):([a-z]+\d+)/i);

    return {
      action: 'clear_range',
      range: match[0].toUpperCase()
    };
  }

  if (cmd.includes('rewrite')) {

    return {
      action: 'rewrite'
    };
  }

  if (cmd.includes('summarize')) {

    return {
      action: 'summarize'
    };
  }

  if (cmd.includes('translate')) {

    const match = cmd.match(
      /(?:column\s*)?([a-z])\s*(?:to|into)\s*(?:column\s*)?([a-z])/i
    );

    let targetLang = 'en';

    for (const [name, code]
      of Object.entries(this.languageMap)) {

      if (cmd.includes(name)) {
        targetLang = code;
      }
    }

    return {

      action: 'translate',

      fromCol:
        match[1].toUpperCase().charCodeAt(0) - 65,

      toCol:
        match[2].toUpperCase().charCodeAt(0) - 65,

      targetLang
    };
  }

  return {
    error: 'Unknown command'
  };
}

parseRange(range) {

  const match =
    range.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/i);

  return {

    startCol:
      match[1].charCodeAt(0) - 65,

    startRow:
      parseInt(match[2]),

    endCol:
      match[3].charCodeAt(0) - 65,

    endRow:
      parseInt(match[4])
  };
}

clearRange(range) {

  const r = this.parseRange(range);

  for (let row = r.startRow;
       row <= r.endRow;
       row++) {

    for (let col = r.startCol;
         col <= r.endCol;
         col++) {

      const cell =
        this.table.rows[row + 1]
        ?.cells[col + 1];

      if (cell) {
        cell.textContent = '';
      }
    }
  }
}

deleteColumn(colIndex) {

  for (let row = 0;
       row < this.table.rows.length;
       row++) {

    const r = this.table.rows[row];

    if (r.cells[colIndex + 1]) {
      r.deleteCell(colIndex + 1);
    }
  }
}

async executeCommand() {

  if (this.isRunning) return;

  const command =
    this.commandInput.value.trim();

  const parsed =
    this.interpretCommand(command);

  if (parsed.action === 'delete_column') {

    this.deleteColumn(
      parsed.targetColumn
    );

    this.setCommandStatus(
      '✅ Column deleted'
    );

    return;
  }

  if (parsed.action === 'clear_range') {

    this.clearRange(
      parsed.range
    );

    this.setCommandStatus(
      '✅ Cells cleared'
    );

    return;
  }

  if (parsed.action === 'rewrite') {

    this.setCommandStatus(
      '✅ Rewrite detected'
    );

    return;
  }

  if (parsed.action === 'summarize') {

    this.setCommandStatus(
      '✅ Summarize detected'
    );

    return;
  }

  if (parsed.action === 'translate') {

    await this.translateColumn(
      parsed.fromCol,
      parsed.toCol,
      parsed.targetLang
    );

    return;
  }
}
  // ===============================
  // API TRANSLATION
  // ===============================
  async translateText(text, targetLang = 'es') {

    const response = await fetch(this.API_URL, {

      method: 'POST',

      headers: {
        'Content-Type': 'application/json'
      },

      body: JSON.stringify({

        q: text,

        source: 'auto',

        target: targetLang,

        format: 'text'
      })
    });

    if (!response.ok) {
      throw new Error('Translation failed');
    }

    const data = await response.json();

    return data.translatedText;
  }

  // ===============================
  // TRANSLATE COLUMN
  // ===============================
  async translateColumn(fromCol, toCol, targetLang) {

    this.isRunning = true;

    this.stopRequested = false;

    const tasks = [];

    // START AT ROW 2
    for (let r = 2; r < this.table.rows.length; r++) {

      const text = this.getCellText(fromCol, r);

      if (text) {

        tasks.push({
          row: r,
          text
        });
      }
    }

    if (!tasks.length) {

      this.setCommandStatus(
        '⚠️ No text found in source column'
      );

      this.isRunning = false;

      return;
    }

    this.showProgress(
      `Translating ${tasks.length} cells`
    );

    let completed = 0;

    // ONE BY ONE
    // avoids crashes
    for (const task of tasks) {

      if (this.stopRequested) break;

      try {

        this.markCell(toCol, task.row, true);

        this.updateProgress(
          completed + 1,
          tasks.length,
          task.text,
          task.row - 1
        );

        const translated = await this.translateText(
          task.text,
          targetLang
        );

        this.setCellText(
          toCol,
          task.row,
          translated
        );

        this.markCell(toCol, task.row, false);

        completed++;

      } catch (err) {

        console.error(err);

        this.setCellText(
          toCol,
          task.row,
          '[Translation Error]'
        );
      }

      // tiny delay
      await this.delay(80);
    }

    this.setStatus(
      `✅ Finished ${completed} translations`
    );

    this.setCommandStatus(
      `✅ Done! ${completed} translated`
    );

    this.hideProgress();

    this.isRunning = false;
  }

  // ===============================
  // UTIL
  // ===============================
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ===============================
// START AI
// ===============================
const aiTable = document.getElementById('sheet');

if (aiTable) {

  new SpreadsheetAI(aiTable);

} else {

  console.error('Sheet table not found');
}
