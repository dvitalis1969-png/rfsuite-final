import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Import the Firebase configuration from the provisioned file
import firebaseConfig from './firebase-applet-config.json';

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Use the firestoreDatabaseId from the config if provided, otherwise default
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');
const storage = getStorage(app);

console.log("✅ Firebase initialized with provisioned config:", {
  projectId: firebaseConfig.projectId,
  databaseId: firebaseConfig.firestoreDatabaseId || '(default)'
});

export { auth, db, storage, googleProvider };
