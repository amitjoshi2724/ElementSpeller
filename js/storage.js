/**
 * ElementSpeller - Dual-Layer Storage Module
 * Offline-first localStorage with real-time Firestore cloud synchronization.
 * Seamlessly supports file:// protocol, offline play, and multi-device Google Sync.
 */
import { initFirebase } from './firebase-config.js';
import { onAuthChange, getCurrentUser } from './auth.js';

let firestoreDb = null;
let firestoreFns = null;

// Initialize Firestore if running on http/https
(async () => {
    try {
        const fb = await initFirebase();
        if (fb && fb.db) {
            firestoreDb = fb.db;
            firestoreFns = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
        }
    } catch (e) {
        console.warn("Firestore unavailable, running in local-storage-only mode:", e);
    }
})();

const STATS_KEY = 'elementspeller_stats_v1';
const HISTORY_KEY = 'elementspeller_history_v1';
const ACTIVE_KEY = 'elementspeller_active_state_v1';

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
            raw = localStorage.getItem('elementle_stats_v1');
            if (raw) localStorage.setItem(STATS_KEY, raw);
        }
        if (raw) return { ...DEFAULT_STATS, ...JSON.parse(raw) };
    } catch (e) {
        console.error('Failed to parse local stats:', e);
    }
    return { ...DEFAULT_STATS };
}

export function loadLocalHistory() {
    try {
        let raw = localStorage.getItem(HISTORY_KEY);
        if (!raw) {
            raw = localStorage.getItem('elementle_history_v1');
            if (raw) localStorage.setItem(HISTORY_KEY, raw);
        }
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
    } catch (e) {
        console.error("Failed to save local stats:", e);
    }
    syncToCloud();
    notifyListeners();
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
        let raw = localStorage.getItem(ACTIVE_KEY);
        if (!raw) {
            raw = localStorage.getItem('elementle_active_state_v1');
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
        localStorage.removeItem('elementle_active_state_v1');
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
        const userRef = firestoreFns.doc(firestoreDb, 'users', user.uid);
        const cleanStats = sanitizeStats(memoryStats, memoryHistory);
        await firestoreFns.setDoc(userRef, {
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
        const userRef = firestoreFns.doc(firestoreDb, 'users', user.uid);
        const snap = await firestoreFns.getDoc(userRef);

        if (snap.exists()) {
            const cloudData = snap.data();
            const cloudStats = cloudData.elementspeller_stats || cloudData.elementle_stats || {};
            const cloudHistory = cloudData.elementspeller_history || cloudData.elementle_history || {};

            // Merge history: union of completed puzzles
            const mergedHistory = { ...memoryHistory };
            for (const [date, rec] of Object.entries(cloudHistory)) {
                if (!mergedHistory[date]) {
                    mergedHistory[date] = rec;
                } else if (rec.won && (!mergedHistory[date].won || rec.strikes < mergedHistory[date].strikes)) {
                    mergedHistory[date] = rec;
                }
            }

            // Merge stats
            const mergedStats = {
                played: Math.max(memoryStats.played, cloudStats.played || 0),
                won: Math.max(memoryStats.won, cloudStats.won || 0),
                currentStreak: Math.max(memoryStats.currentStreak, cloudStats.currentStreak || 0),
                maxStreak: Math.max(memoryStats.maxStreak, cloudStats.maxStreak || 0),
                lastPlayedDate: memoryStats.lastPlayedDate || cloudStats.lastPlayedDate || null,
                distribution: { ...DEFAULT_STATS.distribution }
            };

            memoryHistory = mergedHistory;
            memoryStats = sanitizeStats(mergedStats, memoryHistory);

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
                const incomingHist = updated.elementspeller_history || updated.elementle_history;
                const incomingStats = updated.elementspeller_stats || updated.elementle_stats;
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
