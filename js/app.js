import { elementData, symbols } from "./elements.js";
import { validateElementGuess, solveWord } from "./speller.js";
import { getDailyWord, getRandomWord, getTodayDateStr, getPuzzleNumber, getDateForPuzzleNumber, EPOCH_DATE_STR, parseDate } from "./prng.js";
import {
    getStats,
    getHistory,
    getRecordForDate,
    recordCompletion,
    saveActiveState,
    loadActiveState,
    clearActiveState,
    onStorageChange,
    resetDailyGameResult,
    formatTimeMs,
    getTimeBin
} from "./storage.js";
import "./auth.js";

class ElementSpellerGame {
    constructor() {
        this.todayStr = getTodayDateStr();
        this.currentDateStr = this.todayStr;
        this.isPractice = false;
        
        this.currentWord = "";
        this.puzzleNumber = 1;
        this.placedElements = [];
        this.currentWordIndex = 0;
        this.isGameOver = false;

        // Timer
        this.startTime = null;
        this.solveTimeMs = null;
        this.timerInterval = null;

        // Calendar Archive state
        const todayDate = parseDate(this.todayStr);
        this.calYear = todayDate.getFullYear();
        this.calMonth = todayDate.getMonth();

        this.initDOM();
        this.initDatalist();
        this.initEventListeners();
        this.setupArchiveTabs();
        this.startPuzzle(this.todayStr);
        this.startMidnightCountdown();

        onStorageChange(() => {
            if (this.dom.statsModal && this.dom.statsModal.classList.contains("active")) {
                this.renderStatsModal();
            }
            if (this.dom.archiveModal && this.dom.archiveModal.classList.contains("active")) {
                this.renderCalendarView();
                this.renderArchiveList();
            }
        });
    }

    initDOM() {
        this.dom = {
            puzzleTitle: document.getElementById("puzzle-meta-badge"),
            targetWordDisplay: document.getElementById("target-word-display"),
            elementSlotsRow: document.getElementById("element-slots-row"),
            elementInput: document.getElementById("element-input"),
            submitBtn: document.getElementById("submit-element-btn"),
            statusMessage: document.getElementById("status-message"),
            elementDetails: document.getElementById("element-details"),
            modeTitle: document.getElementById("mode-title-text"),
            liveTimerDisplay: document.getElementById("live-timer-display"),
            stopwatchBadge: document.getElementById("stopwatch-badge"),
            undoBtn: document.getElementById("undo-element-btn"),
            resetBtn: document.getElementById("reset-puzzle-btn"),
            inputGroupArea: document.getElementById("input-group-area"),

            // Solved card
            solvedCard: document.getElementById("solved-card"),
            solvedTimeStat: document.getElementById("solved-time-stat"),
            shareScoreQuickBtn: document.getElementById("share-score-quick-btn"),
            solvedReplayBtn: document.getElementById("solved-replay-btn"),

            // Modals
            howToPlayModal: document.getElementById("how-to-play-modal"),
            statsModal: document.getElementById("stats-modal"),
            archiveModal: document.getElementById("archive-modal"),
            
            // Stats elements
            statPlayed: document.getElementById("stat-played"),
            statWinPct: document.getElementById("stat-win-pct"),
            statStreak: document.getElementById("stat-streak"),
            statBestTime: document.getElementById("stat-best-time"),
            distBarsContainer: document.getElementById("dist-bars-container"),
            nextCountdown: document.getElementById("next-countdown-val"),
            shareBtn: document.getElementById("share-btn"),
            statsRetryBtn: document.getElementById("stats-retry-btn"),

            // Archive elements
            archiveTabCal: document.getElementById("archive-tab-calendar"),
            archiveTabList: document.getElementById("archive-tab-list"),
            calView: document.getElementById("archive-calendar-view"),
            listView: document.getElementById("archive-list-view"),
            calPrevBtn: document.getElementById("cal-prev-month-btn"),
            calNextBtn: document.getElementById("cal-next-month-btn"),
            calTodayBtn: document.getElementById("cal-today-btn"),
            calMonthSelect: document.getElementById("cal-month-select"),
            calYearSelect: document.getElementById("cal-year-select"),
            calDaysContainer: document.getElementById("calendar-days-container"),
            archiveSearchInput: document.getElementById("archive-search"),
            archiveListContainer: document.getElementById("archive-list-container")
        };
    }

