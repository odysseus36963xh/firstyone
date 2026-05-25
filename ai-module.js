export class SpreadsheetAI {
          sourceCell.classList.add('cell-completed');

        } catch (err) {
          console.error(err);
          targetCell.innerText = '[ERROR]';
        }

        completed++;

        const percent = Math.floor((completed / rows.length) * 100);

        this.progressFill.style.width = `${percent}%`;
        this.progressText.textContent = `${percent}% Complete`;

        // Prevent browser freezing
        await this.sleep(30);
      }

      this.setStatus('✅ Translation complete');

    } catch (err) {
      console.error(err);
      this.setStatus('❌ Translation failed');
    }

    this.finishProcessing();
  }

  async translateText(text, source, target) {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: text,
        source,
        target,
        format: 'text'
      })
    });

    if (!response.ok) {
      throw new Error('LibreTranslate request failed');
    }

    const data = await response.json();

    return data.translatedText;
  }

  stopProcessing() {
    this.isProcessing = false;

    if (this.abortController) {
      this.abortController.abort();
    }

    this.setStatus('⛔ Processing stopped');

    this.finishProcessing();
  }

  finishProcessing() {
    this.isProcessing = false;

    this.stopBtn.style.display = 'none';

    setTimeout(() => {
      this.progressBox.classList.remove('active');
      this.progressFill.style.width = '0%';
    }, 1000);
  }

  columnLetterToIndex(letter) {
    return letter.charCodeAt(0) - 65;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
