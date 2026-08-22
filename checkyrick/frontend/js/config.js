// API Configuration for DietXplore
// Automatically switches between local and production URLs

// Detect if running locally or in production
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000'
    : 'https://checkyrick.onrender.com';  // Your Render backend URL

// Export for use in other scripts
export { API_BASE_URL };

