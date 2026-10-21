/**
 * ElementSpeller - Dual-Layer Storage Module
 * Offline-first localStorage with real-time Firestore cloud synchronization.
 * Supports timer-based solves, streaks, replay/reset, and calendar history.
 */
import { db } from "./firebase-config.js";
import { onAuthChange, getCurrentUser } from "./auth.js";
import { doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firestoreDb = db;
const firestoreFns = { doc, getDoc, setDoc, onSnapshot };

const STATS_KEY = "elementspeller_stats_v1";
const HISTORY_KEY = "elementspeller_history_v1";
const ACTIVE_KEY = "elementspeller_active_state_v1";

export const DEFAULT_STATS = {
    played: 0,
    won: 0,
    currentStreak: 0,
    maxStreak: 0,
    bestTimeMs: null,
    totalTimeMs: 0,
    lastPlayedDate: null,
    // Solve time distribution bins
    distribution: {
        "< 10s": 0,
        "10-20s": 0,
        "20-30s": 0,
        "30-60s": 0,
        "1-2m": 0,
        "> 2m": 0
    }
};

export function getTimeBin(ms) {
    if (!ms || ms <= 0) return "> 2m";
    const sec = ms / 1000;
    if (sec < 10) return "< 10s";
    if (sec < 20) return "10-20s";
    if (sec < 30) return "20-30s";
    if (sec < 60) return "30-60s";
    if (sec < 120) return "1-2m";
    return "> 2m";
}

export function formatTimeMs(ms) {
    if (!ms || ms <= 0) return "--";
    const totalSec = ms / 1000;
    if (totalSec < 60) return `${totalSec.toFixed(1)}s`;
    const m = Math.floor(totalSec / 60);
    const s = Math.floor(totalSec % 60);
    return `${m}m ${s}s`;
}

let memoryHistory = loadLocalHistory();
let memoryStats = sanitizeStats(loadLocalStats(), memoryHistory);

try {
    localStorage.setItem(STATS_KEY, JSON.stringify(memoryStats));
} catch (e) { }

let firestoreUnsubscribe = null;
const storageChangeListeners = new Set();

export function onStorageChange(callback) {
    storageChangeListeners.add(callback);
    return () => storageChangeListeners.delete(callback);
}

function notifyListeners() {
    storageChangeListeners.forEach(cb => {
        try {
            cb({ stats: memoryStats, history: memoryHistory });
        } catch (e) {
            console.error("Error in storage listener:", e);
        }
    });
}

export function loadLocalStats() {
    try {
        let raw = localStorage.getItem(STATS_KEY);
        if (!raw) {
            raw = localStorage.getItem("elementle_stats_v1");
            if (raw) localStorage.setItem(STATS_KEY, raw);
        }
        if (raw) return { ...DEFAULT_STATS, ...JSON.parse(raw) };
    } catch (e) {
        console.error("Failed to parse local stats:", e);
    }
    return { ...DEFAULT_STATS };
}

export function loadLocalHistory() {
    try {
        let raw = localStorage.getItem(HISTORY_KEY);
        if (!raw) {
            raw = localStorage.getItem("elementle_history_v1");
            if (raw) localStorage.setItem(HISTORY_KEY, raw);
        }
        if (raw) return JSON.parse(raw);
    } catch (e) {
        console.error("Failed to parse local history:", e);
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
            const p = new Date(prevDate + "T00:00:00Z");
            const c = new Date(d + "T00:00:00Z");
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
    const p = new Date(lastDate + "T00:00:00Z");
    const t = new Date(todayStr + "T00:00:00Z");
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
        let totalTime = 0;
        let bestTime = null;
        const dist = {
            "< 10s": 0,
            "10-20s": 0,
            "20-30s": 0,
            "30-60s": 0,
            "1-2m": 0,
            "> 2m": 0
        };

        for (const r of entries) {
            if (r.won) {
                won++;
                if (r.solveTimeMs && r.solveTimeMs > 0) {
                    totalTime += r.solveTimeMs;
                    bestTime = (bestTime === null) ? r.solveTimeMs : Math.min(bestTime, r.solveTimeMs);
                    const bin = getTimeBin(r.solveTimeMs);
                    dist[bin] = (dist[bin] || 0) + 1;
                }
            }
        }

        clean.played = Math.max(clean.played, entries.length);
        clean.won = won;
        clean.bestTimeMs = bestTime;
        clean.totalTimeMs = totalTime;
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
    } catch (e) {
        console.error("Failed to save local stats:", e);
    }
    syncToCloud();
    notifyListeners();
}

export function recordCompletion(dateStr, puzzleNum, word, won, elementsUsed, solveTimeMs) {
    const existing = memoryHistory[dateStr];
    // If previously completed, preserve best time
    let finalSolveTime = solveTimeMs;
    if (existing && existing.won && existing.solveTimeMs) {
        finalSolveTime = Math.min(existing.solveTimeMs, solveTimeMs);
    }

    const record = {
        dateStr,
        puzzleNum,
        word,
        won: true,
        solveTimeMs: finalSolveTime,
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

/**
 * Reset a daily puzzle so player can replay and try for a faster time
 */
export async function resetDailyGameResult(dateStr) {
    delete memoryHistory[dateStr];
    try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(memoryHistory));
    } catch (e) { }

    clearActiveState(dateStr);
    memoryStats = sanitizeStats(memoryStats, memoryHistory);
    try {
        localStorage.setItem(STATS_KEY, JSON.stringify(memoryStats));
    } catch (e) { }

    await syncToCloud();
    notifyListeners();
    return true;
}

export function saveActiveState(dateStr, state) {
    try {
        localStorage.setItem(ACTIVE_KEY, JSON.stringify({ dateStr, state, timestamp: Date.now() }));
    } catch (e) { }
}

export function loadActiveState(dateStr) {
    try {
        let raw = localStorage.getItem(ACTIVE_KEY);
        if (!raw) {
            raw = localStorage.getItem("elementle_active_state_v1");
        }
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
        localStorage.removeItem("elementle_active_state_v1");
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

/**
 * Sync local state to Firestore
 */
async function syncToCloud() {
    const user = getCurrentUser();
    if (!user || !firestoreDb || !firestoreFns) return;

    try {
        const userRef = firestoreFns.doc(firestoreDb, "users", user.uid);
        const cleanStats = sanitizeStats(memoryStats, memoryHistory);
        await firestoreFns.setDoc(userRef, {
            element_speller_stats: cleanStats,
            element_speller_history: memoryHistory,
            elementspeller_stats: cleanStats,
            elementspeller_history: memoryHistory,
            lastUpdated: Date.now()
        }, { merge: true });
    } catch (e) {
        console.warn("Could not sync ElementSpeller data to Firestore:", e);
    }
}

/**
 * Listen for auth change to load / merge cloud profile
 */
onAuthChange(async (user) => {
    if (firestoreUnsubscribe) {
        firestoreUnsubscribe();
        firestoreUnsubscribe = null;
    }

    if (!user || !firestoreDb || !firestoreFns) return;

    try {
        const userRef = firestoreFns.doc(firestoreDb, "users", user.uid);
        const snap = await firestoreFns.getDoc(userRef);

        if (snap.exists()) {
            const cloudData = snap.data();
            const cloudStats = cloudData.element_speller_stats || cloudData.elementspeller_stats || cloudData.elementle_stats || {};
            const cloudHistory = cloudData.element_speller_history || cloudData.elementspeller_history || cloudData.elementle_history || {};

            // Merge history: union of completed puzzles
            const mergedHistory = { ...memoryHistory };
            for (const [date, rec] of Object.entries(cloudHistory)) {
                if (!mergedHistory[date]) {
                    mergedHistory[date] = rec;
                } else if (rec.won) {
                    if (!mergedHistory[date].won || (rec.solveTimeMs && (!mergedHistory[date].solveTimeMs || rec.solveTimeMs < mergedHistory[date].solveTimeMs))) {
                        mergedHistory[date] = rec;
                    }
                }
            }

            memoryHistory = mergedHistory;
            memoryStats = sanitizeStats(cloudStats, memoryHistory);

            localStorage.setItem(STATS_KEY, JSON.stringify(memoryStats));
            localStorage.setItem(HISTORY_KEY, JSON.stringify(memoryHistory));
            notifyListeners();

            // Push clean merged data back to cloud
            await syncToCloud();
        } else {
            // First time login for this user: seed cloud with current local stats
            await syncToCloud();
        }

        // Setup real-time listener for multi-tab or cross-device updates
        firestoreUnsubscribe = firestoreFns.onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
                const updated = docSnap.data();
                const incomingHist = updated.element_speller_history || updated.elementspeller_history || updated.elementle_history;
                const incomingStats = updated.element_speller_stats || updated.elementspeller_stats || updated.elementle_stats;
                if (incomingHist) memoryHistory = { ...memoryHistory, ...incomingHist };
                if (incomingStats) {
                    memoryStats = sanitizeStats({ ...DEFAULT_STATS, ...incomingStats }, memoryHistory);
                } else {
                    memoryStats = sanitizeStats(memoryStats, memoryHistory);
                }
                localStorage.setItem(STATS_KEY, JSON.stringify(memoryStats));
                localStorage.setItem(HISTORY_KEY, JSON.stringify(memoryHistory));
                notifyListeners();
            }
        });
    } catch (e) {
        console.warn("Error setting up Firestore storage sync:", e);
    }
});
