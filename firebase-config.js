import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {
    getFirestore
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDqrdasSIemH__HtrxmwaT1s9-5t6VJHh8",
    authDomain: "expense-tracker-cbfe5.firebaseapp.com",
    projectId: "expense-tracker-cbfe5",
    storageBucket: "expense-tracker-cbfe5.firebasestorage.app",
    messagingSenderId: "838382405979",
    appId: "1:838382405979:web:54ecc84ee846cbe64d727e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log("Firebase app connected:", app);
console.log("Firestore connected:", db);

export { app, db };