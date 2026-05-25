// ai-module.js - Lightweight AI for Spreadsheets
// Uses LibreTranslate API for translation – no heavy local models.

export class SpreadsheetAI {
  constructor(tableElement) {
    this.table = tableElement;
    this.isRunning = false;
    this.stopRequested = false;
    this.isLoaded = true; // No model loading needed

    // UI elements (same IDs as your original)
    this.statusEl = document.getElementById('aiStatus');
    this.progressEl = document.getElementById('aiProgress');
    this.progressFill = document.getElementById('aiProgressFill');
    this.progressText = document.getElementById('aiProgressText');
    this.currentCellEl = document.getElementById('aiCurrentCell');
    this.stopBtn = document.getElementById('aiStop');
    this.commandStatus = document.getElementById('aiCommandStatus');

    this.setupActivation();
  }

  // 🔧 CONFIG: Change this to your LibreTranslate server
  LIBRETRANSLATE_URL = 'http://localhost:5000';   // or https://libretranslate.com

  setupActivation() {
    const activateBtn = document.getElementById('aiActivate');
    const toggleBtn = document.getElementById('aiToggle');
    const panel = document.getElementById('aiPanel');

    // Immediately mark as ready – no model loading
    activateBtn.onclick = () => {
      panel.classList.add('active');
      if (!this.isLoaded) this.isLoaded = true;
    };

    // Keep toggle functionality
    toggleBtn.onclick = () => panel.classList.toggle('active');
    document.getElementById('aiClose').onclick = () => panel.classList.remove('active');

    // Enable the execute button right away
    document.getElementById('aiExecute').disabled = false;

    this.setupEventListeners();
  }

  setupEventListeners() {
    document.getElementById('aiExecute').onclick = () => this.executeCommand();

    document.getElementById('aiCommand').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        this.executeCommand();
      }
    });

    this.stopBtn.onclick = () => {
      this.stopRequested = true;
      this.progressText.textContent = '⏹ Stopping...';
    };

    // Mark as ready immediately
    this.setStatus('✅ Translation ready (using LibreTranslate)');
  }

  setStatus(msg) {
    this.statusEl.textContent = msg;
  }

  showProgress(action) {
    this.progressEl.classList.add('active');
    this.progressText.textContent = action;
    this.progressFill.style.width = '0%';
    this.stopBtn.style.display = 'block';
  }

  updateProgress(done, total, cellText, rowNum) {
    const pct = Math.round((done / total) * 100);
    this.progressFill.style.width = pct + '%';
    this.progressText.textContent = `Row ${rowNum} • ${done}/${total} (${pct}%)`;
    this.currentCellEl.textContent = cellText.length > 50
      ? cellText.substring(0, 50) + '...'
      : cellText;
  }

  hideProgress() {
    setTimeout(() => {
      this.progressEl.classList.remove('active');
      this.stopBtn.style.display = 'none';
    }, 1500);
  }

 // Original (line 132ish)
getCellText(colIndex, rowIndex) {
  const row = this.table.rows[rowIndex];
  if (!row) return '';
  const cell = row.cells[colIndex];   // ← wrong for your layout
  return cell ? cell.textContent.trim() : '';
}

// Corrected – column A is at cells[colIndex+1]
getCellText(colIndex, rowIndex) {
  const row = this.table.rows[rowIndex];
  if (!row) return '';
  const cell = row.cells[colIndex + 1];  // +1 skip row number column
  return cell ? cell.textContent.trim() : '';
}

setCellText(colIndex, rowIndex, value) {
  const row = this.table.rows[rowIndex];
  if (!row) return;
  const cell = row.cells[colIndex + 1];
  if (cell) cell.textContent = value;
}

