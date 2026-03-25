import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Use environment variables for configuration
// These are automatically populated by the platform when Firebase is set up
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || process.env.GEMINI_API_KEY, // Fallback for some environments
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || '(default)'
};

let app: any = null;
let auth: any = null;
let db: any = null;
let storage: any = null;

if (config.apiKey) {
  try {
    app = initializeApp(config);
    auth = getAuth(app);
    db = getFirestore(app, (config as any).firestoreDatabaseId);
    storage = getStorage(app);
    console.log("✅ Firebase successfully initialized!");
  } catch (error) {
    console.error("❌ Firebase initialization error:", error);
  }
} else {
  console.warn("⚠️ Firebase API Key is missing. Please complete the Firebase setup in the UI.");
}

export { auth, db, storage };
