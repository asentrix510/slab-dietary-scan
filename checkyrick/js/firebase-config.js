
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAwVPCMkyQ4_XgIN4ROUFrLCdlooG-uEAY",
    authDomain: "food-safety-web.firebaseapp.com",
    projectId: "food-safety-web",
    storageBucket: "food-safety-web.firebasestorage.app",
    messagingSenderId: "461169411976",
    appId: "1:461169411976:web:73d5b933462ce95cd41c3d",
    measurementId: "G-W1FNQHFH1M"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, doc, setDoc, getDoc, updateDoc };
