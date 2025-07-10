// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDlZ0_q2KRTWQTJvlsZIp3yRfrQ-dzNatA",
  authDomain: "vaporrick-ai-bot.firebaseapp.com",
  projectId: "vaporrick-ai-bot",
  storageBucket: "vaporrick-ai-bot.firebasestorage.app",
  messagingSenderId: "256353463325",
  appId: "1:256353463325:web:0ea63d06ecfc691b3aaaf4",
  measurementId: "G-FJR0N3X0VB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);