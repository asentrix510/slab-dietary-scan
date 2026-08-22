
import { auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, db, doc, getDoc } from "./firebase-config.js";

// DOM Elements for Login Page
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const loginCard = document.getElementById('login-card');
const signupCard = document.getElementById('signup-card');
const showSignupBtn = document.getElementById('show-signup');
const showLoginBtn = document.getElementById('show-login');
const loginError = document.getElementById('login-error');
const signupError = document.getElementById('signup-error');

// DOM Elements for Logout
const logoutBtn = document.getElementById('logout-btn');

// --- Login Page Logic ---
if (loginForm && signupForm) {
    // Toggle between Login and Signup
    showSignupBtn.addEventListener('click', (e) => {
        e.preventDefault();
        loginCard.style.display = 'none';
        signupCard.style.display = 'block';
        clearErrors();
    });

    showLoginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        signupCard.style.display = 'none';
        loginCard.style.display = 'block';
        clearErrors();
    });

    // Handle Login
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            await signInWithEmailAndPassword(auth, email, password);
            // successful login will trigger onAuthStateChanged
        } catch (error) {
            showError(loginError, error.message);
        }
    });

    // Handle Signup
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            // successful signup will trigger onAuthStateChanged
            console.log("User created:", userCredential.user.uid);
            // We rely on onAuthStateChanged to redirect
        } catch (error) {
            showError(signupError, error.message);
        }
    });
}

function showError(element, message) {
    element.textContent = message;
    element.style.display = 'block';
}

function clearErrors() {
    if (loginError) loginError.style.display = 'none';
    if (signupError) signupError.style.display = 'none';
}

// --- Logout Logic ---
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        try {
            await signOut(auth);
            window.location.href = 'account_login.html';
        } catch (error) {
            console.error('Logout error:', error);
        }
    });
}

// --- Auth State Observer ---
onAuthStateChanged(auth, async (user) => {
    const currentPath = window.location.pathname;
    const isLoginPage = currentPath.includes('account_login.html') || currentPath.endsWith('/login'); // robust check
    const isLandingPage = currentPath.includes('index.html') || currentPath === '/' || currentPath.endsWith('DietXplore/') || currentPath.endsWith('checkyrick/'); // landing page detection
    // Actually, landingpage is public.

    if (user) {
        // User is signed in
        if (isLoginPage) {
            // Check if profile exists to decide where to go
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                window.location.href = 'scanner.html';
            } else {
                // New user or no profile -> Go to Profile setup
                window.location.href = 'account.html';
            }
        }
    } else {
        // User is signed out
        if (!isLoginPage && !currentPath.includes('landingpage.html')) {
            // Protect other pages (like index.html, account.html)
            // But allow landingpage.html
            // Also need to handle just "/" if that maps to landing page vs index.html
            // For now, let's assume strict file usage.
            if (!currentPath.endsWith('index.html')) {
                // If we are on account.html or scanner.html, redirect to login
                // Note: we need to be careful not to redirect endlessly if the server serves index.html for /
                // Assuming standard file serving:
                window.location.href = 'account_login.html';
            }
        }
    }
});
