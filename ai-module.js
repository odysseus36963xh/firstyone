// ai-module.js
export class SpreadsheetAI {
  constructor(tableElement) {
    this.table = tableElement;
    this.translator = null;
    this.ai = null;
    this.isRunning = false;
    this.stopRequested = false;
    this.isLoaded = false;

    // UI elements
    this.statusEl = document.getElementById('aiStatus');
    this.progressEl = document.getElementById('aiProgress');
    this.progressFill = document.getElementById('aiProgressFill');
    this.progressText = document.getElementById('aiProgressText');
    this.currentCellEl = document.getElementById('aiCurrentCell');
    this.stopBtn = document.getElementById('aiStop');
    this.commandStatus = document.getElementById('aiCommandStatus');

    this.languageMap = {
      'english': 'en', 'spanish': 'es', 'french': 'fr', 'german': 'de',
      'italian': 'it', 'portuguese': 'pt', 'dutch': 'nl', 'russian': 'ru',
      'en': 'en', 'es': 'es', 'fr': 'fr', 'de': 'de', 'it': 'it', 'pt': 'pt',
      'spain': 'es', 'spanish': 'es'
    };

    this.setupActivation();
  }

  setupActivation() {
    const activateBtn = document.getElementById('aiActivate');
    const toggleBtn = document.getElementById('aiToggle');
    const panel = document.getElementById('aiPanel');

    activateBtn.onclick = async () => {
      if (this.isLoaded) {
        panel.classList.add('active');
        return;
      }

      activateBtn.classList.add('loading');
      activateBtn.textContent = '⏳ Loading AI...';

      await this.init();

      activateBtn.classList.remove('loading');
      activateBtn.classList.add('loaded');
      activateBtn.textContent = '✅ AI Ready';

      setTimeout(() => {
        activateBtn.style.display = 'none';
        toggleBtn.classList.add('active');
        panel.classList.add('active');
      }, 800);

      this.isLoaded = true;
    };

    toggleBtn.onclick = () => panel.classList.toggle('active');
    document.getElementById('aiClose').onclick = () => panel.classList.remove('active');

    this.setupEventListeners();
  }

