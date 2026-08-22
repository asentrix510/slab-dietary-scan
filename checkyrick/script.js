import { auth, db, doc, getDoc, onAuthStateChanged, signOut } from "./js/firebase-config.js";
import { API_BASE_URL } from "./js/config.js";

// ===== GLOBAL STATE =====
let uploadedFile = null;
let analysisResults = null;
let userRestrictions = "";

// ===== DOM ELEMENTS =====
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const imagePreview = document.getElementById('imagePreview');
const previewImg = document.getElementById('previewImg');
const removeBtn = document.getElementById('removeBtn');
// const restrictionsInput = document.getElementById('restrictions'); // Removed
const userProfileSummary = document.getElementById('userProfileSummary');
const userProfileName = document.getElementById('userProfileName');
const headerUserName = document.getElementById('headerUserName');
const logoutBtn = document.getElementById('logoutBtn');
const analyzeBtn = document.getElementById('analyzeBtn');

const loadingSection = document.getElementById('loadingSection');
const resultsSection = document.getElementById('resultsSection');

const ingredientsList = document.getElementById('ingredientsList');
const ingredientsCount = document.getElementById('ingredientsCount');
const citationsCount = document.getElementById('citationsCount');
const reportContainer = document.getElementById('reportContainer');
const downloadHtmlBtn = document.getElementById('downloadHtmlBtn');
const downloadTextBtn = document.getElementById('downloadTextBtn');

// ===== FILE UPLOAD HANDLING =====
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    clearImage();
});

