/**
 * Deterministic PRNG & Date Arithmetic Module for Elementle / Daily Element Speller
 * Uses Mulberry32 algorithm seeded by date hash.
 */
import { WORDS } from './words.js';

// Epoch for Puzzle #1: Jan 1, 2025
export const EPOCH_DATE_STR = '2025-01-01';

export function hashString(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

export function createMulberry32(seed) {
    let s = seed >>> 0;
    return function() {
        s = (s + 0x6D2B79F5) >>> 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export function parseDate(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export function getTodayDateStr() {
    return formatDate(new Date());
}

export function getPuzzleNumber(dateStr, epochStr = EPOCH_DATE_STR) {
    const [y1, m1, d1] = dateStr.split('-').map(Number);
    const [y2, m2, d2] = epochStr.split('-').map(Number);
    const utc1 = Date.UTC(y1, m1 - 1, d1);
    const utc2 = Date.UTC(y2, m2 - 1, d2);
    return Math.max(1, Math.round((utc1 - utc2) / (1000 * 60 * 60 * 24)) + 1);
}

export function getDateForPuzzleNumber(puzzleNum, epochStr = EPOCH_DATE_STR) {
    const [y2, m2, d2] = epochStr.split('-').map(Number);
    const d = new Date(Date.UTC(y2, m2 - 1, d2 + (puzzleNum - 1)));
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/**
 * Deterministically pick today's daily word using Mulberry32.
 */
export function getDailyWord(dateStr) {
    const seedVal = hashString(`elementle-word-${dateStr}`);
    const rng = createMulberry32(seedVal);
    const idx = Math.floor(rng() * WORDS.length);
    return {
        word: WORDS[idx],
        puzzleNumber: getPuzzleNumber(dateStr),
        dateStr
    };
}

/**
 * Pick a random word for Unlimited / Practice mode.
 */
export function getRandomWord() {
    const idx = Math.floor(Math.random() * WORDS.length);
    return {
        word: WORDS[idx],
        isPractice: true
    };
}