  setupEventListeners() {
    document.getElementById('aiExecute').onclick = () => this.executeCommand();
    document.getElementById('aiCommand').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.executeCommand();
      }
    });

    this.stopBtn.onclick = () => {
      this.stopRequested = true;
      this.progressText.textContent = '⏹ Stopping...';
    };
  }

  async init() {
    try {
      this.setStatus('⏳ Loading Translator (Bergamot ~75MB)...');
      
      await import('https://unpkg.com/bergamot-translator@0.6.2/dist/bergamot.es.js');
      
      this.translator = await globalThis.bergamot.loadTranslator({
        downloadProgress: (pct) => {
          pct = Math.round(pct);
          this.setStatus(`⏳ Translator: ${pct}%`);
          document.getElementById('aiActivate').textContent = `⏳ ${pct}%`;
        }
      });

      this.setStatus('⏳ Loading Light AI Model (~80MB)...');
      
      const { pipeline } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.2.1');
      
      this.ai = await pipeline('text2text-generation', 'Xenova/flan-t5-small', {
        quantized: true,
        cache_policy: 'on_demand',
        progress_callback: (data) => {
          if (data.status === 'progress' && data.progress !== undefined) {
            const pct = Math.round(data.progress);
            this.setStatus(`⏳ AI Model: ${pct}%`);
            const btn = document.getElementById('aiActivate');
            if (btn) btn.textContent = `⏳ ${pct}%`;
          }
        }
      });

      this.setStatus('✅ AI Ready! Try: "translate column A to column B spanish"');
      document.getElementById('aiExecute').disabled = false;

    } catch (err) {
      this.setStatus('❌ Failed: ' + err.message);
      console.error(err);
    }
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
    this.currentCellEl.textContent = cellText.length > 45 ? cellText.substring(0, 45) + '...' : cellText;
  }

  hideProgress() {
    setTimeout(() => {
      this.progressEl.classList.remove('active');
      this.stopBtn.style.display = 'none';
    }, 1200);
  }

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
    if (cell) cell.textContent = value;
  }

  markCell(colIndex, rowIndex, processing) {
    const row = this.table.rows[rowIndex];
    if (!row) return;
    const cell = row.cells[colIndex + 1];
    if (!cell) return;
    if (processing) {
      cell.classList.add('cell-processing');
    } else {
      cell.classList.remove('cell-processing');
      cell.classList.add('cell-completed');
      setTimeout(() => cell.classList.remove('cell-completed'), 600);
    }
  }

  // ====================== IMPROVED PARSER ======================
  parseCommand(command) {
    const cmd = command.toLowerCase().trim();

    const colMatch = /column\s+([a-z])|([a-z])\s*(?:to|into|→)/gi;
    const columns = [];
    let match;
    while ((match = colMatch.exec(cmd)) !== null) {
      const letter = (match[1] || match[2]).toUpperCase();
      if (!columns.includes(letter)) columns.push(letter);
    }

    let action = null;
    let targetLang = null;

    // Language detection
    for (const [langName, code] of Object.entries(this.languageMap)) {
      if (cmd.includes(langName)) {
        targetLang = code;
        break;
      }
    }

    if (cmd.includes('translate') || cmd.includes('traduc')) {
      action = 'translate';

      if (columns.length === 1 && targetLang) {
        return {
          action: 'translate_all',
          fromCol: columns[0].charCodeAt(0) - 65,
          targetLang
        };
      }
    } 
    else if (cmd.includes('summarize') || cmd.includes('summary')) action = 'summarize';
    else if (cmd.includes('grammar') || cmd.includes('fix') || cmd.includes('correct')) action = 'grammar';
    else if (cmd.includes('sentiment')) action = 'sentiment';
    else {
      return { error: 'Unknown command. Try: translate, summarize, fix grammar, sentiment' };
    }

    if (action === 'translate' && columns.length < 2) {
      return { error: 'Please specify source and target columns (e.g. "translate column A to column B spanish")' };
    }

    return {
      action,
      fromCol: columns[0] ? columns[0].charCodeAt(0) - 65 : null,
      toCol: columns[1] ? columns[1].charCodeAt(0) - 65 : null,
      targetLang
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

    if (parsed.action === 'translate_all') {
      this.commandStatus.textContent = `✅ Translating to all active languages...`;
      await this.translateToAllCommand(parsed.fromCol, parsed.targetLang);
      return;
    }

    const colFrom = String.fromCharCode(65 + parsed.fromCol);
    const colTo = parsed.toCol !== null ? String.fromCharCode(65 + parsed.toCol) : '?';

    this.commandStatus.textContent = `✅ Running: ${parsed.action} from ${colFrom} → ${colTo}`;

    await this.delay(600);

    if (parsed.action === 'translate') {
      let targetLang = parsed.targetLang;
      if (!targetLang) {
        const selected = this.table.rows[1].cells[parsed.toCol + 1]?.querySelector('select')?.value;
        targetLang = selected ? selected.toLowerCase() : 'es';
      }
      await this.translateCommand(parsed.fromCol, parsed.toCol, targetLang);
    } else {
      await this.processAICommand(parsed.fromCol, parsed.toCol, parsed.action);
    }
  }

  async translateToAllCommand(fromCol, defaultLang = 'es') {
    const targets = [];
    for (let c = 0; c < 26; c++) {
      const select = this.table.rows[1].cells[c + 1]?.querySelector('select');
      const val = select ? select.value : 'Off';
      if (val !== 'Off') targets.push({ col: c, lang: val.toLowerCase() });
    }

    if (targets.length === 0) {
      this.commandStatus.textContent = '❌ No language columns activated';
      return;
    }

    for (const target of targets) {
      if (this.stopRequested) break;
      await this.translateCommand(fromCol, target.col, target.lang);
    }
  }

  async translateCommand(fromCol, toCol, targetLang) {
    if (this.isRunning) return;
    const sourceLang = 'en';
    const tasks = [];

    for (let r = 2; r < this.table.rows.length; r++) {
      const text = this.getCellText(fromCol, r);
      if (text) tasks.push({ row: r, text });
    }

    if (!tasks.length) {
      this.setStatus('⚠️ No text found in source column');
      return;
    }

    this.isRunning = true;
    this.stopRequested = false;
    this.showProgress(`Translating ${tasks.length} cells to ${targetLang.toUpperCase()}`);

    let done = 0;
    const batchSize = 25;

    for (let i = 0; i < tasks.length; i += batchSize) {
      if (this.stopRequested) break;
      const batch = tasks.slice(i, i + batchSize);

      const translations = await this.translator.translate(
        sourceLang,
        targetLang,
        batch.map(t => t.text)
      );

      for (let j = 0; j < batch.length; j++) {
        const task = batch[j];
        this.markCell(toCol, task.row, true);
        this.updateProgress(done + 1, tasks.length, task.text, task.row - 1);
        this.setCellText(toCol, task.row, translations[j].targetText.trim());
        this.markCell(toCol, task.row, false);
        done++;
      }
      await this.delay(10);
    }

    this.setStatus(`✅ Translated ${done} cells`);
    this.commandStatus.textContent = `✅ Done! Translated ${done} cells`;
    this.hideProgress();
    this.isRunning = false;
  }

  async processAICommand(fromCol, toCol, action) {
    if (this.isRunning) return;

    const prompts = {
      summarize: (t) => `Summarize in one short clear sentence: ${t}`,
      grammar:   (t) => `Fix all grammar, spelling and punctuation. Return only the corrected text: ${t}`,
      sentiment: (t) => `Answer with exactly one word: positive, negative, or neutral. Text: ${t}`
    };

    const tasks = [];
    for (let r = 2; r < this.table.rows.length; r++) {
      const text = this.getCellText(fromCol, r);
      if (text) tasks.push({ row: r, text });
    }

    if (!tasks.length) return;

    this.isRunning = true;
    this.stopRequested = false;
    this.showProgress(`${action} ${tasks.length} cells`);

    let done = 0;
    for (const task of tasks) {
      if (this.stopRequested) break;

      this.markCell(toCol, task.row, true);
      this.setCellText(toCol, task.row, '⏳');
      this.updateProgress(done, tasks.length, task.text, task.row - 1);

      try {
        const result = await this.ai(prompts[action](task.text), {
          max_new_tokens: 100,
          temperature: 0.1,
          do_sample: false
        });
        let output = result[0].generated_text.trim();
        if (action === 'sentiment') output = output.toLowerCase().replace(/[^a-z]/g, '');
        this.setCellText(toCol, task.row, output || '(empty)');
      } catch (e) {
        this.setCellText(toCol, task.row, 'Error');
      }

      this.markCell(toCol, task.row, false);
      done++;
      await this.delay(40);
    }

    this.setStatus(`✅ Completed ${done} cells`);
    this.commandStatus.textContent = `✅ Done! Processed ${done} cells`;
    this.hideProgress();
    this.isRunning = false;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
