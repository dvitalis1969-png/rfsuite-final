import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, DocumentReference, DocumentSnapshot, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, CollectionReference } from 'firebase/firestore';
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

export const getDocWithTimeout = async (docRef: DocumentReference, timeoutMs: number = 5000): Promise<DocumentSnapshot> => {
  return Promise.race([
    getDoc(docRef),
    new Promise<DocumentSnapshot>((_, reject) => 
      setTimeout(() => reject(new Error('client is offline (timeout)')), timeoutMs)
    )
  ]);
};

export const getDocsWithTimeout = async (query: any, timeoutMs: number = 5000): Promise<any> => {
  return Promise.race([
    getDocs(query),
    new Promise<any>((_, reject) => 
      setTimeout(() => reject(new Error('client is offline (timeout)')), timeoutMs)
    )
  ]);
};

export const setDocWithTimeout = async (docRef: DocumentReference, data: any, options?: any, timeoutMs: number = 5000): Promise<void> => {
  return Promise.race([
    options ? setDoc(docRef, data, options) : setDoc(docRef, data),
    new Promise<void>((_, reject) => 
      setTimeout(() => reject(new Error('client is offline (timeout)')), timeoutMs)
    )
  ]);
};

export const addDocWithTimeout = async (collectionRef: CollectionReference, data: any, timeoutMs: number = 5000): Promise<DocumentReference> => {
  return Promise.race([
    addDoc(collectionRef, data),
    new Promise<DocumentReference>((_, reject) => 
      setTimeout(() => reject(new Error('client is offline (timeout)')), timeoutMs)
    )
  ]);
};

export const updateDocWithTimeout = async (docRef: DocumentReference, data: any, timeoutMs: number = 5000): Promise<void> => {
  return Promise.race([
    updateDoc(docRef, data),
    new Promise<void>((_, reject) => 
      setTimeout(() => reject(new Error('client is offline (timeout)')), timeoutMs)
    )
  ]);
};

export const deleteDocWithTimeout = async (docRef: DocumentReference, timeoutMs: number = 5000): Promise<void> => {
  return Promise.race([
    deleteDoc(docRef),
    new Promise<void>((_, reject) => 
      setTimeout(() => reject(new Error('client is offline (timeout)')), timeoutMs)
    )
  ]);
};

export { auth, db, storage, googleProvider };
