# 🧪 ElementSpeller 📅

Spells words and phrases using chemical element symbols from the Periodic Table with **Dynamic Programming**, featuring both a daily speed puzzle game (**ElementSpeller Daily**) and an interactive custom phrase speller query tool.

---

## 📱 Install as an App (Add to Dock / Home Screen)

ElementSpeller is built as a Progressive Web App (PWA) with offline support via service workers. You can install it directly onto your computer or mobile device without an app store:

### 🖥️ Mac (Safari or Chrome)
- **Safari:**
  1. Open ElementSpeller in Safari.
  2. Click **File** in the top menu bar (or the **Share** button).
  3. Select **Add to Dock...**.
  4. Confirm the name **ElementSpeller** and click **Add**. It will now launch in its own window from your Mac Dock!
- **Chrome / Edge / Brave:**
  1. Click the **Install** icon on the right side of the URL address bar (or click the three dots menu `⋮` > **Cast, save, and share** > **Install ElementSpeller...**).
  2. Click **Install**.

### 📱 iPhone & iPad (Safari)
1. Open the game in Safari.
2. Tap the **Share** button (the square with an arrow pointing upward at the bottom of the screen).
3. Scroll down and tap **Add to Home Screen**.
4. Tap **Add** in the top-right corner. ElementSpeller will appear on your home screen with its custom beaker icon and launch full-screen!

### 🤖 Android (Chrome)
1. Open the game in Google Chrome.
2. Tap the three dots menu (`⋮`) in the top right corner.
3. Tap **Install app** or **Add to Home screen**.
4. Confirm to install ElementSpeller as a native app on your phone.

### 💻 Windows / Linux (Chrome or Edge)
1. Click the **Install** button in the URL address bar.
2. Confirm installation to add ElementSpeller to your Desktop and Start Menu.

---

## 🎮 Game Modes

### 1. 📅 ElementSpeller — Daily Puzzle Challenge (`/index.html`)
- **Daily Global Puzzle:** Uses a deterministic pseudo-random number generator (Mulberry32 PRNG) seeded by the date (`YYYY-MM-DD`). Everyone worldwide gets the exact same mystery word on any given day.
- **Rules:** Spell the target word by entering chemical elements from left to right (type the full element name like *Carbon*, *Iron*, *Helium*, or its symbol like *C*, *Fe*, *He*).
- **⏱️ Stopwatch & Speed:** Time is the primary objective! Click **Reveal Daily Word & Start Timer** when you're ready, and try to spell the word as fast as you can.
- **🗑️ Drag to Delete:** Need to replace or remove an element you placed earlier? You don't have to undo one-by-one—simply drag any placed element card into the **🗑️ trash can** (or click its `×` button) to delete it!
- **🔄 Undo & Reset:** Undo the last element or reset the entire puzzle anytime for a fresh timed run.
- **☁️ Google Sign-In & Cloud Sync:** Sign in with Google to sync stats, streaks, and solve history across devices with Firebase & Cloud Firestore.
- **📅 Past Puzzles Archive:** Full monthly calendar picker and list view to browse and play past puzzles.
- **📊 Statistics & Time Distribution:** Tracks games played, win %, current streak, max streak, best solve time, and solve time distribution.
- **📋 Share Result:** Generates and copies a spoiler-free summary to your clipboard.
- **⏳ Countdown Timer:** Real-time countdown to the next daily puzzle at midnight UTC.
- **♾️ Practice Mode:** Practice with unlimited random spellable words anytime.

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
