import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

const databaseId =
  firebaseConfig.firestoreDatabaseId &&
  firebaseConfig.firestoreDatabaseId !== '(default)' &&
  firebaseConfig.firestoreDatabaseId !== ''
    ? firebaseConfig.firestoreDatabaseId
    : null;

export const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
export const auth = getAuth(app);

/**
 * Resolves once the client has an auth identity (or once we know we can't get
 * one). firestore.rules requires `request.auth != null`, so every read/write
 * waits on this.
 *
 * If Anonymous sign-in has not been enabled in the Firebase console this
 * rejects and we carry on unauthenticated -- which still works against the old
 * permissive rules, so enabling auth and deploying the new rules can happen in
 * either order without taking the app down.
 */
export const authReady: Promise<void> = new Promise((resolve) => {
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    if (user) {
      unsubscribe();
      resolve();
    }
  });

  signInAnonymously(auth).catch((err) => {
    console.error(
      'Anonymous sign-in failed. Enable Authentication -> Sign-in method -> ' +
        'Anonymous in the Firebase console before deploying firestore.rules.',
      err
    );
    unsubscribe();
    resolve();
  });
});
