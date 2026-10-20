import { elementData, symbols } from './elements.js';
import { validateElementGuess, solveWord } from './speller.js';
import { getDailyWord, getRandomWord, getTodayDateStr, getPuzzleNumber, getDateForPuzzleNumber, EPOCH_DATE_STR } from './prng.js';
import { getStats, getHistory, getRecordForDate, recordCompletion, saveActiveState, loadActiveState } from './storage.js';

class ElementleGame {
    constructor() {
        this.todayStr = getTodayDateStr();
        this.currentDateStr = this.todayStr;
        this.isPractice = false;
        
        this.maxStrikes = 5;
        this.strikes = 0;
        this.currentWord = '';
        this.puzzleNumber = 1;
        this.placedElements = [];
        this.currentWordIndex = 0;
        this.isGameOver = false;

        this.initDOM();
        this.initDatalist();
        this.initEventListeners();
        this.startPuzzle(this.todayStr);
        this.startCountdown();
    }

    initDOM() {
        this.dom = {
            puzzleTitle: document.getElementById('puzzle-meta-badge'),
            targetWordDisplay: document.getElementById('target-word-display'),
            elementSlotsRow: document.getElementById('element-slots-row'),
            elementInput: document.getElementById('element-input'),
            submitBtn: document.getElementById('submit-element-btn'),
            statusMessage: document.getElementById('status-message'),
            heartsRow: document.getElementById('hearts-row'),
            strikesCount: document.getElementById('strikes-count'),
            elementDetails: document.getElementById('element-details'),
            modeTitle: document.getElementById('mode-title-text'),

            // Modals
            howToPlayModal: document.getElementById('how-to-play-modal'),
            statsModal: document.getElementById('stats-modal'),
            archiveModal: document.getElementById('archive-modal'),
            
            // Stats elements
            statPlayed: document.getElementById('stat-played'),
            statWinPct: document.getElementById('stat-win-pct'),
            statStreak: document.getElementById('stat-streak'),
            statMaxStreak: document.getElementById('stat-max-streak'),
            distBarsContainer: document.getElementById('dist-bars-container'),
            nextCountdown: document.getElementById('next-countdown-val'),
            shareBtn: document.getElementById('share-btn'),
            archiveList: document.getElementById('archive-list')
        };
    }

    initDatalist() {
        const datalist = document.getElementById('elements-datalist');
        if (!datalist) return;
        datalist.innerHTML = '';
        // Populate datalist with element names and symbols
        for (const [sym, data] of Object.entries(elementData)) {
            const opt = document.createElement('option');
            opt.value = data.name;
            opt.label = `${sym} - Atomic #${data.number}`;
            datalist.appendChild(opt);
        }
    }

