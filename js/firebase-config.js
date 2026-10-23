/**
 * Firebase Modular Configuration
 * Dynamically loads Firebase v10.12.0 SDK on-demand so offline PWA startup is 100% resilient.
 */
export const FIREBASE_CONFIG = {
    apiKey: "AIzaSyAuLNUU58o9-lQ0On8XIqZZ1IIZ24zqGEE",
    authDomain: "element-speller-amitjoshi2724.firebaseapp.com",
    projectId: "element-speller-amitjoshi2724",
    storageBucket: "element-speller-amitjoshi2724.firebasestorage.app",
    messagingSenderId: "743497690246",
    appId: "1:743497690246:web:63a9177a17be8951d03507",
    measurementId: "G-JQP8CHKRGR"
};

let _app = null;
let _auth = null;
let _db = null;
let _googleProvider = null;
let _initPromise = null;

export async function getFirebaseServices() {
    if (_initPromise) return _initPromise;
    _initPromise = (async () => {
        try {
            const { initializeApp, getApps, getApp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
            const { getAuth, GoogleAuthProvider } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
            const { getFirestore } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");

            _app = getApps().length > 0 ? getApp() : initializeApp(FIREBASE_CONFIG);
            _auth = getAuth(_app);
            _db = getFirestore(_app);
            _googleProvider = new GoogleAuthProvider();
            _googleProvider.setCustomParameters({ prompt: 'select_account' });

            return {
                app: _app,
                auth: _auth,
                db: _db,
                googleProvider: _googleProvider,
                isAvailable: true
            };
        } catch (err) {
            console.warn("Firebase SDK unreachable (running in local offline mode):", err);
            return {
                app: null,
                auth: null,
                db: null,
                googleProvider: null,
                isAvailable: false
            };
        }
    })();
    return _initPromise;
}

export function getAppInstance() { return _app; }
export function getAuthInstance() { return _auth; }
export function getDbInstance() { return _db; }
export function getGoogleProvider() { return _googleProvider; }
