// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

// Your web app's Firebase configuration
// REPLACE THIS WITH YOUR OWN FIREBASE CONFIG OBJECT FROM THE FIREBASE CONSOLE
const firebaseConfig = {
  apiKey: "AIzaSyAwVPCMkyQ4_XgIN4ROUFrLCdlooG-uEAY",
  authDomain: "food-safety-web.firebaseapp.com",
  projectId: "food-safety-web",
  storageBucket: "food-safety-web.firebasestorage.app",
  messagingSenderId: "461169411976",
  appId: "1:461169411976:web:73d5b933462ce95cd41c3d",
  measurementId: "G-W1FNQHFH1M"
};



// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
