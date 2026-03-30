import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Import the Firebase configuration optionally to avoid build errors if missing
const configModules = import.meta.glob('./firebase-applet-config.json', { eager: true });
const configKeys = Object.keys(configModules);

let firebaseConfig: any = {};

if (configKeys.length > 0) {
  firebaseConfig = (configModules[configKeys[0]] as any).default || configModules[configKeys[0]];
} else {
  // Fallback to environment variables
  firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    firestoreDatabaseId: import.meta.env.VITE_FIRESTORE_DATABASE_ID || '(default)'
  };
}

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Use the firestoreDatabaseId from the config if provided, otherwise default
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');
const storage = getStorage(app);

console.log("✅ Firebase initialized with config:", {
  projectId: firebaseConfig.projectId,
  databaseId: firebaseConfig.firestoreDatabaseId || '(default)'
});

export { auth, db, storage, googleProvider };