function handleFile(file) {
    if (!file.type.startsWith('image/')) {
        alert('Please upload an image file (PNG, JPG, JPEG)');
        return;
    }

    uploadedFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
        previewImg.src = e.target.result;
        document.querySelector('.drop-zone-content').style.display = 'none';
        imagePreview.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

function clearImage() {
    uploadedFile = null;
    fileInput.value = '';
    previewImg.src = '';
    document.querySelector('.drop-zone-content').style.display = 'flex';
    imagePreview.style.display = 'none';
}

// ===== ANALYSIS HANDLING =====
analyzeBtn.addEventListener('click', async () => {
    // const restrictions = restrictionsInput.value.trim(); // Removed

    if (!uploadedFile) {
        alert('Please upload an ingredient label image');
        return;
    }

    if (!userRestrictions) {
        alert('Dietary restrictions not loaded. Please check your profile.');
        return;
    }

    await runAnalysis(uploadedFile, userRestrictions);
});

async function runAnalysis(file, restrictions) {
    // Hide results, show loading
    resultsSection.style.display = 'none';
    loadingSection.style.display = 'block';
    analyzeBtn.disabled = true;

    try {
        // Prepare form data
        const formData = new FormData();
        formData.append('image', file);
        formData.append('restrictions', restrictions);

        // Send request to backend
        const response = await fetch(`${API_BASE_URL}/analyze`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        // Display results
        displayResults(data);

    } catch (error) {
        console.error('Analysis error:', error);
        alert(`Error: ${error.message}\n\nMake sure the backend is running at ${API_BASE_URL}`);
    } finally {
        loadingSection.style.display = 'none';
        analyzeBtn.disabled = false;
    }
}

function displayResults(data) {
    // Show results
    resultsSection.style.display = 'block';

    // Store results
    analysisResults = data;

    // Display ingredients
    const ingredients = data.ingredients || [];
    ingredientsCount.textContent = ingredients.length;

    ingredientsList.innerHTML = '';
    ingredients.forEach((ing, idx) => {
        const li = document.createElement('li');
        li.textContent = `${idx + 1}. ${ing}`;
        ingredientsList.appendChild(li);
    });

    // Display citations count
    const citations = data.citations || [];
    if (citations.length > 0) {
        citationsCount.textContent = citations.length;
        citationsCount.parentElement.style.display = 'block';
    } else {
        citationsCount.parentElement.style.display = 'none';
    }

    // Parse and display analysis with robust parsing
    const analysis = parseAnalysisData(data.analysis);
    reportContainer.innerHTML = generateReportHTML(analysis, data.restrictions, citations);

    // Scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

// Robust parsing function that handles any format
function parseAnalysisData(analysisData) {
    // Default structure
    const defaultAnalysis = {
        compliance_status: 'SAFE',
        restriction_conflicts: [],
        regulatory_bans: [],
        regulatory_restrictions: [],
        health_notes: [],
        summary: 'Analysis complete',
        raw_response: null,
        parse_error: null
    };

    // If already an object, validate and return
    if (typeof analysisData === 'object' && analysisData !== null) {
        return { ...defaultAnalysis, ...analysisData };
    }

    // If string, try to parse
    if (typeof analysisData === 'string') {
        let cleaned = analysisData.trim();

        // Strategy 1: Remove markdown code fences
        cleaned = cleaned.replace(/^```(?:json|JSON)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');

        // Strategy 2: Extract JSON object
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            cleaned = jsonMatch[0];
        }

        // Strategy 3: Try to parse JSON
        try {
            const parsed = JSON.parse(cleaned);
            return { ...defaultAnalysis, ...parsed };
        } catch (e) {
            // Strategy 4: Try to extract structured data from text
            const extracted = extractStructuredDataFromText(cleaned);
            return { ...defaultAnalysis, ...extracted, raw_response: cleaned, parse_error: e.message };
        }
    }

    // Fallback: return default with raw data
    return {
        ...defaultAnalysis,
        raw_response: String(analysisData),
        summary: 'Unable to parse analysis data. Showing raw format.'
    };
}

// Extract structured data from text format (fallback)
function extractStructuredDataFromText(text) {
    const result = {
        compliance_status: 'SAFE',
        restriction_conflicts: [],
        regulatory_bans: [],
        regulatory_restrictions: [],
        health_notes: [],
        summary: text.substring(0, 500)
    };

    // Try to detect compliance status
    const upperText = text.toUpperCase();
    if (upperText.includes('DANGER') || upperText.includes('UNSAFE') || upperText.includes('VIOLATION')) {
        result.compliance_status = 'DANGER';
    } else if (upperText.includes('WARNING') || upperText.includes('CAUTION') || upperText.includes('CONCERN')) {
        result.compliance_status = 'WARNING';
    }

    // Try to extract summary
    const summaryMatch = text.match(/summary[:\-]?\s*(.+?)(?:\n\n|\n[A-Z]|$)/i);
    if (summaryMatch) {
        result.summary = summaryMatch[1].trim();
    } else {
        result.summary = text.substring(0, 300) + (text.length > 300 ? '...' : '');
    }

    return result;
}

function generateReportHTML(analysis, restrictions, citations = []) {
    const statusColors = {
        'SAFE': '#27ae60',
        'WARNING': '#e67e22',
        'DANGER': '#c0392b'
    };

    // Ensure analysis has all required fields
    const safeAnalysis = {
        compliance_status: analysis.compliance_status || 'SAFE',
        restriction_conflicts: Array.isArray(analysis.restriction_conflicts) ? analysis.restriction_conflicts : [],
        regulatory_bans: Array.isArray(analysis.regulatory_bans) ? analysis.regulatory_bans : [],
        regulatory_restrictions: Array.isArray(analysis.regulatory_restrictions) ? analysis.regulatory_restrictions : [],
        health_notes: Array.isArray(analysis.health_notes) ? analysis.health_notes : [],
        summary: analysis.summary || 'Analysis complete',
        raw_response: analysis.raw_response || null,
        parse_error: analysis.parse_error || null
    };

    const statusColor = statusColors[safeAnalysis.compliance_status] || '#95a5a6';

    // Common text wrapping styles
    const textWrapStyle = 'word-wrap: break-word; overflow-wrap: break-word; word-break: break-word; max-width: 100%;';

    let html = `
        <div style="font-family: 'Inter', sans-serif; color: #2c3e50; max-width: 100%; overflow-x: hidden; ${textWrapStyle}">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, ${statusColor}, ${statusColor}dd); color: white; padding: 2rem; border-radius: 10px; margin-bottom: 2rem; max-width: 100%; ${textWrapStyle}">
                <h1 style="margin: 0 0 0.5rem 0; ${textWrapStyle}">Dietary Deep Scan Report</h1>
                <p style="margin: 0; opacity: 0.9; ${textWrapStyle}">Analysis completed • Verified with Google Search</p>
            </div>
            
            <!-- User Restrictions -->
            <div style="background: #f8f9fa; padding: 1.5rem; border-radius: 10px; margin-bottom: 2rem; border-left: 4px solid #3498db; max-width: 100%; ${textWrapStyle}">
                <h3 style="margin: 0 0 0.5rem 0; color: #2c3e50; ${textWrapStyle}">Your Dietary Restrictions</h3>
                <p style="margin: 0; font-size: 1.1rem; ${textWrapStyle}">${restrictions}</p>
            </div>
            
            <!-- Parse Error Warning (if any) -->
            ${safeAnalysis.parse_error ? `
            <div style="background: #fff3cd; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border-left: 4px solid #ffc107; max-width: 100%; ${textWrapStyle}">
                <p style="margin: 0; color: #856404; font-size: 0.9rem; ${textWrapStyle}">
                    ⚠️ Note: Response was parsed from text format. Some structure may be simplified.
                </p>
            </div>
            ` : ''}
            
            <!-- Compliance Status -->
            <div style="background: ${statusColor}15; padding: 1.5rem; border-radius: 10px; margin-bottom: 2rem; border-left: 4px solid ${statusColor}; max-width: 100%; ${textWrapStyle}">
                <h2 style="margin: 0 0 1rem 0; color: ${statusColor}; ${textWrapStyle}">
                    ${safeAnalysis.compliance_status === 'SAFE' ? '✅' : safeAnalysis.compliance_status === 'WARNING' ? '⚠️' : '❌'} 
                    Compliance Status: ${safeAnalysis.compliance_status}
                </h2>
                <p style="margin: 0; ${textWrapStyle}">${safeAnalysis.summary}</p>
            </div>
    `;

    // Restriction Conflicts
    if (safeAnalysis.restriction_conflicts && safeAnalysis.restriction_conflicts.length > 0) {
        html += `
            <div style="background: white; padding: 1.5rem; border-radius: 10px; margin-bottom: 2rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); max-width: 100%; ${textWrapStyle}">
                <h2 style="color: #c0392b; margin-top: 0; ${textWrapStyle}">⚠️ Restriction Conflicts</h2>
        `;
        safeAnalysis.restriction_conflicts.forEach(conflict => {
            const severityColor = conflict.severity === 'high' ? '#c0392b' : conflict.severity === 'medium' ? '#e67e22' : '#f39c12';
            html += `
                <div style="background: ${severityColor}15; padding: 1rem; border-radius: 5px; margin-bottom: 1rem; border-left: 3px solid ${severityColor}; max-width: 100%; ${textWrapStyle}">
                    <strong style="color: ${severityColor}; ${textWrapStyle}">${conflict.ingredient}</strong>
                    <p style="margin: 0.5rem 0 0 0; ${textWrapStyle}">${conflict.issue}</p>
                    <small style="color: #7f8c8d; ${textWrapStyle}">Severity: ${conflict.severity}</small>
                </div>
            `;
        });
        html += `</div>`;
    }

    // Global Bans
    if (safeAnalysis.regulatory_bans && safeAnalysis.regulatory_bans.length > 0) {
        html += `
            <div style="background: white; padding: 1.5rem; border-radius: 10px; margin-bottom: 2rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); max-width: 100%; ${textWrapStyle}">
                <h2 style="color: #c0392b; margin-top: 0; ${textWrapStyle}">🚫 Global Bans</h2>
        `;
        safeAnalysis.regulatory_bans.forEach(ban => {
            html += `
                <div style="background: #c0392b15; padding: 1rem; border-radius: 5px; margin-bottom: 1rem; border-left: 3px solid #c0392b; max-width: 100%; ${textWrapStyle}">
                    <strong style="color: #c0392b; ${textWrapStyle}">${ban.ingredient}</strong>
                    <p style="margin: 0.5rem 0; ${textWrapStyle}"><strong>Countries:</strong> ${Array.isArray(ban.countries) ? ban.countries.join(', ') : ban.countries || 'N/A'}</p>
                    <p style="margin: 0; ${textWrapStyle}">${ban.reason}</p>
                </div>
            `;
        });
        html += `</div>`;
    }

    // Regulatory Restrictions
    if (safeAnalysis.regulatory_restrictions && safeAnalysis.regulatory_restrictions.length > 0) {
        html += `
            <div style="background: white; padding: 1.5rem; border-radius: 10px; margin-bottom: 2rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); max-width: 100%; ${textWrapStyle}">
                <h2 style="color: #e67e22; margin-top: 0; ${textWrapStyle}">⚡ Regulatory Restrictions</h2>
        `;
        safeAnalysis.regulatory_restrictions.forEach(restriction => {
            html += `
                <div style="background: #e67e2215; padding: 1rem; border-radius: 5px; margin-bottom: 1rem; border-left: 3px solid #e67e22; max-width: 100%; ${textWrapStyle}">
                    <strong style="color: #e67e22; ${textWrapStyle}">${restriction.ingredient || 'Unknown'}</strong>
                    <p style="margin: 0.5rem 0; ${textWrapStyle}"><strong>Type:</strong> ${restriction.type || 'N/A'}</p>
                    <p style="margin: 0.5rem 0; ${textWrapStyle}"><strong>Countries:</strong> ${Array.isArray(restriction.countries) ? restriction.countries.join(', ') : restriction.countries || 'N/A'}</p>
                    <p style="margin: 0; ${textWrapStyle}">${restriction.reason || 'No reason provided'}</p>
                </div>
            `;
        });
        html += `</div>`;
    }

    // Health Notes
    if (safeAnalysis.health_notes && safeAnalysis.health_notes.length > 0) {
        html += `
            <div style="background: white; padding: 1.5rem; border-radius: 10px; margin-bottom: 2rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); max-width: 100%; ${textWrapStyle}">
                <h2 style="color: #3498db; margin-top: 0; ${textWrapStyle}">💊 Health Information</h2>
        `;
        safeAnalysis.health_notes.forEach(note => {
            const typeColor = note.type === 'positive' ? '#27ae60' : note.type === 'negative' ? '#c0392b' : '#95a5a6';
            html += `
                <div style="background: ${typeColor}15; padding: 1rem; border-radius: 5px; margin-bottom: 1rem; border-left: 3px solid ${typeColor}; max-width: 100%; ${textWrapStyle}">
                    <strong style="color: ${typeColor}; ${textWrapStyle}">${note.ingredient || 'Unknown'}</strong>
                    <p style="margin: 0.5rem 0 0 0; ${textWrapStyle}">${note.note || 'No information provided'}</p>
                </div>
            `;
        });
        html += `</div>`;
    }

    // Show raw response if parsing had issues
    if (safeAnalysis.raw_response && safeAnalysis.parse_error) {
        html += `
            <div style="background: #f8f9fa; padding: 1.5rem; border-radius: 10px; margin-bottom: 2rem; border-left: 4px solid #6c757d; max-width: 100%; ${textWrapStyle}">
                <h2 style="color: #495057; margin-top: 0; ${textWrapStyle}">📄 Raw Response</h2>
                <details>
                    <summary style="cursor: pointer; color: #6c757d; margin-bottom: 0.5rem; ${textWrapStyle}">Click to view raw response</summary>
                    <pre style="background: white; padding: 1rem; border-radius: 5px; overflow-x: auto; white-space: pre-wrap; word-wrap: break-word; overflow-wrap: break-word; word-break: break-word; max-width: 100%; font-size: 0.9rem;">${escapeHtml(safeAnalysis.raw_response)}</pre>
                </details>
            </div>
        `;
    }

    // Citations Section
    if (citations && citations.length > 0) {
        html += `
            <div style="background: white; padding: 1.5rem; border-radius: 10px; margin-bottom: 2rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); max-width: 100%; ${textWrapStyle}">
                <h2 style="color: #3498db; margin-top: 0; ${textWrapStyle}">📚 Sources & Citations</h2>
                <p style="color: #7f8c8d; margin-bottom: 1rem; ${textWrapStyle}">Information verified from the following sources:</p>
        `;
        citations.forEach((citation, idx) => {
            html += `
                <div style="background: #f8f9fa; padding: 1rem; border-radius: 5px; margin-bottom: 0.75rem; border-left: 3px solid #3498db; max-width: 100%; ${textWrapStyle}">
                    <strong style="color: #2c3e50; ${textWrapStyle}">[${idx + 1}] ${citation.title || 'Source'}</strong>
                    <br>
                    <a href="${citation.uri || '#'}" target="_blank" style="color: #3498db; text-decoration: none; font-size: 0.9rem; ${textWrapStyle}; display: inline-block; max-width: 100%;">
                        🔗 ${citation.uri || 'No URL available'}
                    </a>
                </div>
            `;
        });
        html += `</div>`;
    }

    // Footer
    html += `
        <div style="background: #ecf0f1; padding: 1rem; border-radius: 10px; text-align: center; color: #7f8c8d; font-size: 0.9rem; max-width: 100%; ${textWrapStyle}">
            <p style="margin: 0; ${textWrapStyle}">Information verified using Google Search via Gemini AI.</p>
        </div>
    </div>
    `;

    return html;
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== DOWNLOAD HANDLERS =====
downloadHtmlBtn.addEventListener('click', () => {
    if (!analysisResults) return;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Dietary Deep Scan Report</title>
    <style>
        body { font-family: 'Inter', sans-serif; max-width: 900px; margin: 2rem auto; padding: 0 1rem; }
    </style>
</head>
<body>
    ${reportContainer.innerHTML}
</body>
</html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dietary_deep_scan_report.html';
    a.click();
    URL.revokeObjectURL(url);
});

downloadTextBtn.addEventListener('click', () => {
    if (!analysisResults) return;

    // Use raw analysis text or stringify json
    const analysisText = typeof analysisResults.analysis === 'string'
        ? analysisResults.analysis
        : JSON.stringify(analysisResults.analysis, null, 2);

    const textSummary = `
DIETARY DEEP SCAN REPORT
========================

User Restrictions: ${userRestrictions}

Ingredients Detected:
${analysisResults.ingredients.map((ing, idx) => `${idx + 1}. ${ing}`).join('\n')}

Analysis:
${analysisText}

Citations: ${analysisResults.citations ? analysisResults.citations.length : 0} sources consulted

All information verified using Google Search via Gemini AI.
    `.trim();

    const blob = new Blob([textSummary], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dietary_scan_summary.txt';
    a.click();
    URL.revokeObjectURL(url);
});

// ===== INITIALIZE =====
console.log('Dietary Deep Scan System initialized');
console.log(`Backend configured at ${API_BASE_URL}`);

// ===== AUTH & PROFILE =====
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Logged In
        await loadUserProfile(user);
    } else {
        // Not Logged In - Redirect
        console.log("User not logged in, redirecting...");
        window.location.href = 'account_login.html';
    }
});

async function loadUserProfile(user) {
    if (userProfileSummary) userProfileSummary.style.display = 'block';
    if (userProfileName) userProfileName.textContent = user.email;
    if (headerUserName) headerUserName.textContent = user.email;

    try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.fullName) {
                if (userProfileName) userProfileName.textContent = data.fullName;
                if (headerUserName) headerUserName.textContent = data.fullName;
            }

            // Build restriction string
            let parts = [];

            // Diet Type
            if (data.dietType) {
                let dt = data.dietType.type || data.dietType.selected;
                if (dt) parts.push(`Diet Type: ${dt}`);
                if (data.dietType.other) parts.push(`Other Diet: ${data.dietType.other}`);
            }

            // Religious Rules
            if (data.religiousRules) {
                let rules = data.religiousRules.selected || [];
                if (Array.isArray(rules) && rules.length > 0) parts.push(`Religious Rules: ${rules.join(', ')}`);
                if (data.religiousRules.other) parts.push(`Other Rules: ${data.religiousRules.other}`);
            }

            // Restrictions
            if (data.dietaryRestrictions) {
                parts.push(`Specific Restrictions: ${data.dietaryRestrictions}`);
            }

            userRestrictions = parts.join(". ");
            console.log("Loaded Restrictions:", userRestrictions);
        }
    } catch (e) {
        console.error("Error loading profile", e);
    }
}

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
