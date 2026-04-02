// Firebase initialization using environment variables
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

/**
 * Firebase configuration is loaded from environment variables to avoid committing secrets.
 * Create a `.env` file in `frontend/` (or set env vars in your hosting provider).
 *
 * Required variable names (example):
 * REACT_APP_FIREBASE_API_KEY
 * REACT_APP_FIREBASE_AUTH_DOMAIN
 * REACT_APP_FIREBASE_DATABASE_URL
 * REACT_APP_FIREBASE_PROJECT_ID
 * REACT_APP_FIREBASE_STORAGE_BUCKET
 * REACT_APP_FIREBASE_MESSAGING_SENDER_ID
 * REACT_APP_FIREBASE_APP_ID
 * REACT_APP_FIREBASE_MEASUREMENT_ID
 */
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

const missing = Object.keys(firebaseConfig).filter((k) => !firebaseConfig[k]);
if (missing.length) {
  // eslint-disable-next-line no-console
  console.warn('Missing Firebase env vars:', missing.join(', '));
}

const app = initializeApp(firebaseConfig);

let analytics;
if (typeof window !== 'undefined' && firebaseConfig.measurementId) {
  try {
    analytics = getAnalytics(app);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Firebase analytics not initialized:', err.message || err);
  }
}

export { app, analytics };
export default app;
