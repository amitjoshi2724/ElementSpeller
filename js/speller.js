import { symbolToData, nameToData, elementData } from './elements.js';

/**
 * Checks if a word (or suffix) can be spelled using chemical element symbols.
 * Port of the exact dynamic programming algorithm from elementspeller.py
 */
export function isSpellable(word) {
    const w = (word || '').toLowerCase();
    if (w.length === 0) return true;
    const tfdp = new Array(w.length + 1).fill(false);
    tfdp[w.length] = true;

    for (let i = w.length - 1; i >= 0; i--) {
        for (let end = i + 1; end <= Math.min(w.length, i + 2); end++) {
            const sub = w.substring(i, end);
            if (tfdp[end] && symbolToData[sub]) {
                tfdp[i] = true;
                break;
            }
        }
    }
    return tfdp[0];
}

/**
 * Finds all valid next element choices at index `startIndex` of `word`.
 * An element is valid if its symbol matches word.slice(startIndex, startIndex + len)
 * AND the remaining suffix is spellable.
 */
export function getValidNextElements(word, startIndex) {
    const w = (word || '').toLowerCase();
    const remaining = w.slice(startIndex);
    if (!remaining) return [];

    const valid = [];
    // Check 1-letter and 2-letter matches
    for (let len = 1; len <= Math.min(2, remaining.length); len++) {
        const sub = remaining.slice(0, len);
        const elem = symbolToData[sub];
        if (elem && isSpellable(remaining.slice(len))) {
            valid.push(elem);
        }
    }
    return valid;
}

/**
 * Validate a user's guess (either by element name or symbol) at current index.
 * Returns { valid: true, element, nextIndex } or { valid: false, reason, matchedElement }
 */
export function validateElementGuess(word, startIndex, input) {
    const clean = (input || '').trim().toLowerCase();
    if (!clean) {
        return { valid: false, reason: 'Please enter an element name or symbol!' };
    }

    // Lookup element by name or symbol
    const element = nameToData[clean] || symbolToData[clean];
    if (!element) {
        return { valid: false, reason: `"${input}" is not a recognized chemical element.` };
    }

    const validChoices = getValidNextElements(word, startIndex);
    const matched = validChoices.find(c => c.symbol.toLowerCase() === element.symbol.toLowerCase());

    if (matched) {
        return {
            valid: true,
            element: matched,
            nextIndex: startIndex + matched.symbol.length
        };
    } else {
        const remaining = word.slice(startIndex).toUpperCase();
        return {
            valid: false,
            element,
            reason: `"${element.name}" (${element.symbol}) does not spell the next part of "${remaining}".`
        };
    }
}

/**
 * Solves a word into an array of element objects using DP.
 */
export function solveWord(word) {
    const w = (word || '').toLowerCase();
    if (!isSpellable(w)) return null;

    const dp = new Array(w.length + 1).fill(null);
    dp[w.length] = { element: null, next: null };
    const tfdp = new Array(w.length + 1).fill(false);
    tfdp[w.length] = true;

    for (let i = w.length - 1; i >= 0; i--) {
        for (let end = i + 1; end <= Math.min(w.length, i + 2); end++) {
            const sub = w.substring(i, end);
            if (tfdp[end] && symbolToData[sub]) {
                dp[i] = { element: symbolToData[sub], next: end };
                tfdp[i] = true;
                break;
            }
        }
    }

    const result = [];
    let cur = 0;
    while (cur < w.length && dp[cur] && dp[cur].element) {
        result.push(dp[cur].element);
        cur = dp[cur].next;
    }
    return result;
}
