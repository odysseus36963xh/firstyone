export class SpreadsheetAI {

  constructor(table) {

    this.table = table;

    this.isProcessing = false;

    this.abortController = null;

    this.apiUrl = 'https://libretranslate.de/translate';

    this.initializeUI();
  }

  initializeUI() {

    this.activateBtn = document.getElementById('aiActivate');
    this.toggleBtn = document.getElementById('aiToggle');
    this.panel = document.getElementById('aiPanel');
    this.closeBtn = document.getElementById('aiClose');

    this.commandInput = document.getElementById('aiCommand');
    this.executeBtn = document.getElementById('aiExecute');

    this.statusBox = document.getElementById('aiStatus');

    this.progressBox = document.getElementById('aiProgress');
    this.progressFill = document.getElementById('aiProgressFill');
    this.progressText = document.getElementById('aiProgressText');
    this.currentCell = document.getElementById('aiCurrentCell');

    this.stopBtn = document.getElementById('aiStop');

    this.bindEvents();
  }

  bindEvents() {

    this.activateBtn.addEventListener('click', async () => {
      await this.activateAI();
    });

    this.toggleBtn.addEventListener('click', () => {
      this.panel.classList.toggle('active');
    });

    this.closeBtn.addEventListener('click', () => {
      this.panel.classList.remove('active');
    });

    this.commandInput.addEventListener('input', () => {
      this.executeBtn.disabled = !this.commandInput.value.trim();
    });

    this.commandInput.addEventListener('keydown', (e) => {

      if (e.ctrlKey && e.key === 'Enter') {
        this.executeCommand();
      }

    });

    this.executeBtn.addEventListener('click', () => {
      this.executeCommand();
    });

    this.stopBtn.addEventListener('click', () => {
      this.stopProcessing();
    });

  }

  async activateAI() {

    try {

      this.activateBtn.classList.add('loading');

      this.activateBtn.textContent = 'Loading...';

      await this.translateText('hello', 'en', 'es');

      this.activateBtn.classList.remove('loading');

      this.activateBtn.classList.add('loaded');

      this.activateBtn.textContent = 'AI Ready';

      this.toggleBtn.classList.add('active');

      this.executeBtn.disabled = false;

      this.setStatus('LibreTranslate connected');

    } catch (err) {

      console.error(err);

      this.activateBtn.classList.remove('loading');

      this.activateBtn.textContent = 'Retry AI';

      this.setStatus('Connection failed');

    }

  }

  setStatus(text) {
    this.statusBox.textContent = text;
  }

  async executeCommand() {

    const command =
      this.commandInput.value.trim().toLowerCase();

    if (!command) return;

    if (this.isProcessing) {
      alert('Already processing');
      return;
    }

    if (command.includes('translate')) {

      await this.handleTranslate(command);

      return;
    }

    this.setStatus('Unknown command');
  }

  async handleTranslate(command) {

    const match =
      command.match(
        /column\s+([a-z])\s+to\s+([a-z]{2})\s+in\s+column\s+([a-z])/i
      );

    if (!match) {

      this.setStatus(
        'Example: translate column A to es in column B'
      );

      return;
    }

    const sourceColumn = match[1].toUpperCase();

    const targetLang = match[2].toLowerCase();

    const targetColumn = match[3].toUpperCase();

    await this.translateColumn(
      sourceColumn,
      targetColumn,
      targetLang
    );

  }

  async translateColumn(
    sourceCol,
    targetCol,
    targetLang
  ) {

    this.isProcessing = true;

    this.abortController = new AbortController();

    this.progressBox.classList.add('active');

    this.stopBtn.style.display = 'block';

    try {

      const sourceIndex =
        this.columnLetterToIndex(sourceCol);

      const targetIndex =
        this.columnLetterToIndex(targetCol);

      const rows =
        Array.from(this.table.rows).slice(2);

      let completed = 0;

      for (let i = 0; i < rows.length; i++) {

        if (!this.isProcessing) break;

        const row = rows[i];

        const sourceCell =
          row.cells[sourceIndex + 1];

        const targetCell =
          row.cells[targetIndex + 1];

        if (!sourceCell || !targetCell) {
          continue;
        }

        const text =
          sourceCell.innerText.trim();

        if (!text) {
          continue;
        }

        sourceCell.classList.add(
          'cell-processing'
        );

        this.currentCell.textContent =
          sourceCol +
          (i + 1) +
          ' to ' +
          targetCol +
          (i + 1);

        try {

          const translated =
            await this.translateText(
              text,
              'auto',
              targetLang
            );

          targetCell.innerText = translated;

          sourceCell.classList.remove(
            'cell-processing'
          );

          sourceCell.classList.add(
            'cell-completed'
          );

        } catch (err) {

          console.error(err);

          targetCell.innerText = '[ERROR]';

        }

        completed++;

        const percent =
          Math.floor(
            (completed / rows.length) * 100
          );

        this.progressFill.style.width =
          percent + '%';

        this.progressText.textContent =
          percent + '% Complete';

        await this.sleep(30);

      }

      this.setStatus(
        'Translation complete'
      );

    } catch (err) {

      console.error(err);

      this.setStatus(
        'Translation failed'
      );

    }

    this.finishProcessing();

  }

  async translateText(
    text,
    source,
    target
  ) {

    const response = await fetch(
      this.apiUrl,
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json'
        },

        body: JSON.stringify({
          q: text,
          source: source,
          target: target,
          format: 'text'
        })
      }
    );

    if (!response.ok) {

      throw new Error(
        'LibreTranslate request failed'
      );

    }

    const data = await response.json();

    return data.translatedText;

  }

  stopProcessing() {

    this.isProcessing = false;

    if (this.abortController) {
      this.abortController.abort();
    }

    this.setStatus('Processing stopped');

    this.finishProcessing();

  }

  finishProcessing() {

    this.isProcessing = false;

    this.stopBtn.style.display = 'none';

    setTimeout(() => {

      this.progressBox.classList.remove(
        'active'
      );

      this.progressFill.style.width = '0%';

    }, 1000);

  }

  columnLetterToIndex(letter) {

    return letter.charCodeAt(0) - 65;

  }

  sleep(ms) {

    return new Promise(resolve =>
      setTimeout(resolve, ms)
    );

  }

}
