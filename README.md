# 🧪 ElementSpeller 📅

Spells words and phrases using chemical element symbols from the Periodic Table with **Dynamic Programming**, featuring both a daily word puzzle game (**ElementSpeller Daily**) and a custom phrase speller query tool.

---

## 🎮 Game Modes

### 1. 📅 ElementSpeller — Daily Puzzle Challenge (`/index.html`)
- **Daily Global Puzzle:** Uses a deterministic pseudo-random number generator (Mulberry32 PRNG) seeded by the date (`YYYY-MM-DD`). Everyone worldwide gets the exact same mystery word on any given day.
- **Rules:** The daily word is spellable using chemical elements. Enter the elements in order from left to right (type the full element name like *Carbon*, *Iron*, *Helium*, or its symbol).
- **Strikes System:** 5 strikes allowed per puzzle.
- **☁️ Google Sign-In & Cloud Sync:** Sign in with Google to sync stats, streaks, and solve history across devices with Firebase & Cloud Firestore.
- **📅 Past Puzzles Archive:** Browse and replay any past daily puzzle (by Date or Puzzle #). Filter by All, Solved, or Unplayed.
- **📊 Statistics & Distribution:** Tracks games played, win %, current streak, max streak, and strikes distribution.
- **📋 Share Result:** Generates and copies an emoji-grid summary to your clipboard.
- **⏳ Countdown Timer:** Real-time countdown to the next daily puzzle at midnight UTC.
- **♾️ Unlimited / Practice Mode:** Play unlimited random spellable words anytime.

### 2. 🔍 Custom Speller (`/query/index.html`)
- **Interactive Query Tool:** Enter any custom word or phrase to see it decomposed into chemical element symbols.
- **Hover Card Details:** Inspect the atomic number, symbol, and full element name.
- **Dynamic Programming Engine:** Powered by Python PyScript / WebAssembly.

---

## ☕ Support
If you enjoy ElementSpeller, consider supporting development:
👉 **[Support Amit on Ko-fi](https://ko-fi.com/I2I81CDN0L)**

---

## 👨‍💻 Created by
**Amit Joshi** — [@amitjoshi2724](https://github.com/amitjoshi2724)
