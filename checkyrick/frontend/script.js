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
const loadingTitle = document.getElementById('loadingTitle');
const loadingStep = document.getElementById('loadingStep');
const resultsSection = document.getElementById('resultsSection');

let loadingInterval = null;

const LOADING_MESSAGES = [
    { title: "🔍 Extracting Ingredients...", step: "Scanning label image with vision OCR..." },
    { title: "🌐 Searching WebCMD Index...", step: "Querying live web sources for safety directives..." },
    { title: "📜 Checking Regulatory Bans...", step: "Cross-referencing FDA, EU, and global additive directives..." },
    { title: "🧬 Analyzing Chemical Profiles...", step: "Evaluating E-numbers, preservatives, and hidden synonyms..." },
    { title: "🧪 Matching Your Dietary Rules...", step: "Checking restrictions, allergens, and religious guidelines..." },
    { title: "⚡ Compiling Safety Report...", step: "Synthesizing verified insights and live citations..." }
];

function startLoadingMessageRotation() {
    let index = 0;
    if (loadingTitle) loadingTitle.textContent = LOADING_MESSAGES[0].title;
    if (loadingStep) loadingStep.textContent = LOADING_MESSAGES[0].step;

    if (loadingInterval) clearInterval(loadingInterval);

    loadingInterval = setInterval(() => {
        index = (index + 1) % LOADING_MESSAGES.length;
        if (loadingTitle) {
            loadingTitle.style.opacity = '0';
            setTimeout(() => {
                loadingTitle.textContent = LOADING_MESSAGES[index].title;
                loadingTitle.style.opacity = '1';
            }, 180);
        }
        if (loadingStep) {
            loadingStep.style.opacity = '0';
            setTimeout(() => {
                loadingStep.textContent = LOADING_MESSAGES[index].step;
                loadingStep.style.opacity = '1';
            }, 180);
        }
    }, 2600);
}

function stopLoadingMessageRotation() {
    if (loadingInterval) {
        clearInterval(loadingInterval);
        loadingInterval = null;
    }
}

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
    document.querySelector('.drop-zone-content').style.display = 'block';
    imagePreview.style.display = 'none';
}

// ===== ANALYSIS HANDLING =====
analyzeBtn.addEventListener('click', async () => {
    if (!uploadedFile) {
        alert('Please upload an ingredient label image first.');
        return;
    }

    const activeRestrictions = userRestrictions || 'Check for harmful additives, EU/FDA regulatory bans, hidden chemical synonyms, and common allergens.';

    await runAnalysis(uploadedFile, activeRestrictions);
});

