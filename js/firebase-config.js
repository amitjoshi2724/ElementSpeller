/**
 * Firebase Modular Configuration
 * Imports Firebase v10.12.0 SDK via official gstatic CDN ES modules.
 */
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export const FIREBASE_CONFIG = {
    apiKey: "AIzaSyAuLNUU58o9-lQ0On8XIqZZ1IIZ24zqGEE",
    authDomain: "element-speller-amitjoshi2724.firebaseapp.com",
    projectId: "element-speller-amitjoshi2724",
    storageBucket: "element-speller-amitjoshi2724.firebasestorage.app",
    messagingSenderId: "743497690246",
    appId: "1:743497690246:web:63a9177a17be8951d03507",
    measurementId: "G-JQP8CHKRGR"
};

// Initialize Firebase App singleton
export const app = getApps().length > 0 ? getApp() : initializeApp(FIREBASE_CONFIG);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Authentication Provider: Google
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