    initDatalist() {
        const datalist = document.getElementById("elements-datalist");
        if (!datalist) return;
        datalist.innerHTML = "";

        // Populate with symbol and full element name
        for (const sym of symbols) {
            const data = elementData[sym];
            if (!data) continue;
            const optName = document.createElement("option");
            optName.value = data.name;
            optName.label = `[${sym}] ${data.name} (#${data.number})`;
            datalist.appendChild(optName);

            const optSym = document.createElement("option");
            optSym.value = sym;
            optSym.label = `[${sym}] ${data.name} (#${data.number})`;
            datalist.appendChild(optSym);
        }
    }

    initEventListeners() {
        // Submit on button click
        if (this.dom.submitBtn) {
            this.dom.submitBtn.addEventListener("click", () => this.handleGuess());
        }

        // Submit on Enter key in input
        if (this.dom.elementInput) {
            this.dom.elementInput.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    this.handleGuess();
                }
            });
        }

        // Undo & Reset buttons
        if (this.dom.undoBtn) {
            this.dom.undoBtn.addEventListener("click", () => this.handleUndo());
        }
        if (this.dom.resetBtn) {
            this.dom.resetBtn.addEventListener("click", () => this.handleReset(true));
        }
        if (this.dom.solvedReplayBtn) {
            this.dom.solvedReplayBtn.addEventListener("click", () => this.handleReset(false));
        }
        if (this.dom.statsRetryBtn) {
            this.dom.statsRetryBtn.addEventListener("click", () => {
                this.closeModal(this.dom.statsModal);
                this.handleReset(true);
            });
        }

        // Share buttons
        if (this.dom.shareBtn) {
            this.dom.shareBtn.addEventListener("click", () => this.copyShareCard());
        }
        if (this.dom.shareScoreQuickBtn) {
            this.dom.shareScoreQuickBtn.addEventListener("click", () => this.copyShareCard());
        }

        // Toggle Practice vs Daily Mode
        const toggleBtn = document.getElementById("toggle-mode-btn");
        if (toggleBtn) {
            toggleBtn.addEventListener("click", () => {
                this.isPractice = !this.isPractice;
                toggleBtn.innerHTML = this.isPractice
                    ? "<span>📅 Daily Mode</span>"
                    : "<span>♾️ Practice Mode</span>";
                this.startPuzzle(this.isPractice ? null : this.todayStr, this.isPractice);
            });
        }

        // Modals Open Buttons
        const openHelpBtn = document.getElementById("open-help-btn");
        if (openHelpBtn) {
            openHelpBtn.addEventListener("click", () => this.openModal(this.dom.howToPlayModal));
        }

        const openStatsBtn = document.getElementById("open-stats-btn");
        if (openStatsBtn) {
            openStatsBtn.addEventListener("click", () => {
                this.renderStatsModal();
                this.openModal(this.dom.statsModal);
            });
        }

        const openArchiveBtn = document.getElementById("open-archive-btn");
        if (openArchiveBtn) {
            openArchiveBtn.addEventListener("click", () => {
                this.renderCalendarView();
                this.renderArchiveList();
                this.openModal(this.dom.archiveModal);
            });
        }

        // Modals Close handlers
        document.querySelectorAll(".modal-close-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const overlay = e.target.closest(".modal-overlay");
                if (overlay) this.closeModal(overlay);
            });
        });

        document.querySelectorAll(".modal-overlay").forEach(overlay => {
            overlay.addEventListener("click", (e) => {
                if (e.target === overlay) this.closeModal(overlay);
            });
        });

        // Close modal on Escape
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                document.querySelectorAll(".modal-overlay.active").forEach(m => this.closeModal(m));
            }
        });
    }

    startPuzzle(dateStr, isPractice = false) {
        this.isPractice = isPractice;
        this.isGameOver = false;
        this.placedElements = [];
        this.currentWordIndex = 0;
        this.solveTimeMs = null;
        this.stopSolveTimer();

        if (this.dom.undoBtn) this.dom.undoBtn.disabled = true;
        if (this.dom.solvedCard) this.dom.solvedCard.style.display = "none";
        if (this.dom.inputGroupArea) this.dom.inputGroupArea.style.display = "block";

        let puzzleInfo;
        if (isPractice) {
            puzzleInfo = getRandomWord();
            this.currentDateStr = null;
            this.currentWord = puzzleInfo.word;
            this.puzzleNumber = "Practice";
            this.dom.puzzleTitle.textContent = "🧪 Practice Mode • Random Word";
            this.dom.modeTitle.textContent = "🧪 ElementSpeller (Practice)";
        } else {
            this.currentDateStr = dateStr;
            puzzleInfo = getDailyWord(dateStr);
            this.currentWord = puzzleInfo.word;
            this.puzzleNumber = puzzleInfo.puzzleNumber;

            const isToday = dateStr === this.todayStr;
            this.dom.puzzleTitle.textContent = isToday
                ? `📅 Daily Puzzle #${this.puzzleNumber} • ${dateStr}`
                : `📅 Past Puzzle #${this.puzzleNumber} • ${dateStr}`;
            this.dom.modeTitle.textContent = `🧪 ElementSpeller #${this.puzzleNumber}`;
        }

        // Render target word and dynamic element slots
        this.renderTargetWord();
        this.renderElementSlots();

        // Check if previously completed
        const existingRecord = !isPractice ? getRecordForDate(dateStr) : null;
        if (existingRecord && existingRecord.won) {
            this.isGameOver = true;
            this.solveTimeMs = existingRecord.solveTimeMs || 0;
            this.placedElements = existingRecord.elementsUsed || solveWord(this.currentWord) || [];
            this.currentWordIndex = this.currentWord.length;

            this.renderTargetWord();
            this.renderElementSlots();
            this.dom.liveTimerDisplay.textContent = this.formatElapsed(this.solveTimeMs);
            this.dom.statusMessage.textContent = `⭐ Solved on this date in ${formatTimeMs(this.solveTimeMs)}!`;
            this.dom.statusMessage.className = "success";
            
            if (this.dom.solvedCard) {
                this.dom.solvedCard.style.display = "block";
                this.dom.solvedTimeStat.textContent = `Best Time: ${formatTimeMs(this.solveTimeMs)}`;
            }
            if (this.dom.inputGroupArea) this.dom.inputGroupArea.style.display = "none";
            return;
        }

        // Start active stopwatch
        this.startSolveTimer();
        this.dom.statusMessage.textContent = "Timer running! Enter elements from left to right to spell the word.";
        this.dom.statusMessage.className = "info";

        if (this.dom.elementInput) {
            this.dom.elementInput.value = "";
            this.dom.elementInput.focus();
        }
    }

    startSolveTimer() {
        this.stopSolveTimer();
        this.startTime = Date.now();
        this.tickSolveTimer();
        this.timerInterval = setInterval(() => this.tickSolveTimer(), 100);
    }

    stopSolveTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    tickSolveTimer() {
        if (!this.startTime) return;
        const elapsed = Date.now() - this.startTime;
        if (this.dom.liveTimerDisplay) {
            this.dom.liveTimerDisplay.textContent = this.formatElapsed(elapsed);
        }
    }

    formatElapsed(ms) {
        const totalSec = Math.max(0, ms / 1000);
        const mins = Math.floor(totalSec / 60);
        const secs = Math.floor(totalSec % 60);
        const tenths = Math.floor((totalSec * 10) % 10);
        return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${tenths}`;
    }

    renderTargetWord() {
        if (!this.dom.targetWordDisplay) return;
        const matched = this.currentWord.slice(0, this.currentWordIndex);
        const remaining = this.currentWord.slice(this.currentWordIndex);
        this.dom.targetWordDisplay.innerHTML = `<span class="matched-chars">${matched}</span><span class="unmatched-chars">${remaining}</span>`;
    }

    renderElementSlots() {
        if (!this.dom.elementSlotsRow) return;
        this.dom.elementSlotsRow.innerHTML = "";

        if (this.placedElements.length === 0) {
            this.dom.elementSlotsRow.innerHTML = `<span class="empty-tiles-placeholder">Enter elements from left to right to spell the word</span>`;
            return;
        }

        for (let i = 0; i < this.placedElements.length; i++) {
            const elem = this.placedElements[i];
            const tile = document.createElement("div");
            tile.className = "element-slot filled";
            tile.dataset.symbol = elem.symbol;
            tile.innerHTML = `
                <span class="slot-num">${elem.number}</span>
                <span class="slot-symbol">${elem.symbol}</span>
                <span class="slot-name">${elem.name}</span>
            `;

            tile.addEventListener("mouseenter", () => this.showElementDetails(elem));
            tile.addEventListener("click", () => this.showElementDetails(elem));
            this.dom.elementSlotsRow.appendChild(tile);
        }
    }

    handleGuess() {
        if (this.isGameOver) return;
        const inputVal = (this.dom.elementInput ? this.dom.elementInput.value : "").trim();
        if (!inputVal) return;

        const validation = validateElementGuess(this.currentWord, this.currentWordIndex, inputVal);

        if (!validation.valid) {
            // No strikes! Show feedback and shake
            this.dom.statusMessage.textContent = validation.reason || `"${inputVal}" does not match the next letters!`;
            this.dom.statusMessage.className = "error";

            if (this.dom.elementInput) {
                this.dom.elementInput.classList.remove("shake-error");
                void this.dom.elementInput.offsetWidth; // Force reflow
                this.dom.elementInput.classList.add("shake-error");
                this.dom.elementInput.select();
            }
            return;
        }

        // Valid element guess
        const elem = validation.element;
        this.placedElements.push(elem);
        this.currentWordIndex = validation.nextIndex;

        if (this.dom.undoBtn) this.dom.undoBtn.disabled = false;
        this.renderTargetWord();
        this.renderElementSlots();
        this.showElementDetails(elem);

        if (this.dom.elementInput) {
            this.dom.elementInput.value = "";
            this.dom.elementInput.focus();
        }

        // Check if fully spelled
        if (this.currentWordIndex >= this.currentWord.length) {
            this.handleSolveVictory();
        } else {
            this.dom.statusMessage.textContent = `Added [${elem.symbol}] ${elem.name}! Keep spelling!`;
            this.dom.statusMessage.className = "success";
        }
    }

    handleUndo() {
        if (this.isGameOver || this.placedElements.length === 0) return;
        const removed = this.placedElements.pop();
        this.currentWordIndex -= removed.symbol.length;

        if (this.dom.undoBtn) this.dom.undoBtn.disabled = (this.placedElements.length === 0);
        this.renderTargetWord();
        this.renderElementSlots();

        this.dom.statusMessage.textContent = `Undid [${removed.symbol}] ${removed.name}.`;
        this.dom.statusMessage.className = "info";

        if (this.dom.elementInput) {
            this.dom.elementInput.focus();
        }
    }

    async handleReset(confirmPrompt = true) {
        if (confirmPrompt && (this.placedElements.length > 0 || this.isGameOver)) {
            if (!confirm(`Reset ElementSpeller #${this.puzzleNumber}?\n\nThis will restart the solve timer so you can try again with a clean board!`)) {
                return;
            }
        }

        if (!this.isPractice && this.currentDateStr) {
            await resetDailyGameResult(this.currentDateStr);
        }

        this.isGameOver = false;
        this.placedElements = [];
        this.currentWordIndex = 0;
        this.solveTimeMs = null;

        if (this.dom.undoBtn) this.dom.undoBtn.disabled = true;
        if (this.dom.solvedCard) this.dom.solvedCard.style.display = "none";
        if (this.dom.inputGroupArea) this.dom.inputGroupArea.style.display = "block";

        this.renderTargetWord();
        this.renderElementSlots();
        this.startSolveTimer();

        this.dom.statusMessage.textContent = "Timer restarted! Enter elements from left to right.";
        this.dom.statusMessage.className = "info";

        if (this.dom.elementInput) {
            this.dom.elementInput.value = "";
            this.dom.elementInput.focus();
        }

        if (this.dom.archiveModal.classList.contains("active")) {
            this.renderCalendarView();
            this.renderArchiveList();
        }
    }

    handleSolveVictory() {
        this.isGameOver = true;
        this.stopSolveTimer();
        this.solveTimeMs = Math.max(100, Date.now() - this.startTime);

        if (!this.isPractice) {
            recordCompletion(
                this.currentDateStr,
                this.puzzleNumber,
                this.currentWord,
                true,
                this.placedElements,
                this.solveTimeMs
            );
        }

        const formatted = formatTimeMs(this.solveTimeMs);
        this.dom.statusMessage.textContent = `🎉 Fantastic! Solved in ${formatted}!`;
        this.dom.statusMessage.className = "success";

        if (this.dom.solvedCard) {
            this.dom.solvedCard.style.display = "block";
            this.dom.solvedTimeStat.textContent = `Solved in ${formatted}`;
        }
        if (this.dom.inputGroupArea) {
            this.dom.inputGroupArea.style.display = "none";
        }

        // Open stats modal after brief celebration pause
        setTimeout(() => {
            this.renderStatsModal();
            this.openModal(this.dom.statsModal);
        }, 700);
    }

    showElementDetails(elem) {
        if (!this.dom.elementDetails || !elem) return;
        this.dom.elementDetails.classList.add("active");
        this.dom.elementDetails.innerHTML = `
            <div class="big-element">
                <div class="element-symbol">${elem.symbol}</div>
                <div class="element-name">${elem.name}</div>
                <div class="element-number">Atomic Number: ${elem.number}</div>
            </div>
        `;
    }

    openModal(modal) {
        if (modal) modal.classList.add("active");
    }

    closeModal(modal) {
        if (modal) modal.classList.remove("active");
    }

    renderStatsModal() {
        const stats = getStats();
        if (this.dom.statPlayed) this.dom.statPlayed.textContent = stats.played;
        if (this.dom.statWinPct) this.dom.statWinPct.textContent = stats.played > 0 ? `${Math.round((stats.won / stats.played) * 100)}%` : "0%";
        if (this.dom.statStreak) this.dom.statStreak.textContent = stats.currentStreak;
        if (this.dom.statBestTime) this.dom.statBestTime.textContent = formatTimeMs(stats.bestTimeMs);

        // Render Solve Time Distribution
        if (this.dom.distBarsContainer) {
            const dist = stats.distribution || {};
            const maxCount = Math.max(1, ...Object.values(dist));
            const bins = ["< 10s", "10-20s", "20-30s", "30-60s", "1-2m", "> 2m"];
            const currentBin = this.isGameOver && this.solveTimeMs ? getTimeBin(this.solveTimeMs) : null;

            this.dom.distBarsContainer.innerHTML = bins.map(bin => {
                const count = dist[bin] || 0;
                const pct = count > 0 ? Math.max(12, Math.round((count / maxCount) * 100)) : 0;
                const isCurrent = (!this.isPractice && this.isGameOver && currentBin === bin);
                const fillClass = count > 0 ? (isCurrent ? "dist-fill highlight" : "dist-fill") : "dist-fill zero";
                return `
                    <div class="dist-row">
                        <span class="dist-label">${bin}</span>
                        <div class="dist-track">
                            <div class="${fillClass}" style="${count > 0 ? `width: ${pct}%` : ""}">
                                <span>${count}</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join("");
        }
    }

    copyShareCard() {
        const puzzleTag = this.isPractice ? "ElementSpeller Practice" : `ElementSpeller #${this.puzzleNumber}`;
        const timeStr = this.solveTimeMs ? `⏱️ ${formatTimeMs(this.solveTimeMs)}` : "⏱️ In Progress";
        const elemBoxes = this.placedElements.map(e => `[${e.symbol}]`).join(" ");
        const shareText = `🧪 ${puzzleTag} • ${timeStr}\n${elemBoxes}\nhttps://amitjoshi24.github.io/ElementSpeller/`;

        navigator.clipboard.writeText(shareText).then(() => {
            const btn = this.dom.shareBtn;
            if (btn) btn.textContent = "✅ Copied to Clipboard!";
            setTimeout(() => {
                if (btn) btn.innerHTML = "<span>📋 Share Result</span>";
            }, 2000);
        }).catch(() => {
            alert(shareText);
        });
    }

    // ---------------------------------------------------------------------------
    // Mastermindle-Style Calendar & List View Archive
    // ---------------------------------------------------------------------------

    setupArchiveTabs() {
        if (this.dom.archiveTabCal && this.dom.archiveTabList) {
            this.dom.archiveTabCal.onclick = () => {
                this.dom.archiveTabCal.classList.add("active");
                this.dom.archiveTabList.classList.remove("active");
                this.dom.calView.style.display = "block";
                this.dom.listView.style.display = "none";
                this.renderCalendarView();
            };

            this.dom.archiveTabList.onclick = () => {
                this.dom.archiveTabList.classList.add("active");
                this.dom.archiveTabCal.classList.remove("active");
                this.dom.listView.style.display = "block";
                this.dom.calView.style.display = "none";
                this.renderArchiveList();
            };
        }

        // Year select
        if (this.dom.calYearSelect) {
            this.dom.calYearSelect.innerHTML = "";
            const currentYear = parseDate(this.todayStr).getFullYear();
            for (let y = currentYear; y >= 2025; y--) {
                const opt = document.createElement("option");
                opt.value = String(y);
                opt.textContent = String(y);
                this.dom.calYearSelect.appendChild(opt);
            }
            this.dom.calYearSelect.value = String(this.calYear);
            this.dom.calYearSelect.onchange = (e) => {
                this.calYear = Number(e.target.value);
                this.renderCalendarView();
            };
        }

        // Month select
        if (this.dom.calMonthSelect) {
            this.dom.calMonthSelect.value = String(this.calMonth);
            this.dom.calMonthSelect.onchange = (e) => {
                this.calMonth = Number(e.target.value);
                this.renderCalendarView();
            };
        }

        // Month navigation buttons
        if (this.dom.calPrevBtn) {
            this.dom.calPrevBtn.onclick = () => {
                this.calMonth--;
                if (this.calMonth < 0) {
                    this.calMonth = 11;
                    this.calYear--;
                }
                this.renderCalendarView();
            };
        }

        if (this.dom.calNextBtn) {
            this.dom.calNextBtn.onclick = () => {
                this.calMonth++;
                if (this.calMonth > 11) {
                    this.calMonth = 0;
                    this.calYear++;
                }
                this.renderCalendarView();
            };
        }

        if (this.dom.calTodayBtn) {
            this.dom.calTodayBtn.onclick = () => {
                const t = parseDate(this.todayStr);
                this.calYear = t.getFullYear();
                this.calMonth = t.getMonth();
                this.renderCalendarView();
            };
        }

        // List view search & filter buttons
        if (this.dom.archiveSearchInput) {
            this.dom.archiveSearchInput.oninput = () => {
                this.renderArchiveList(this.dom.archiveSearchInput.value);
            };
        }

        document.querySelectorAll(".archive-filter-btn").forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll(".archive-filter-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                this.renderArchiveList(this.dom.archiveSearchInput ? this.dom.archiveSearchInput.value : "");
            };
        });
    }

    renderCalendarView() {
        const container = this.dom.calDaysContainer;
        if (!container) return;

        const todayDate = parseDate(this.todayStr);

        if (this.dom.calMonthSelect) this.dom.calMonthSelect.value = String(this.calMonth);
        if (this.dom.calYearSelect) this.dom.calYearSelect.value = String(this.calYear);

        // Disable Next when at or past today's month
        if (this.dom.calNextBtn) {
            const isFutureMonth =
                this.calYear > todayDate.getFullYear() ||
                (this.calYear === todayDate.getFullYear() && this.calMonth >= todayDate.getMonth());
            this.dom.calNextBtn.disabled = isFutureMonth;
        }

        const firstDayIndex = new Date(this.calYear, this.calMonth, 1).getDay(); // 0 = Sunday
        const totalDaysInMonth = new Date(this.calYear, this.calMonth + 1, 0).getDate();

        const history = getHistory();
        const cellsHtml = [];
        const TOTAL_SLOTS = 42; // Fixed 6 weeks for layout stability

        // Leading empty cells
        for (let i = 0; i < firstDayIndex; i++) {
            cellsHtml.push('<div class="calendar-day-cell is-empty"></div>');
        }

        // Day cells
        for (let day = 1; day <= totalDaysInMonth; day++) {
            const dateStr = `${this.calYear}-${String(this.calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const isFuture = dateStr > this.todayStr;
            const isToday = dateStr === this.todayStr;

            if (isFuture) {
                cellsHtml.push(`
                    <div class="calendar-day-cell is-future">
                        <div class="cal-day-num">${day}</div>
                    </div>
                `);
                continue;
            }

            const pNum = getPuzzleNumber(dateStr);
            const record = history[dateStr];

            let statusClass = "status-unplayed";
            let statusTag = "⚪";

            if (record && record.won) {
                statusClass = "status-won";
                statusTag = `⭐ ${formatTimeMs(record.solveTimeMs)}`;
            }

            cellsHtml.push(`
                <div class="calendar-day-cell ${statusClass} ${isToday ? "is-today" : ""}"
                     data-date="${dateStr}" title="Puzzle #${pNum} — ${dateStr}">
                    <div class="cal-day-num">${day}</div>
                    <div class="cal-puzzle-num">#${pNum}</div>
                    <div class="cal-status-tag">${statusTag}</div>
                </div>
            `);
        }

        // Trailing empty cells to fill 42 slots
        const filled = firstDayIndex + totalDaysInMonth;
        for (let i = filled; i < TOTAL_SLOTS; i++) {
            cellsHtml.push('<div class="calendar-day-cell is-empty"></div>');
        }

        container.innerHTML = cellsHtml.join("");

        // Click to load selected date puzzle
        container.querySelectorAll(".calendar-day-cell:not(.is-empty):not(.is-future)").forEach(el => {
            el.onclick = () => {
                const date = el.dataset.date;
                this.closeModal(this.dom.archiveModal);
                this.startPuzzle(date, false);
            };
        });
    }

    renderArchiveList(searchFilter = "") {
        const container = this.dom.archiveListContainer;
        if (!container) return;

        const history = getHistory();
        const todayNum = getPuzzleNumber(this.todayStr);
        const activeFilterBtn = document.querySelector(".archive-filter-btn.active");
        const filterMode = activeFilterBtn ? activeFilterBtn.dataset.filter : "all";

        const items = [];

        for (let pNum = todayNum; pNum >= 1; pNum--) {
            const dateStr = getDateForPuzzleNumber(pNum);
            const record = history[dateStr];
            const isSolved = record && record.won;
            const isPlayed = !!record;

            if (filterMode === "solved" && !isSolved) continue;
            if (filterMode === "unplayed" && isPlayed) continue;

            if (searchFilter) {
                const query = searchFilter.toLowerCase();
                if (!dateStr.includes(query) && !String(pNum).includes(query)) continue;
            }

            items.push({ pNum, dateStr, record, isSolved, isPlayed });
        }

        if (items.length === 0) {
            container.innerHTML = '<div style="padding: 20px; color: #888; text-align: center;">No puzzles match this filter.</div>';
            return;
        }

        container.innerHTML = items.map(item => {
            const badgeClass = item.isSolved ? "archive-status-badge won" : "archive-status-badge unplayed";
            const badgeText = item.isSolved ? `⭐ Solved (${formatTimeMs(item.record.solveTimeMs)})` : "⚪ Unplayed";
            return `
                <div class="archive-item">
                    <div class="archive-meta">
                        <span class="archive-pnum">ElementSpeller #${item.pNum}</span>
                        <span class="archive-date">${item.dateStr}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="${badgeClass}">${badgeText}</span>
                        <button class="archive-play-btn" data-date="${item.dateStr}">Play</button>
                    </div>
                </div>
            `;
        }).join("");

        container.querySelectorAll(".archive-play-btn").forEach(btn => {
            btn.onclick = (e) => {
                const date = e.target.dataset.date;
                this.closeModal(this.dom.archiveModal);
                this.startPuzzle(date, false);
            };
        });
    }

    startMidnightCountdown() {
        const update = () => {
            const now = new Date();
            const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
            const diffMs = tomorrow - now;
            const hours = String(Math.floor(diffMs / (1000 * 60 * 60))).padStart(2, "0");
            const minutes = String(Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, "0");
            const seconds = String(Math.floor((diffMs % (1000 * 60)) / 1000)).padStart(2, "0");
            if (this.dom.nextCountdown) {
                this.dom.nextCountdown.textContent = `${hours}:${minutes}:${seconds}`;
            }
        };
        update();
        setInterval(update, 1000);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    window.elementSpellerGame = new ElementSpellerGame();
    window.elementleGame = window.elementSpellerGame;
});