    initEventListeners() {
        this.dom.submitBtn.addEventListener('click', () => this.handleGuess());
        this.dom.elementInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.handleGuess();
            }
        });

        // Top Navigation buttons
        document.getElementById('open-help-btn')?.addEventListener('click', () => this.openModal(this.dom.howToPlayModal));
        document.getElementById('open-stats-btn')?.addEventListener('click', () => {
            this.renderStatsModal();
            this.openModal(this.dom.statsModal);
        });
        document.getElementById('open-archive-btn')?.addEventListener('click', () => {
            this.renderArchiveModal('all');
            this.openModal(this.dom.archiveModal);
        });
        document.getElementById('toggle-mode-btn')?.addEventListener('click', () => this.togglePracticeMode());

        // Modal Close buttons
        document.querySelectorAll('.modal-close-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const overlay = e.target.closest('.modal-overlay');
                if (overlay) this.closeModal(overlay);
            });
        });

        // Close on clicking backdrop
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeModal(modal);
            });
        });

        // Share button
        this.dom.shareBtn?.addEventListener('click', () => this.copyShareCard());

        // Archive filters
        document.querySelectorAll('.archive-filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.archive-filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.renderArchiveModal(e.target.dataset.filter);
            });
        });
    }

    openModal(modal) {
        if (modal) modal.classList.add('active');
    }

    closeModal(modal) {
        if (modal) modal.classList.remove('active');
    }

    startPuzzle(dateStr, isPractice = false) {
        this.currentDateStr = dateStr;
        this.isPractice = isPractice;
        this.strikes = 0;
        this.placedElements = [];
        this.currentWordIndex = 0;
        this.isGameOver = false;

        let puzzleInfo;
        if (isPractice) {
            puzzleInfo = getRandomWord();
            this.currentWord = puzzleInfo.word;
            this.puzzleNumber = 'Practice';
            this.dom.puzzleTitle.textContent = `🧪 Practice Mode • Random Word`;
            this.dom.modeTitle.textContent = `🧪 Elementle (Practice)`;
        } else {
            puzzleInfo = getDailyWord(dateStr);
            this.currentWord = puzzleInfo.word;
            this.puzzleNumber = puzzleInfo.puzzleNumber;
            const isToday = (dateStr === this.todayStr);
            this.dom.puzzleTitle.textContent = isToday
                ? `📅 Daily Puzzle #${this.puzzleNumber} • ${dateStr}`
                : `📅 Past Puzzle #${this.puzzleNumber} • ${dateStr}`;
            this.dom.modeTitle.textContent = `🧪 Elementle #${this.puzzleNumber}`;
        }

        // Check if previously completed
        const pastRecord = (!this.isPractice) ? getRecordForDate(dateStr) : null;
        if (pastRecord) {
            this.isGameOver = true;
            this.strikes = pastRecord.strikes;
            this.placedElements = pastRecord.elementsUsed || solveWord(this.currentWord) || [];
            this.currentWordIndex = this.currentWord.length;
            this.renderSlots();
            this.updateStrikesUI();
            this.dom.elementInput.disabled = true;
            this.dom.submitBtn.disabled = true;
            if (pastRecord.won) {
                this.setStatus(`✅ You solved this puzzle with ${pastRecord.strikes} strike${pastRecord.strikes === 1 ? '' : 's'}!`, 'success');
            } else {
                this.setStatus(`❌ Puzzle completed previously (Game Over).`, 'error');
            }
            return;
        }

        // Restore active state if playing today's puzzle
        const saved = (!this.isPractice && dateStr === this.todayStr) ? loadActiveState(dateStr) : null;
        if (saved && saved.currentWord === this.currentWord) {
            this.strikes = saved.strikes || 0;
            this.placedElements = saved.placedElements || [];
            this.currentWordIndex = saved.currentWordIndex || 0;
        }

        this.dom.elementInput.disabled = false;
        this.dom.submitBtn.disabled = false;
        this.dom.elementInput.value = '';
        this.dom.elementInput.focus();
        this.setStatus('Enter the first element to begin spelling!', 'info');

        this.renderSlots();
        this.updateStrikesUI();
        this.resetElementDetails();
    }

    renderSlots() {
        this.dom.targetWordDisplay.textContent = this.currentWord;
        this.dom.elementSlotsRow.innerHTML = '';

        // Render filled elements
        this.placedElements.forEach((elem, idx) => {
            const slot = document.createElement('div');
            slot.className = 'element-slot filled';
            slot.innerHTML = `
                <span class="slot-symbol">${elem.symbol}</span>
                <span class="slot-name">${elem.name}</span>
                <span class="slot-number">#${elem.number}</span>
            `;
            slot.addEventListener('click', () => this.showElementDetails(elem));
            this.dom.elementSlotsRow.appendChild(slot);
        });

        // Estimate remaining slots needed
        if (!this.isGameOver) {
            const remaining = this.currentWord.slice(this.currentWordIndex);
            if (remaining.length > 0) {
                const solution = solveWord(remaining);
                const remainingSlotsCount = solution ? solution.length : Math.ceil(remaining.length / 2);
                for (let i = 0; i < remainingSlotsCount; i++) {
                    const slot = document.createElement('div');
                    slot.className = 'element-slot empty';
                    slot.innerHTML = `<span>?</span>`;
                    this.dom.elementSlotsRow.appendChild(slot);
                }
            }
        }
    }

    handleGuess() {
        if (this.isGameOver) return;
        const inputVal = this.dom.elementInput.value.trim();
        if (!inputVal) return;

        const result = validateElementGuess(this.currentWord, this.currentWordIndex, inputVal);

        if (result.valid) {
            this.placedElements.push(result.element);
            this.currentWordIndex = result.nextIndex;
            this.dom.elementInput.value = '';
            this.setStatus(`✅ Correct! "${result.element.name}" (${result.element.symbol}) locked in!`, 'success');
            this.showElementDetails(result.element);
            this.renderSlots();

            if (!this.isPractice) {
                saveActiveState(this.currentDateStr, {
                    currentWord: this.currentWord,
                    strikes: this.strikes,
                    placedElements: this.placedElements,
                    currentWordIndex: this.currentWordIndex
                });
            }

            // Check Win Condition
            if (this.currentWordIndex >= this.currentWord.length) {
                this.handleWin();
            }
        } else {
            this.strikes++;
            this.updateStrikesUI();
            this.setStatus(`❌ ${result.reason}`, 'error');
            this.dom.elementInput.select();

            if (result.element) {
                this.showElementDetails(result.element);
            }

            if (!this.isPractice) {
                saveActiveState(this.currentDateStr, {
                    currentWord: this.currentWord,
                    strikes: this.strikes,
                    placedElements: this.placedElements,
                    currentWordIndex: this.currentWordIndex
                });
            }

            // Check Loss Condition
            if (this.strikes >= this.maxStrikes) {
                this.handleLoss();
            }
        }
    }

    handleWin() {
        this.isGameOver = true;
        this.dom.elementInput.disabled = true;
        this.dom.submitBtn.disabled = true;
        this.setStatus(`🎉 CONGRATULATIONS! You spelled ${this.currentWord} with ${this.placedElements.length} elements!`, 'success');

        if (!this.isPractice) {
            recordCompletion(this.currentDateStr, this.puzzleNumber, this.currentWord, true, this.strikes, this.placedElements);
            setTimeout(() => {
                this.renderStatsModal();
                this.openModal(this.dom.statsModal);
            }, 750);
        }
    }

    handleLoss() {
        this.isGameOver = true;
        this.dom.elementInput.disabled = true;
        this.dom.submitBtn.disabled = true;

        // Reveal full solution
        const solution = solveWord(this.currentWord);
        this.placedElements = solution || this.placedElements;
        this.renderSlots();

        this.setStatus(`💀 Game Over! You reached ${this.maxStrikes} strikes. Solution revealed above.`, 'error');

        if (!this.isPractice) {
            recordCompletion(this.currentDateStr, this.puzzleNumber, this.currentWord, false, this.strikes, this.placedElements);
            setTimeout(() => {
                this.renderStatsModal();
                this.openModal(this.dom.statsModal);
            }, 1000);
        }
    }

    updateStrikesUI() {
        const remaining = Math.max(0, this.maxStrikes - this.strikes);
        this.dom.heartsRow.textContent = '❤️'.repeat(remaining) + '🖤'.repeat(this.strikes);
        this.dom.strikesCount.textContent = `Strikes: ${this.strikes}/${this.maxStrikes}`;
    }

    setStatus(msg, type = 'info') {
        this.dom.statusMessage.textContent = msg;
        this.dom.statusMessage.className = type;
    }

    showElementDetails(elem) {
        this.dom.elementDetails.innerHTML = `
            <div class="big-element">
                <div class="element-symbol">${elem.symbol}</div>
                <div class="element-name">${elem.name}</div>
                <div class="element-number">Atomic Number: ${elem.number}</div>
            </div>
        `;
    }

    resetElementDetails() {
        this.dom.elementDetails.innerHTML = `<span class="placeholder-text">Hover or click any element tile to view atomic details</span>`;
    }

    togglePracticeMode() {
        if (this.isPractice) {
            this.startPuzzle(this.todayStr, false);
            document.getElementById('toggle-mode-btn').textContent = '♾️ Practice Mode';
        } else {
            this.startPuzzle(null, true);
            document.getElementById('toggle-mode-btn').textContent = '📅 Daily Puzzle';
        }
    }

    renderStatsModal() {
        const stats = getStats();
        this.dom.statPlayed.textContent = stats.played;
        this.dom.statWinPct.textContent = stats.played > 0 ? `${Math.round((stats.won / stats.played) * 100)}%` : '0%';
        this.dom.statStreak.textContent = stats.currentStreak;
        this.dom.statMaxStreak.textContent = stats.maxStreak;

        // Render Strikes Distribution
        const dist = stats.distribution || {};
        const maxCount = Math.max(1, ...Object.values(dist));
        this.dom.distBarsContainer.innerHTML = [0, 1, 2, 3, 4, 5].map(strikes => {
            const count = dist[String(strikes)] || 0;
            const pct = count > 0 ? Math.max(12, Math.round((count / maxCount) * 100)) : 0;
            const isCurrent = (!this.isPractice && this.isGameOver && this.strikes === strikes);
            const fillClass = count > 0 ? (isCurrent ? 'dist-fill highlight' : 'dist-fill') : 'dist-fill zero';
            return `
                <div class="dist-row">
                    <span class="dist-label">${strikes} strike${strikes === 1 ? '' : 's'}</span>
                    <div class="dist-track">
                        <div class="${fillClass}" style="${count > 0 ? `width: ${pct}%` : ''}">
                            <span>${count}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderArchiveModal(filter = 'all') {
        const history = getHistory();
        const todayPuzzleNum = getPuzzleNumber(this.todayStr);
        const items = [];

        for (let pNum = todayPuzzleNum; pNum >= 1; pNum--) {
            const dateStr = getDateForPuzzleNumber(pNum);
            const rec = history[dateStr];
            const isSolved = rec && rec.won;
            const isPlayed = !!rec;

            if (filter === 'won' && !isSolved) continue;
            if (filter === 'unplayed' && isPlayed) continue;

            items.push({ pNum, dateStr, rec, isSolved, isPlayed });
        }

        if (items.length === 0) {
            this.dom.archiveList.innerHTML = `<div style="padding: 20px; color: #888;">No puzzles match this filter.</div>`;
            return;
        }

        this.dom.archiveList.innerHTML = items.map(item => {
            const badgeClass = item.isSolved ? 'archive-status-badge won' : (item.isPlayed ? 'archive-status-badge error' : 'archive-status-badge unplayed');
            const badgeText = item.isSolved ? `Solved (${item.rec.strikes}⚡)` : (item.isPlayed ? 'Missed 💀' : 'Unplayed');
            return `
                <div class="archive-item">
                    <div class="archive-meta">
                        <span class="archive-pnum">Puzzle #${item.pNum}</span>
                        <span class="archive-date">${item.dateStr}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="${badgeClass}">${badgeText}</span>
                        <button class="archive-play-btn" data-date="${item.dateStr}">Play</button>
                    </div>
                </div>
            `;
        }).join('');

        this.dom.archiveList.querySelectorAll('.archive-play-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const date = e.target.dataset.date;
                this.closeModal(this.dom.archiveModal);
                this.startPuzzle(date, false);
            });
        });
    }

    copyShareCard() {
        const puzzleTag = this.isPractice ? `Elementle Practice` : `Elementle #${this.puzzleNumber}`;
        const strikeEmoji = this.isGameOver && this.currentWordIndex >= this.currentWord.length
            ? (this.strikes === 0 ? '🧪 Flawless (0 strikes)!' : `${this.strikes}/5 strikes`)
            : '💀 X/5 strikes';

        const elemBoxes = this.placedElements.map(e => `[${e.symbol}]`).join(' ');
        const shareText = `🧪 ${puzzleTag} • ${strikeEmoji}\n${elemBoxes}\nhttps://amitjoshi24.github.io/ElementSpeller/`;

        navigator.clipboard.writeText(shareText).then(() => {
            this.dom.shareBtn.textContent = '✅ Copied to Clipboard!';
            setTimeout(() => {
                this.dom.shareBtn.innerHTML = '📋 Share Result';
            }, 2000);
        }).catch(() => {
            alert(shareText);
        });
    }

    startCountdown() {
        const update = () => {
            const now = new Date();
            const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
            const diffMs = tomorrow - now;
            const hours = String(Math.floor(diffMs / (1000 * 60 * 60))).padStart(2, '0');
            const minutes = String(Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, '0');
            const seconds = String(Math.floor((diffMs % (1000 * 60)) / 1000)).padStart(2, '0');
            if (this.dom.nextCountdown) {
                this.dom.nextCountdown.textContent = `${hours}:${minutes}:${seconds}`;
            }
        };
        update();
        setInterval(update, 1000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.elementleGame = new ElementleGame();
});
