// ===============================
// SPREADSHEET TRANSLATOR - FIXED VERSION
// GitHub Pages Friendly
// Uses MyMemory API (free & reliable)
// ===============================

class SpreadsheetTranslator {
  constructor(tableElement) {
    this.table = tableElement;
    this.isRunning = false;
    this.stopRequested = false;

    // MyMemory API - more reliable than LibreTranslate
    this.API_URL = "https://api.mymemory.translated.net/get";

    // Language map
    this.languages = {
      'Auto Detect': 'auto',
      'English': 'en',
      'Spanish': 'es',
      'French': 'fr',
      'German': 'de',
      'Italian': 'it',
      'Portuguese': 'pt',
      'Dutch': 'nl',
      'Russian': 'ru',
      'Chinese': 'zh',
      'Japanese': 'ja',
      'Korean': 'ko',
      'Arabic': 'ar',
      'Hindi': 'hi',
      'Turkish': 'tr',
      'Polish': 'pl',
      'Swedish': 'sv',
      'Greek': 'el',
      'Hebrew': 'he',
      'Thai': 'th'
    };

    // UI Elements - will be created dynamically
    this.panel = null;
    this.statusEl = null;
    
    this.createUI();
  }

  // ===============================
  // CREATE USER-FRIENDLY UI
  // ===============================
  createUI() {
    // Remove existing panel if any
    const existing = document.getElementById('translatorPanel');
    if (existing) existing.remove();

    // Create panel
    this.panel = document.createElement('div');
    this.panel.id = 'translatorPanel';
    this.panel.innerHTML = `
      <style>
        #translatorPanel {
          position: fixed;
          bottom: 20px;
          right: 20px;
          width: 380px;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          border-radius: 16px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.4);
          z-index: 99999;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #fff;
          overflow: hidden;
          transition: all 0.3s ease;
        }
        
        #translatorPanel.minimized {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          cursor: pointer;
        }
        
        #translatorPanel.minimized .translator-body {
          display: none;
        }
        
        #translatorPanel.minimized .translator-header {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          height: 60px;
        }
        
        #translatorPanel.minimized .translator-title {
          display: none;
        }
        
        #translatorPanel.minimized .translator-minimize {
          display: none;
        }
        
        .translator-header {
          background: linear-gradient(90deg, #e94560 0%, #ff6b6b 100%);
          padding: 15px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .translator-title {
          font-size: 16px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .translator-header-btns {
          display: flex;
          gap: 8px;
        }
        
        .translator-header-btns button {
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          width: 28px;
          height: 28px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          transition: background 0.2s;
        }
        
        .translator-header-btns button:hover {
          background: rgba(255,255,255,0.3);
        }
        
        .translator-body {
          padding: 20px;
        }
        
        .translator-section {
          margin-bottom: 18px;
        }
        
        .translator-label {
          font-size: 12px;
          color: #8892b0;
          margin-bottom: 6px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .translator-row {
          display: flex;
          gap: 10px;
          align-items: center;
        }
        
        .translator-select, .translator-input {
          flex: 1;
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.15);
          color: #fff;
          padding: 10px 12px;
          border-radius: 8px;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
        }
        
        .translator-select:focus, .translator-input:focus {
          border-color: #e94560;
        }
        
        .translator-select option {
          background: #1a1a2e;
          color: #fff;
        }
        
        .translator-arrow {
          color: #e94560;
          font-size: 18px;
          font-weight: bold;
        }
        
        .translator-btn {
          width: 100%;
          padding: 14px;
          background: linear-gradient(90deg, #e94560 0%, #ff6b6b 100%);
          border: none;
          color: white;
          font-size: 15px;
          font-weight: 600;
          border-radius: 10px;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        
        .translator-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 5px 20px rgba(233,69,96,0.4);
        }
        
        .translator-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .translator-btn.stop {
          background: linear-gradient(90deg, #ff4757 0%, #ff6b81 100%);
        }
        
        .translator-status {
          background: rgba(255,255,255,0.05);
          border-radius: 8px;
          padding: 12px;
          font-size: 13px;
          color: #8892b0;
          text-align: center;
          margin-top: 15px;
          min-height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .translator-status.active {
          color: #64ffda;
        }
        
        .translator-status.error {
          color: #ff6b6b;
        }
        
        .translator-progress {
          height: 4px;
          background: rgba(255,255,255,0.1);
          border-radius: 2px;
          margin-top: 12px;
          overflow: hidden;
          display: none;
        }
        
        .translator-progress.active {
          display: block;
        }
        
        .translator-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #e94560 0%, #64ffda 100%);
          width: 0%;
          transition: width 0.3s;
        }
        
        .translator-mode {
          display: flex;
          gap: 8px;
          margin-bottom: 18px;
        }
        
        .translator-mode-btn {
          flex: 1;
          padding: 10px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          color: #8892b0;
          border-radius: 8px;
          cursor: pointer;
          font-size: 13px;
          transition: all 0.2s;
        }
        
        .translator-mode-btn.active {
          background: rgba(233,69,96,0.2);
          border-color: #e94560;
          color: #fff;
        }
        
        .translator-cell-inputs {
          display: none;
        }
        
        .translator-cell-inputs.active {
          display: block;
        }
        
        .translator-help {
          font-size: 11px;
          color: #5a6a8a;
          margin-top: 8px;
        }
      </style>
      
      <div class="translator-header">
        <div class="translator-title">🌐 Translator</div>
        <div class="translator-header-btns">
          <button onclick="translator.toggleMinimize()" title="Minimize">−</button>
        </div>
      </div>
      
      <div class="translator-body">
        <!-- Mode Selection -->
        <div class="translator-mode">
          <button class="translator-mode-btn active" onclick="translator.setMode('column')">
            📊 Column → Column
          </button>
          <button class="translator-mode-btn" onclick="translator.setMode('cell')">
            📝 Cell → Cell
          </button>
        </div>
        
        <!-- Column Mode -->
        <div id="columnMode">
          <div class="translator-section">
            <div class="translator-label">From Column → To Column</div>
            <div class="translator-row">
              <select id="fromColumn" class="translator-select">
                <option value="0">A</option>
                <option value="1">B</option>
                <option value="2">C</option>
                <option value="3">D</option>
                <option value="4">E</option>
                <option value="5">F</option>
                <option value="6">G</option>
                <option value="7">H</option>
                <option value="8">I</option>
                <option value="9">J</option>
              </select>
              <span class="translator-arrow">→</span>
              <select id="toColumn" class="translator-select">
                <option value="1">B</option>
                <option value="0">A</option>
                <option value="2">C</option>
                <option value="3">D</option>
                <option value="4">E</option>
                <option value="5">F</option>
                <option value="6">G</option>
                <option value="7">H</option>
                <option value="8">I</option>
                <option value="9">J</option>
              </select>
            </div>
          </div>
        </div>
        
        <!-- Cell Mode -->
        <div id="cellMode" class="translator-cell-inputs">
          <div class="translator-section">
            <div class="translator-label">From Cell → To Cell</div>
            <div class="translator-row">
              <input type="text" id="fromCell" class="translator-input" placeholder="e.g., A1" maxlength="4">
              <span class="translator-arrow">→</span>
              <input type="text" id="toCell" class="translator-input" placeholder="e.g., B1" maxlength="4">
            </div>
            <div class="translator-help">Enter cell coordinates (e.g., A1, B2, C10)</div>
          </div>
        </div>
        
        <!-- Language Selection -->
        <div class="translator-section">
          <div class="translator-label">Translate To</div>
          <select id="targetLang" class="translator-select">
            ${Object.keys(this.languages).map(lang => 
              `<option value="${this.languages[lang]}" ${lang === 'Spanish' ? 'selected' : ''}>${lang}</option>`
            ).join('')}
          </select>
          <div class="translator-help">💡 Select "Auto Detect" to detect source language automatically</div>
        </div>
        
        <!-- Translate Button -->
        <button id="translateBtn" class="translator-btn" onclick="translator.startTranslation()">
          🔄 Translate
        </button>
        
        <!-- Progress -->
        <div id="progressBar" class="translator-progress">
          <div id="progressFill" class="translator-progress-fill"></div>
        </div>
        
        <!-- Status -->
        <div id="translatorStatus" class="translator-status">
          Ready to translate
        </div>
      </div>
    `;

    document.body.appendChild(this.panel);
    this.statusEl = document.getElementById('translatorStatus');
    this.mode = 'column';
  }