async function runAnalysis(file, restrictions) {
    // Hide results, show loading
    resultsSection.style.display = 'none';
    loadingSection.style.display = 'block';
    analyzeBtn.disabled = true;
    startLoadingMessageRotation();

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
        stopLoadingMessageRotation();
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
        'SAFE': '#3FB950',
        'WARNING': '#D29922',
        'DANGER': '#F85149'
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

    const statusColor = statusColors[safeAnalysis.compliance_status] || '#8B949E';

    // Common text wrapping styles
    const textWrapStyle = 'word-wrap: break-word; overflow-wrap: break-word; word-break: break-word; max-width: 100%;';

    let html = `
        <div style="font-family: 'Inter', -apple-system, sans-serif; color: #C9D1D9; max-width: 100%; overflow-x: hidden; ${textWrapStyle}">
            <!-- Header -->
            <div style="background: #161B22; border: 1px solid #30363D; border-left: 4px solid ${statusColor}; color: #F0F6FC; padding: 1.5rem; border-radius: 8px; margin-bottom: 1.5rem; max-width: 100%; ${textWrapStyle}">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                    <h2 style="margin: 0; font-size: 1.3rem; font-weight: 700; color: #F0F6FC; ${textWrapStyle}">Dietary Deep Scan Report</h2>
                    <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; background: rgba(88, 166, 255, 0.15); color: #58A6FF; padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(88, 166, 255, 0.3);">WebCMD Powered</span>
                </div>
                <p style="margin: 0.5rem 0 0 0; color: #8B949E; font-size: 0.88rem; ${textWrapStyle}">Analysis completed • Verified with WebCMD web research</p>
            </div>
            
            <!-- User Restrictions -->
            <div style="background: #161B22; border: 1px solid #30363D; padding: 1.25rem; border-radius: 8px; margin-bottom: 1.5rem; border-left: 3px solid #58A6FF; max-width: 100%; ${textWrapStyle}">
                <h3 style="margin: 0 0 0.5rem 0; color: #F0F6FC; font-size: 0.95rem; font-weight: 600; ${textWrapStyle}">TARGET DIETARY RULESET</h3>
                <p style="margin: 0; font-size: 1rem; color: #C9D1D9; ${textWrapStyle}">${restrictions}</p>
            </div>
            
            <!-- Parse Error Warning (if any) -->
            ${safeAnalysis.parse_error ? `
            <div style="background: rgba(210, 153, 34, 0.1); border: 1px solid rgba(210, 153, 34, 0.3); padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border-left: 4px solid #D29922; max-width: 100%; ${textWrapStyle}">
                <p style="margin: 0; color: #D29922; font-size: 0.88rem; ${textWrapStyle}">
                    ⚠️ Note: Response was parsed from text stream format.
                </p>
            </div>
            ` : ''}
            
            <!-- Compliance Status -->
            <div style="background: #161B22; border: 1px solid #30363D; padding: 1.25rem; border-radius: 8px; margin-bottom: 1.5rem; border-left: 4px solid ${statusColor}; max-width: 100%; ${textWrapStyle}">
                <h3 style="margin: 0 0 0.75rem 0; color: ${statusColor}; font-size: 1.1rem; font-weight: 700; ${textWrapStyle}">
                    ${safeAnalysis.compliance_status === 'SAFE' ? '✅' : safeAnalysis.compliance_status === 'WARNING' ? '⚠️' : '❌'} 
                    COMPLIANCE STATUS: ${safeAnalysis.compliance_status}
                </h3>
                <p style="margin: 0; color: #C9D1D9; line-height: 1.6; ${textWrapStyle}">${safeAnalysis.summary}</p>
            </div>
    `;

    // Restriction Conflicts
    if (safeAnalysis.restriction_conflicts && safeAnalysis.restriction_conflicts.length > 0) {
        html += `
            <div style="background: #161B22; border: 1px solid #30363D; padding: 1.25rem; border-radius: 8px; margin-bottom: 1.5rem; max-width: 100%; ${textWrapStyle}">
                <h3 style="color: #F85149; margin: 0 0 1rem 0; font-size: 1.05rem; font-weight: 700; ${textWrapStyle}">⚠️ Restriction Conflicts</h3>
        `;
        safeAnalysis.restriction_conflicts.forEach(conflict => {
            const severityColor = conflict.severity === 'high' ? '#F85149' : conflict.severity === 'medium' ? '#D29922' : '#E3B341';
            html += `
                <div style="background: #0D1117; border: 1px solid #30363D; padding: 0.9rem; border-radius: 6px; margin-bottom: 0.75rem; border-left: 3px solid ${severityColor}; max-width: 100%; ${textWrapStyle}">
                    <strong style="color: ${severityColor}; ${textWrapStyle}">${conflict.ingredient}</strong>
                    <p style="margin: 0.4rem 0 0 0; color: #C9D1D9; ${textWrapStyle}">${conflict.issue}</p>
                    <small style="color: #8B949E; font-size: 0.75rem; ${textWrapStyle}">Severity tier: ${conflict.severity}</small>
                </div>
            `;
        });
        html += `</div>`;
    }

    // Global Bans
    if (safeAnalysis.regulatory_bans && safeAnalysis.regulatory_bans.length > 0) {
        html += `
            <div style="background: #161B22; border: 1px solid #30363D; padding: 1.25rem; border-radius: 8px; margin-bottom: 1.5rem; max-width: 100%; ${textWrapStyle}">
                <h3 style="color: #F85149; margin: 0 0 1rem 0; font-size: 1.05rem; font-weight: 700; ${textWrapStyle}">🚫 Global Regulatory Bans</h3>
        `;
        safeAnalysis.regulatory_bans.forEach(ban => {
            html += `
                <div style="background: #0D1117; border: 1px solid #30363D; padding: 0.9rem; border-radius: 6px; margin-bottom: 0.75rem; border-left: 3px solid #F85149; max-width: 100%; ${textWrapStyle}">
                    <strong style="color: #F85149; ${textWrapStyle}">${ban.ingredient}</strong>
                    <p style="margin: 0.4rem 0; color: #C9D1D9; ${textWrapStyle}"><strong style="color: #8B949E;">Jurisdictions:</strong> ${Array.isArray(ban.countries) ? ban.countries.join(', ') : ban.countries || 'N/A'}</p>
                    <p style="margin: 0; color: #8B949E; font-size: 0.9rem; ${textWrapStyle}">${ban.reason}</p>
                </div>
            `;
        });
        html += `</div>`;
    }

    // Regulatory Restrictions
    if (safeAnalysis.regulatory_restrictions && safeAnalysis.regulatory_restrictions.length > 0) {
        html += `
            <div style="background: #161B22; border: 1px solid #30363D; padding: 1.25rem; border-radius: 8px; margin-bottom: 1.5rem; max-width: 100%; ${textWrapStyle}">
                <h3 style="color: #D29922; margin: 0 0 1rem 0; font-size: 1.05rem; font-weight: 700; ${textWrapStyle}">⚡ Regulatory Advisories</h3>
        `;
        safeAnalysis.regulatory_restrictions.forEach(restriction => {
            html += `
                <div style="background: #0D1117; border: 1px solid #30363D; padding: 0.9rem; border-radius: 6px; margin-bottom: 0.75rem; border-left: 3px solid #D29922; max-width: 100%; ${textWrapStyle}">
                    <strong style="color: #D29922; ${textWrapStyle}">${restriction.ingredient || 'Unknown'}</strong>
                    <p style="margin: 0.4rem 0; color: #C9D1D9; ${textWrapStyle}"><strong style="color: #8B949E;">Type:</strong> ${restriction.type || 'N/A'} • <strong style="color: #8B949E;">Jurisdictions:</strong> ${Array.isArray(restriction.countries) ? restriction.countries.join(', ') : restriction.countries || 'N/A'}</p>
                    <p style="margin: 0; color: #8B949E; font-size: 0.9rem; ${textWrapStyle}">${restriction.reason || 'No reason provided'}</p>
                </div>
            `;
        });
        html += `</div>`;
    }

    // Health Notes
    if (safeAnalysis.health_notes && safeAnalysis.health_notes.length > 0) {
        html += `
            <div style="background: #161B22; border: 1px solid #30363D; padding: 1.25rem; border-radius: 8px; margin-bottom: 1.5rem; max-width: 100%; ${textWrapStyle}">
                <h3 style="color: #58A6FF; margin: 0 0 1rem 0; font-size: 1.05rem; font-weight: 700; ${textWrapStyle}">💊 Chemical &amp; Health Insights</h3>
        `;
        safeAnalysis.health_notes.forEach(note => {
            const typeColor = note.type === 'positive' ? '#3FB950' : note.type === 'negative' ? '#F85149' : '#58A6FF';
            html += `
                <div style="background: #0D1117; border: 1px solid #30363D; padding: 0.9rem; border-radius: 6px; margin-bottom: 0.75rem; border-left: 3px solid ${typeColor}; max-width: 100%; ${textWrapStyle}">
                    <strong style="color: ${typeColor}; ${textWrapStyle}">${note.ingredient || 'Unknown'}</strong>
                    <p style="margin: 0.4rem 0 0 0; color: #C9D1D9; font-size: 0.92rem; ${textWrapStyle}">${note.note || 'No information provided'}</p>
                </div>
            `;
        });
        html += `</div>`;
    }

    // Show raw response if parsing had issues
    if (safeAnalysis.raw_response && safeAnalysis.parse_error) {
        html += `
            <div style="background: #161B22; border: 1px solid #30363D; padding: 1.25rem; border-radius: 8px; margin-bottom: 1.5rem; border-left: 4px solid #8B949E; max-width: 100%; ${textWrapStyle}">
                <h3 style="color: #F0F6FC; margin-top: 0; font-size: 1rem; ${textWrapStyle}">📄 Raw Response Data</h3>
                <details>
                    <summary style="cursor: pointer; color: #8B949E; font-size: 0.85rem; margin-bottom: 0.5rem; ${textWrapStyle}">Click to view raw data</summary>
                    <pre style="background: #0D1117; border: 1px solid #30363D; color: #C9D1D9; padding: 1rem; border-radius: 6px; overflow-x: auto; white-space: pre-wrap; font-size: 0.84rem; line-height: 1.5; ${textWrapStyle}">${escapeHtml(safeAnalysis.raw_response)}</pre>
                </details>
            </div>
        `;
    }

    // Citations Section
    if (citations && citations.length > 0) {
        html += `
            <div style="background: #161B22; border: 1px solid #30363D; padding: 1.25rem; border-radius: 8px; margin-bottom: 1.5rem; max-width: 100%; ${textWrapStyle}">
                <h3 style="color: #58A6FF; margin: 0 0 0.5rem 0; font-size: 1.05rem; font-weight: 700; ${textWrapStyle}">📚 Live Verification Citations</h3>
                <p style="color: #8B949E; font-size: 0.85rem; margin-bottom: 1rem; ${textWrapStyle}">Direct URLs consulted during deep analysis:</p>
        `;
        citations.forEach((citation, idx) => {
            html += `
                <div style="background: #0D1117; border: 1px solid #30363D; padding: 0.85rem; border-radius: 6px; margin-bottom: 0.6rem; border-left: 3px solid #58A6FF; max-width: 100%; ${textWrapStyle}">
                    <strong style="color: #F0F6FC; font-size: 0.9rem; ${textWrapStyle}">[${idx + 1}] ${citation.title || 'Source'}</strong>
                    <br>
                    <a href="${citation.uri || '#'}" target="_blank" rel="noopener noreferrer" style="color: #58A6FF; text-decoration: underline; font-size: 0.82rem; ${textWrapStyle}; display: inline-block; margin-top: 4px; max-width: 100%;">
                        🔗 ${citation.uri || 'No URL available'}
                    </a>
                </div>
            `;
        });
        html += `</div>`;
    }

    // Footer
    html += `
        <div style="background: #161B22; border: 1px solid #30363D; padding: 1rem; border-radius: 8px; text-align: center; color: #8B949E; font-size: 0.84rem; font-family: 'JetBrains Mono', monospace; max-width: 100%; ${textWrapStyle}">
            <p style="margin: 0; ${textWrapStyle}">Information verified using WebCMD web research + Gemini AI.</p>
        </div>
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

All information verified using WebCMD web research + Gemini AI.
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
