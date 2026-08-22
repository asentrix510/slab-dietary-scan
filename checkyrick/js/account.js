
import { auth, db, doc, getDoc, setDoc, onAuthStateChanged } from "./firebase-config.js";

const profileForm = document.getElementById('profile-form');
const emailInput = document.getElementById('email');
const fullNameInput = document.getElementById('fullName');
const ageInput = document.getElementById('age');
const countryInput = document.getElementById('country');
const dietTypeInputs = document.getElementsByName('dietType');
const dietTypeOtherInput = document.getElementById('dietTypeOther');
const religiousRulesInputs = document.getElementsByName('religiousRules');
const religiousRulesOtherInput = document.getElementById('religiousRulesOther');
const dietaryRestrictionsInput = document.getElementById('dietaryRestrictions');

let currentUser = null;

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        emailInput.value = user.email;
        await loadUserProfile(user.uid);
    } else {
        // Redirect handled by account_auth.js usually, but just in case
        // window.location.href = 'account_login.html';
    }
});

async function loadUserProfile(uid) {
    try {
        const docRef = doc(db, "users", uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();

            // Fill fields
            fullNameInput.value = data.fullName || '';
            ageInput.value = data.age || '';
            countryInput.value = data.country || '';

            // Diet Type
            if (data.dietType) {
                // If stored as object { type: "...", other: "..." }
                // or just string? Let's support object structure from schema.
                const type = data.dietType.type || data.dietType.selected;
                if (type) {
                    for (const radio of dietTypeInputs) {
                        if (radio.value === type) radio.checked = true;
                    }
                }
                dietTypeOtherInput.value = data.dietType.other || '';
            }

            // Religious Rules
            if (data.religiousRules) {
                const selected = data.religiousRules.selected || data.religiousRules.options || []; // handling loose schema interpretation
                // Although schema said "type": "array", "options": [...] usually means the definition.
                // I will assume data.religiousRules.selected holds the array of checked items.
                if (Array.isArray(selected)) {
                    for (const checkbox of religiousRulesInputs) {
                        if (selected.includes(checkbox.value)) {
                            checkbox.checked = true;
                        }
                    }
                }
                religiousRulesOtherInput.value = data.religiousRules.other || '';
            }

            dietaryRestrictionsInput.value = data.dietaryRestrictions || '';
        }
    } catch (error) {
        console.error("Error loading profile:", error);
    }
}

profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentUser) return;

    // specialized logic needed here
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) loadingOverlay.style.display = 'flex';

    try {
        // Gather Diet Type
        let selectedDietType = "";
        for (const radio of dietTypeInputs) {
            if (radio.checked) {
                selectedDietType = radio.value;
                break;
            }
        }

        // Gather Religious Rules
        const selectedReligiousRules = [];
        for (const checkbox of religiousRulesInputs) {
            if (checkbox.checked) {
                selectedReligiousRules.push(checkbox.value);
            }
        }

        const profileData = {
            email: currentUser.email,
            fullName: fullNameInput.value,
            age: parseInt(ageInput.value) || null,
            country: countryInput.value,
            dietType: {
                type: selectedDietType,
                other: dietTypeOtherInput.value
            },
            religiousRules: {
                selected: selectedReligiousRules,
                other: religiousRulesOtherInput.value
            },
            dietaryRestrictions: dietaryRestrictionsInput.value
        };

        await setDoc(doc(db, "users", currentUser.uid), profileData);

        // Redirect to scanner
        window.location.href = 'index.html';

    } catch (error) {
        console.error("Error saving profile:", error);
        alert("Failed to save profile: " + error.message);
    } finally {
        if (loadingOverlay) loadingOverlay.style.display = 'none';
    }
});
