const firebaseConfig = {
  apiKey:            "AIzaSyA6bSX_Njf5hq6nFU6T-KusasH5yEr9PFA",
  authDomain:        "co-work-fd9d3.firebaseapp.com",
  projectId:         "co-work-fd9d3",
  storageBucket:     "co-work-fd9d3.firebasestorage.app",
  messagingSenderId: "875020888077",
  appId:             "1:875020888077:web:c4348e088683cce9c90d44"
};

firebase.initializeApp(firebaseConfig);
const fsdb   = firebase.firestore();
const fbAuth = firebase.auth();
