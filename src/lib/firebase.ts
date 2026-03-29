import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Firebase configuration using environment variables
// These should be set in AI Studio Settings or Render Environment Variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

let firestoreDatabaseId = import.meta.env.VITE_FIRESTORE_DATABASE_ID || '(default)';
if (firestoreDatabaseId === 'default') {
  firestoreDatabaseId = '(default)';
}

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const db = getFirestore(app, firestoreDatabaseId);
const storage = getStorage(app);

console.log("✅ Firebase initialized with config:", {
  ...firebaseConfig,
  apiKey: firebaseConfig.apiKey ? "********" : "MISSING",
  projectId: firebaseConfig.projectId || "MISSING"
});
console.log("✅ Firestore DB ID:", firestoreDatabaseId);

export { auth, db, storage, googleProvider };
