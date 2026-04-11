import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { initializeFirestore, getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID
};

// 1. Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// 2. Export Auth and Storage immediately
export const auth = getAuth(app);
export const storage = getStorage(app);
export const messaging = null;

// 3. Initialize Firestore with Long Polling (Safe Multi-Call Guard)
let dbInstance;
if (getApps().length > 0) {
    try {
        dbInstance = getFirestore(app);
    } catch (e) {
        dbInstance = initializeFirestore(app, { experimentalForceLongPolling: true });
    }
} else {
    dbInstance = initializeFirestore(app, { experimentalForceLongPolling: true });
}

export const db = dbInstance;

console.log('--- FIREBASE OK ---');