  // ===============================
  // MODE SELECTION
  // ===============================
  setMode(mode) {
    this.mode = mode;
    
    // Update buttons
    document.querySelectorAll('.translator-mode-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Show/hide appropriate inputs
    document.getElementById('columnMode').style.display = mode === 'column' ? 'block' : 'none';
    document.getElementById('cellMode').className = mode === 'cell' ? 'translator-cell-inputs active' : 'translator-cell-inputs';
  }

  toggleMinimize() {
    this.panel.classList.toggle('minimized');
  }

  // ===============================
  // STATUS HELPERS
  // ===============================
  setStatus(msg, type = '') {
    if (this.statusEl) {
      this.statusEl.textContent = msg;
      this.statusEl.className = 'translator-status ' + type;
    }
  }

  showProgress(show) {
    const bar = document.getElementById('progressBar');
    if (show) {
      bar.classList.add('active');
    } else {
      bar.classList.remove('active');
      document.getElementById('progressFill').style.width = '0%';
    }
  }

  updateProgress(pct) {
    document.getElementById('progressFill').style.width = pct + '%';
  }

  setRunning(running) {
    this.isRunning = running;
    const btn = document.getElementById('translateBtn');
    if (running) {
      btn.innerHTML = '⏹ Stop';
      btn.classList.add('stop');
      btn.onclick = () => this.stop();
    } else {
      btn.innerHTML = '🔄 Translate';
      btn.classList.remove('stop');
      btn.onclick = () => this.startTranslation();
    }
  }

  // ===============================
  // CELL HELPERS
  // ===============================
  colToIndex(col) {
    return col.toUpperCase().charCodeAt(0) - 65;
  }

  indexToCol(idx) {
    return String.fromCharCode(idx + 65);
  }

  parseCellRef(ref) {
    const match = ref.toUpperCase().match(/^([A-Z]+)(\d+)$/);
    if (!match) return null;
    return {
      col: this.colToIndex(match[1]),
      row: parseInt(match[2]) + 1 // +1 because row 1 is header
    };
  }

  getCellText(colIndex, rowIndex) {
    const row = this.table.rows[rowIndex];
    if (!row) return '';
    const cell = row.cells[colIndex + 1]; // +1 for row number column
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

  markCell(colIndex, rowIndex, className) {
    const row = this.table.rows[rowIndex];
    if (!row) return;
    const cell = row.cells[colIndex + 1];
    if (!cell) return;
    
    cell.classList.remove('cell-processing', 'cell-completed', 'cell-error');
    if (className) {
      cell.classList.add(className);
      setTimeout(() => cell.classList.remove(className), 2000);
    }
  }

  // ===============================
  // TRANSLATION API - MyMemory
  // ===============================
  async translateText(text, targetLang) {
    if (!text || text.trim() === '') return '';
    
    // Build URL - MyMemory uses "langpair" for auto-detect
    const url = `${this.API_URL}?q=${encodeURIComponent(text)}&langpair=auto|${targetLang}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.responseStatus === 200 && data.responseData) {
      return data.responseData.translatedText;
    } else {
      throw new Error(data.responseDetails || 'Translation failed');
    }
  }

  // ===============================
  // PARSING USER INPUT
  // ===============================
  parseCellInput(input) {
    // Clean input
    input = input.toUpperCase().trim();
    
    // Match patterns like "A1", "B10", "AA5"
    const match = input.match(/^([A-Z]{1,2})(\d+)$/);
    if (!match) return null;
    
    const colLetter = match[1];
    const rowNum = parseInt(match[2]);
    
    // Convert column letter to index (A=0, B=1, etc.)
    let colIndex = 0;
    for (let i = 0; i < colLetter.length; i++) {
      colIndex = colIndex * 26 + (colLetter.charCodeAt(i) - 64);
    }
    colIndex -= 1; // Make 0-based
    
    // Row: +1 because first row (index 0) is typically header
    const rowIndex = rowNum + 1;
    
    return { col: colIndex, row: rowIndex };
  }

  // ===============================
  // START TRANSLATION
  // ===============================
  async startTranslation() {
    if (this.isRunning) {
      this.stopRequested = true;
      return;
    }

    this.isRunning = true;
    this.stopRequested = false;
    this.setRunning(true);
    this.showProgress(true);

    try {
      if (this.mode === 'column') {
        await this.translateColumnMode();
      } else {
        await this.translateCellMode();
      }
    } catch (err) {
      this.setStatus('❌ ' + err.message, 'error');
    }

    this.setRunning(false);
    this.showProgress(false);
  }

  stop() {
    this.stopRequested = true;
    this.setStatus('⏹ Stopping...');
  }

  // ===============================
  // COLUMN TO COLUMN MODE
  // ===============================
  async translateColumnMode() {
    const fromCol = parseInt(document.getElementById('fromColumn').value);
    const toCol = parseInt(document.getElementById('toColumn').value);
    const targetLang = document.getElementById('targetLang').value;
    
    const fromLetter = this.indexToCol(fromCol);
    const toLetter = this.indexToCol(toCol);
    
    // Collect all text to translate
    const tasks = [];
    for (let r = 2; r < this.table.rows.length; r++) {
      const text = this.getCellText(fromCol, r);
      if (text && text.length > 0) {
        tasks.push({ row: r, text: text });
      }
    }

    if (tasks.length === 0) {
      this.setStatus('⚠️ No text found in column ' + fromLetter, 'error');
      return;
    }

    this.setStatus(`🔄 Translating ${tasks.length} cells from ${fromLetter} to ${toLetter}...`);

    let completed = 0;
    let errors = 0;

    for (const task of tasks) {
      if (this.stopRequested) {
        this.setStatus(`⏹ Stopped at row ${task.row - 1}`, 'error');
        break;
      }

      try {
        // Mark as processing
        this.markCell(toCol, task.row, 'cell-processing');
        this.updateProgress(Math.round((completed / tasks.length) * 100));
        this.setStatus(`🔄 Translating row ${task.row - 1}/${tasks.length - 1}...`);

        // Translate
        const translated = await this.translateText(task.text, targetLang);
        
        // Set result
        this.setCellText(toCol, task.row, translated);
        this.markCell(toCol, task.row, 'cell-completed');
        
        completed++;
        
        // Small delay to respect rate limits
        await this.delay(100);
        
      } catch (err) {
        console.error(`Error at row ${task.row}:`, err);
        errors++;
        this.setCellText(toCol, task.row, `[ERROR]`);
        this.markCell(toCol, task.row, 'cell-error');
      }
    }

    this.updateProgress(100);
    
    if (!this.stopRequested) {
      this.setStatus(`✅ Done! ${completed} translated, ${errors} errors`, 'active');
    }
  }

  // ===============================
  // CELL TO CELL MODE
  // ===============================
  async translateCellMode() {
    const fromCellInput = document.getElementById('fromCell').value;
    const toCellInput = document.getElementById('toCell').value;
    const targetLang = document.getElementById('targetLang').value;
    
    // Parse cell references
    const fromCell = this.parseCellInput(fromCellInput);
    const toCell = this.parseCellInput(toCellInput);
    
    if (!fromCell) {
      this.setStatus('❌ Invalid source cell (e.g., use A1)', 'error');
      return;
    }
    
    if (!toCell) {
      this.setStatus('❌ Invalid target cell (e.g., use B1)', 'error');
      return;
    }
    
    // Get text from source cell
    const text = this.getCellText(fromCell.col, fromCell.row);
    
    if (!text || text.trim() === '') {
      this.setStatus('⚠️ Source cell is empty', 'error');
      return;
    }
    
    this.setStatus(`🔄 Translating "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}"...`);
    
    try {
      // Mark as processing
      this.markCell(toCell.col, toCell.row, 'cell-processing');
      
      // Translate
      const translated = await this.translateText(text, targetLang);
      
      // Set result
      this.setCellText(toCell.col, toCell.row, translated);
      this.markCell(toCell.col, toCell.row, 'cell-completed');
      
      this.setStatus(`✅ "${translated.substring(0, 30)}${translated.length > 30 ? '...' : ''}"`, 'active');
      
    } catch (err) {
      console.error('Translation error:', err);
      this.setCellText(toCell.col, toCell.row, '[ERROR]');
      this.markCell(toCell.col, toCell.row, 'cell-error');
      this.setStatus('❌ ' + err.message, 'error');
    }
  }

  // ===============================
  // UTIL
  // ===============================
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ===============================
// CSS for cell states
// ===============================
const style = document.createElement('style');
style.textContent = `
  .cell-processing {
    background: rgba(233, 69, 96, 0.2) !important;
    transition: background 0.3s;
  }
  .cell-completed {
    background: rgba(100, 255, 218, 0.2) !important;
    transition: background 0.3s;
  }
  .cell-error {
    background: rgba(255, 107, 107, 0.3) !important;
    transition: background 0.3s;
  }
`;
document.head.appendChild(style);

// ===============================
// INITIALIZE
// ===============================
let translator = null;

function initTranslator() {
  const table = document.getElementById('sheet');
  if (table) {
    translator = new SpreadsheetTranslator(table);
    console.log('✅ Spreadsheet Translator initialized!');
  } else {
    console.error('❌ Table with id="sheet" not found!');
    // Try again after a short delay
    setTimeout(initTranslator, 500);
  }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTranslator);
} else {
  initTranslator();
}
