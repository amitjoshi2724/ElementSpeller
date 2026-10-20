/**
 * Offline-first localStorage module with streak & stats tracking for Elementle.
 */
const STATS_KEY = 'elementle_stats_v1';
const HISTORY_KEY = 'elementle_history_v1';
const ACTIVE_KEY = 'elementle_active_state_v1';

export const DEFAULT_STATS = {
    played: 0,
    won: 0,
    currentStreak: 0,
    maxStreak: 0,
    lastPlayedDate: null,
    // Strike distribution: solved with 0, 1, 2, 3, 4, or 5 strikes
    distribution: {
        '0': 0,
        '1': 0,
        '2': 0,
        '3': 0,
        '4': 0,
        '5': 0
    }
};

let memoryHistory = loadLocalHistory();
let memoryStats = sanitizeStats(loadLocalStats(), memoryHistory);

export function loadLocalStats() {
    try {
        const raw = localStorage.getItem(STATS_KEY);
        if (raw) return { ...DEFAULT_STATS, ...JSON.parse(raw) };
    } catch (e) {
        console.error('Failed to parse local stats:', e);
    }
    return { ...DEFAULT_STATS };
}

export function loadLocalHistory() {
    try {
        const raw = localStorage.getItem(HISTORY_KEY);
        if (raw) return JSON.parse(raw);
    } catch (e) {
        console.error('Failed to parse local history:', e);
    }
    return {};
}

function computeStreaksFromHistory(history) {
    const dates = Object.keys(history || {}).sort();
    if (dates.length === 0) return { currentStreak: 0, maxStreak: 0 };

    let maxStreak = 0;
    let tempStreak = 0;
    let prevDate = null;

    for (const d of dates) {
        const rec = history[d];
        if (!rec || !rec.won) {
            tempStreak = 0;
            prevDate = d;
            continue;
        }

        if (!prevDate) {
            tempStreak = 1;
        } else {
            const p = new Date(prevDate + 'T00:00:00Z');
            const c = new Date(d + 'T00:00:00Z');
            const diffDays = Math.round((c - p) / (1000 * 60 * 60 * 24));
            if (diffDays === 1) {
                tempStreak++;
            } else {
                tempStreak = 1;
            }
        }
        if (tempStreak > maxStreak) maxStreak = tempStreak;
        prevDate = d;
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const lastDate = dates[dates.length - 1];
    const p = new Date(lastDate + 'T00:00:00Z');
    const t = new Date(todayStr + 'T00:00:00Z');
    const diffFromToday = Math.round((t - p) / (1000 * 60 * 60 * 24));
    const currentStreak = (diffFromToday <= 1 && history[lastDate]?.won) ? tempStreak : 0;

    return { currentStreak, maxStreak };
}

function sanitizeStats(stats, history) {
    const clean = { ...DEFAULT_STATS, ...(stats || {}) };
    clean.distribution = { ...DEFAULT_STATS.distribution, ...(clean.distribution || {}) };

    const entries = Object.values(history || {});
    if (entries.length > 0) {
        let won = 0;
        const dist = { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
        for (const r of entries) {
            if (r.won) {
                won++;
                const s = String(Math.min(5, Math.max(0, r.strikes || 0)));
                dist[s] = (dist[s] || 0) + 1;
            }
        }
        clean.played = Math.max(clean.played, entries.length);
        clean.won = Math.max(clean.won, won);
        clean.distribution = dist;
        const { currentStreak, maxStreak } = computeStreaksFromHistory(history);
        clean.currentStreak = currentStreak;
        clean.maxStreak = Math.max(clean.maxStreak, maxStreak);
    }
    return clean;
}

export function saveLocalStats(stats) {
    memoryStats = sanitizeStats(stats, memoryHistory);
    try {
        localStorage.setItem(STATS_KEY, JSON.stringify(memoryStats));
    } catch (e) { }
}

export function recordCompletion(dateStr, puzzleNum, word, won, strikes, elementsUsed) {
    const record = {
        dateStr,
        puzzleNum,
        word,
        won,
        strikes,
        elementsUsed,
        timestamp: Date.now()
    };

    memoryHistory[dateStr] = record;
    try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(memoryHistory));
    } catch (e) { }

    const stats = sanitizeStats(memoryStats, memoryHistory);
    stats.lastPlayedDate = dateStr;
    saveLocalStats(stats);
    clearActiveState(dateStr);
    return record;
}

export function saveActiveState(dateStr, state) {
    try {
        localStorage.setItem(ACTIVE_KEY, JSON.stringify({ dateStr, state, timestamp: Date.now() }));
    } catch (e) { }
}

export function loadActiveState(dateStr) {
    try {
        const raw = localStorage.getItem(ACTIVE_KEY);
        if (raw) {
            const data = JSON.parse(raw);
            if (data.dateStr === dateStr) return data.state;
        }
    } catch (e) { }
    return null;
}

export function clearActiveState(dateStr) {
    try {
        const raw = localStorage.getItem(ACTIVE_KEY);
        if (raw) {
            const data = JSON.parse(raw);
            if (data.dateStr === dateStr) localStorage.removeItem(ACTIVE_KEY);
        }
    } catch (e) { }
}

export function getStats() {
    return sanitizeStats(memoryStats, memoryHistory);
}

export function getHistory() {
    return { ...memoryHistory };
}

export function getRecordForDate(dateStr) {
    return memoryHistory[dateStr] || null;
}