markCell(colIndex, rowIndex, processing) {
  const row = this.table.rows[rowIndex];
  if (!row) return;
  const cell = row.cells[colIndex + 1];
  if (!cell) return;
  // ... rest stays the same
}

  
  parseCommand(command) {
    const cmd = command.toLowerCase().trim();

    const columnRegex = /column\s+([a-z])/gi;
    const columns = [];
    let match;
    while ((match = columnRegex.exec(cmd)) !== null) {
      columns.push(match[1].toUpperCase());
    }

    let action = null;
    let targetLang = null;

    if (cmd.includes('translate')) {
      action = 'translate';

      // Language mapping -> LibreTranslate language codes
      const languages = {
        'english': 'en',
        'spanish': 'es',
        'french': 'fr',
        'german': 'de',
        'italian': 'it',
        'portuguese': 'pt',
        'dutch': 'nl'
      };

      for (const [lang, code] of Object.entries(languages)) {
        if (cmd.includes(lang)) {
          targetLang = code;
          break;
        }
      }

      if (!targetLang) {
        return { error: 'Please specify a language: English, Spanish, French, German, Italian, Portuguese, or Dutch' };
      }
    } else if (cmd.includes('summarize') || cmd.includes('summary')) {
      return { error: 'Summarize not yet available with LibreTranslate. Only translation is active.' };
    } else if (cmd.includes('grammar') || cmd.includes('fix')) {
      return { error: 'Grammar fix not yet available. Only translation is active.' };
    } else if (cmd.includes('sentiment')) {
      return { error: 'Sentiment not yet available. Only translation is active.' };
    } else {
      return { error: 'Unknown command. Currently only "translate" is supported.' };
    }

    if (columns.length < 2) {
      return { error: 'Please specify source and destination (e.g., "column A to column B")' };
    }

    return {
      action,
      fromCol: columns[0].charCodeAt(0) - 65,
      toCol: columns[1].charCodeAt(0) - 65,
      targetLang  // e.g., 'es', 'fr'
    };
  }

  async executeCommand() {
    const commandText = document.getElementById('aiCommand').value.trim();
    if (!commandText) return;

    this.commandStatus.classList.add('active');
    this.commandStatus.textContent = '🤔 Understanding command...';

    const parsed = this.parseCommand(commandText);

    if (parsed.error) {
      this.commandStatus.textContent = '❌ ' + parsed.error;
      return;
    }

    const colFrom = String.fromCharCode(65 + parsed.fromCol);
    const colTo = String.fromCharCode(65 + parsed.toCol);
    this.commandStatus.textContent = `✅ Got it! ${parsed.action} from column ${colFrom} → ${colTo}`;

    await this.delay(800);

    if (parsed.action === 'translate') {
      await this.translateCommand(parsed.fromCol, parsed.toCol, parsed.targetLang);
    }
  }

  async translateCommand(fromCol, toCol, targetLang) {
    if (this.isRunning) return;

    // Auto-detect source language? LibreTranslate can auto-detect if 'source' is set to 'auto'.
    const sourceLang = 'auto';   // let LibreTranslate detect, or set 'en'

    const tasks = [];
    const rowCount = this.table.rows.length;

    for (let r = 2; r < rowCount; r++) {   // assumes row 0 is header – adjust if needed
      const text = this.getCellText(fromCol, r);
      if (text) tasks.push({ row: r, text });
    }

    if (!tasks.length) {
      this.setStatus('⚠️ No text found in source column');
      return;
    }

    this.isRunning = true;
    this.stopRequested = false;
    this.showProgress(`Translating (${tasks.length} cells)`);

    let done = 0;
    for (const task of tasks) {
      if (this.stopRequested) break;

      this.markCell(toCol, task.row, true);
      this.setCellText(toCol, task.row, '⏳...');
      this.updateProgress(done, tasks.length, task.text, task.row);

      await this.delay(100);  // small throttle – LibreTranslate API may require rate limiting

      try {
        const translated = await this.callLibreTranslate(task.text, sourceLang, targetLang);
        this.setCellText(toCol, task.row, translated);
      } catch (err) {
        console.error(err);
        this.setCellText(toCol, task.row, '⚠️ Error');
      }

      this.markCell(toCol, task.row, false);
      done++;
      await this.delay(50);
    }

    if (!this.stopRequested) {
      this.setStatus(`✅ Translated ${done} cells`);
      this.commandStatus.textContent = `✅ Done! Translated ${done} cells`;
    } else {
      this.setStatus(`⏹ Stopped (${done}/${tasks.length})`);
    }

    this.hideProgress();
    this.isRunning = false;
  }

  async callLibreTranslate(text, source, target) {
    const url = `${this.LIBRETRANSLATE_URL}/translate`;
    const options = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        source: source,
        target: target,
        format: 'text'
      })
    };

    const response = await fetch(url, options);
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`LibreTranslate error: ${response.status} - ${err}`);
    }
    const data = await response.json();
    return data.translatedText.trim();
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
