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

function updateLoadingStatus(title, detail) {
    if (loadingTitle) {
        loadingTitle.style.opacity = '0';
        setTimeout(() => {
            loadingTitle.textContent = title;
            loadingTitle.style.opacity = '1';
        }, 150);
    }
    if (loadingStep) {
        loadingStep.style.opacity = '0';
        setTimeout(() => {
            loadingStep.textContent = detail;
            loadingStep.style.opacity = '1';
        }, 150);
    }
}

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

        const contentType = response.headers.get('content-type') || '';

        if (contentType.includes('text/event-stream')) {
            // Real-time server progress stream synced with server status!
            stopLoadingMessageRotation();

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let finalData = null;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const chunks = buffer.split('\n\n');
                buffer = chunks.pop() || ''; // keep incomplete chunk in buffer

                for (const chunk of chunks) {
                    const line = chunk.trim();
                    if (line.startsWith('data: ')) {
                        try {
                            const payload = JSON.parse(line.substring(6));
                            if (payload.type === 'progress') {
                                updateLoadingStatus(payload.title, payload.detail);
                            } else if (payload.type === 'complete') {
                                finalData = payload.data;
                            } else if (payload.type === 'error') {
                                throw new Error(payload.error);
                            }
                        } catch (err) {
                            if (err.message && !err.message.includes('JSON')) throw err;
                            console.warn('SSE parse note:', err);
                        }
                    }
                }
            }

            if (finalData) {
                displayResults(finalData);
            } else {
                throw new Error('Analysis completed without returning result data.');
            }
        } else {
            // Standard JSON response fallback
            const data = await response.json();
            if (data.error) throw new Error(data.error);
            displayResults(data);
        }

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
    } else {
        result.summary = text.substring(0, 300) + (text.length > 300 ? '...' : '');
    }

    return result;
}

function generateReportHTML(analysis, restrictions, citations = []) {
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

    let statusBg = 'bg-[#00ff41] text-[#002203]';
    let statusBorder = 'border-l-[8px] border-l-[#006e16]';
    let statusBadge = 'bg-[#00ff41] text-[#002203]';

    if (safeAnalysis.compliance_status === 'DANGER') {
        statusBg = 'bg-[#ffdad6] text-[#93000a]';
        statusBorder = 'border-l-[8px] border-l-[#ba1a1a]';
        statusBadge = 'bg-[#ffdad6] text-[#93000a]';
    } else if (safeAnalysis.compliance_status === 'WARNING') {
        statusBg = 'bg-[#ede900] text-[#1d1d00]';
        statusBorder = 'border-l-[8px] border-l-[#636100]';
        statusBadge = 'bg-[#ede900] text-[#1d1d00]';
    }

    const textWrapStyle = 'word-wrap: break-word; overflow-wrap: break-word; word-break: break-word; max-width: 100%;';

    let html = `
        <div style="font-family: 'Inter', sans-serif; color: #1b1b1b; max-width: 100%; overflow-x: hidden; ${textWrapStyle}">
            <!-- Header -->
            <div style="background: #ffffff; border: 3px solid #1b1b1b; box-shadow: 4px 4px 0px 0px #000000; padding: 1.25rem; margin-bottom: 1.5rem; max-width: 100%; ${textWrapStyle}">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; border-bottom: 2px solid #1b1b1b; padding-bottom: 0.75rem; margin-bottom: 0.75rem;">
                    <h2 style="font-family: 'Anton', sans-serif; margin: 0; font-size: 1.6rem; text-transform: uppercase; letter-spacing: 0.02em; color: #1b1b1b; ${textWrapStyle}">DIETXPLORE AUDIT REPORT</h2>
                    <span style="font-family: 'Space Mono', monospace; font-size: 0.75rem; font-weight: 700; background: #00ff41; color: #002203; padding: 4px 10px; border: 2px solid #1b1b1b;">VERIFIED BY WEBCMD</span>
                </div>
                <p style="margin: 0; color: #3b4b37; font-size: 0.9rem; font-weight: 500; ${textWrapStyle}">Inspection complete • Multimodal OCR + live regulatory cross-check</p>
            </div>
            
            <!-- User Restrictions -->
            <div style="background: #ffffff; border: 3px solid #1b1b1b; box-shadow: 4px 4px 0px 0px #000000; padding: 1.25rem; margin-bottom: 1.5rem; border-left: 8px solid #0040e0; max-width: 100%; ${textWrapStyle}">
                <h3 style="font-family: 'Anton', sans-serif; margin: 0 0 0.5rem 0; color: #1b1b1b; font-size: 1.1rem; text-transform: uppercase; ${textWrapStyle}">TARGET DIETARY RULESET</h3>
                <p style="margin: 0; font-size: 0.95rem; color: #1b1b1b; ${textWrapStyle}">${restrictions}</p>
            </div>
            
            <!-- Parse Error Warning (if any) -->
            ${safeAnalysis.parse_error ? `
            <div style="background: #ffdad6; border: 3px solid #1b1b1b; box-shadow: 4px 4px 0px 0px #000000; padding: 1rem; margin-bottom: 1rem; border-left: 8px solid #ba1a1a; max-width: 100%; ${textWrapStyle}">
                <p style="margin: 0; color: #93000a; font-family: 'Space Mono', monospace; font-size: 0.82rem; font-weight: 700; ${textWrapStyle}">
                    ⚠️ STREAM DECODE NOTICE: Parsed from raw vision stream.
                </p>
            </div>
            ` : ''}
            
            <!-- Compliance Status -->
            <div style="background: #ffffff; border: 3px solid #1b1b1b; box-shadow: 4px 4px 0px 0px #000000; padding: 1.25rem; margin-bottom: 1.5rem; ${statusBorder}; max-width: 100%; ${textWrapStyle}">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 0.75rem;">
                    <h3 style="font-family: 'Anton', sans-serif; margin: 0; color: #1b1b1b; font-size: 1.4rem; text-transform: uppercase; ${textWrapStyle}">
                        COMPLIANCE STATUS: ${safeAnalysis.compliance_status}
                    </h3>
                    <span style="font-family: 'Space Mono', monospace; font-size: 0.75rem; font-weight: 700; padding: 4px 10px; border: 2px solid #1b1b1b; background: ${safeAnalysis.compliance_status === 'SAFE' ? '#00ff41' : safeAnalysis.compliance_status === 'DANGER' ? '#ffdad6' : '#ede900'}; color: ${safeAnalysis.compliance_status === 'SAFE' ? '#002203' : safeAnalysis.compliance_status === 'DANGER' ? '#93000a' : '#1d1d00'};">
                        ${safeAnalysis.compliance_status}
                    </span>
                </div>
                <p style="margin: 0; color: #1b1b1b; line-height: 1.6; font-size: 0.95rem; ${textWrapStyle}">${safeAnalysis.summary}</p>
            </div>
    `;

    // Restriction Conflicts
    if (safeAnalysis.restriction_conflicts && safeAnalysis.restriction_conflicts.length > 0) {
        html += `
            <div style="background: #ffffff; border: 3px solid #1b1b1b; box-shadow: 4px 4px 0px 0px #000000; padding: 1.25rem; margin-bottom: 1.5rem; max-width: 100%; ${textWrapStyle}">
                <h3 style="font-family: 'Anton', sans-serif; color: #ba1a1a; margin: 0 0 1rem 0; font-size: 1.2rem; text-transform: uppercase; ${textWrapStyle}">⚠️ RESTRICTION CONFLICTS</h3>
        `;
        safeAnalysis.restriction_conflicts.forEach(conflict => {
            const severityBorder = conflict.severity === 'high' ? 'border-left: 6px solid #ba1a1a;' : conflict.severity === 'medium' ? 'border-left: 6px solid #636100;' : 'border-left: 6px solid #0040e0;';
            html += `
                <div style="background: #f9f9f9; border: 2px solid #1b1b1b; padding: 0.9rem; margin-bottom: 0.75rem; ${severityBorder} max-width: 100%; ${textWrapStyle}">
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                        <strong style="font-family: 'Anton', sans-serif; font-size: 1rem; color: #1b1b1b; text-transform: uppercase; ${textWrapStyle}">${conflict.ingredient}</strong>
                        <span style="font-family: 'Space Mono', monospace; font-size: 0.7rem; font-weight: 700; background: #ffdad6; color: #93000a; padding: 2px 6px; border: 1px solid #1b1b1b;">SEVERITY: ${conflict.severity.toUpperCase()}</span>
                    </div>
                    <p style="margin: 0.4rem 0 0 0; color: #1b1b1b; font-size: 0.9rem; ${textWrapStyle}">${conflict.issue}</p>
                </div>
            `;
        });
        html += `</div>`;
    }

    // Global Bans
    if (safeAnalysis.regulatory_bans && safeAnalysis.regulatory_bans.length > 0) {
        html += `
            <div style="background: #ffffff; border: 3px solid #1b1b1b; box-shadow: 4px 4px 0px 0px #000000; padding: 1.25rem; margin-bottom: 1.5rem; max-width: 100%; ${textWrapStyle}">
                <h3 style="font-family: 'Anton', sans-serif; color: #ba1a1a; margin: 0 0 1rem 0; font-size: 1.2rem; text-transform: uppercase; ${textWrapStyle}">🚫 GLOBAL REGULATORY BANS</h3>
        `;
        safeAnalysis.regulatory_bans.forEach(ban => {
            html += `
                <div style="background: #f9f9f9; border: 2px solid #1b1b1b; border-left: 6px solid #ba1a1a; padding: 0.9rem; margin-bottom: 0.75rem; max-width: 100%; ${textWrapStyle}">
                    <strong style="font-family: 'Anton', sans-serif; font-size: 1rem; color: #ba1a1a; text-transform: uppercase; ${textWrapStyle}">${ban.ingredient}</strong>
                    <p style="margin: 0.4rem 0; color: #1b1b1b; font-size: 0.88rem; ${textWrapStyle}"><strong>Banned Jurisdictions:</strong> ${Array.isArray(ban.countries) ? ban.countries.join(', ') : ban.countries || 'N/A'}</p>
                    <p style="margin: 0; color: #3b4b37; font-size: 0.88rem; ${textWrapStyle}">${ban.reason}</p>
                </div>
            `;
        });
        html += `</div>`;
    }

    // Regulatory Restrictions
    if (safeAnalysis.regulatory_restrictions && safeAnalysis.regulatory_restrictions.length > 0) {
        html += `
            <div style="background: #ffffff; border: 3px solid #1b1b1b; box-shadow: 4px 4px 0px 0px #000000; padding: 1.25rem; margin-bottom: 1.5rem; max-width: 100%; ${textWrapStyle}">
                <h3 style="font-family: 'Anton', sans-serif; color: #636100; margin: 0 0 1rem 0; font-size: 1.2rem; text-transform: uppercase; ${textWrapStyle}">⚡ REGULATORY ADVISORIES</h3>
        `;
        safeAnalysis.regulatory_restrictions.forEach(restriction => {
            html += `
                <div style="background: #f9f9f9; border: 2px solid #1b1b1b; border-left: 6px solid #ede900; padding: 0.9rem; margin-bottom: 0.75rem; max-width: 100%; ${textWrapStyle}">
                    <strong style="font-family: 'Anton', sans-serif; font-size: 1rem; color: #1b1b1b; text-transform: uppercase; ${textWrapStyle}">${restriction.ingredient || 'Unknown'}</strong>
                    <p style="margin: 0.4rem 0; color: #1b1b1b; font-size: 0.88rem; ${textWrapStyle}"><strong>Type:</strong> ${restriction.type || 'N/A'} • <strong>Jurisdictions:</strong> ${Array.isArray(restriction.countries) ? restriction.countries.join(', ') : restriction.countries || 'N/A'}</p>
                    <p style="margin: 0; color: #3b4b37; font-size: 0.88rem; ${textWrapStyle}">${restriction.reason || 'No reason provided'}</p>
                </div>
            `;
        });
        html += `</div>`;
    }

    // Health Notes
    if (safeAnalysis.health_notes && safeAnalysis.health_notes.length > 0) {
        html += `
            <div style="background: #ffffff; border: 3px solid #1b1b1b; box-shadow: 4px 4px 0px 0px #000000; padding: 1.25rem; margin-bottom: 1.5rem; max-width: 100%; ${textWrapStyle}">
                <h3 style="font-family: 'Anton', sans-serif; color: #0040e0; margin: 0 0 1rem 0; font-size: 1.2rem; text-transform: uppercase; ${textWrapStyle}">🔬 CHEMICAL &amp; NUTRITION NOTES</h3>
        `;
        safeAnalysis.health_notes.forEach(note => {
            const noteBorder = note.type === 'positive' ? 'border-left: 6px solid #006e16;' : note.type === 'negative' ? 'border-left: 6px solid #ba1a1a;' : 'border-left: 6px solid #0040e0;';
            html += `
                <div style="background: #f9f9f9; border: 2px solid #1b1b1b; ${noteBorder} padding: 0.9rem; margin-bottom: 0.75rem; max-width: 100%; ${textWrapStyle}">
                    <strong style="font-family: 'Anton', sans-serif; font-size: 1rem; color: #1b1b1b; text-transform: uppercase; ${textWrapStyle}">${note.ingredient || 'Unknown'}</strong>
                    <p style="margin: 0.4rem 0 0 0; color: #1b1b1b; font-size: 0.9rem; ${textWrapStyle}">${note.note || 'No information provided'}</p>
                </div>
            `;
        });
        html += `</div>`;
    }

    // Show raw response if parsing had issues
    if (safeAnalysis.raw_response && safeAnalysis.parse_error) {
        html += `
            <div style="background: #ffffff; border: 3px solid #1b1b1b; box-shadow: 4px 4px 0px 0px #000000; padding: 1.25rem; margin-bottom: 1.5rem; max-width: 100%; ${textWrapStyle}">
                <h3 style="font-family: 'Anton', sans-serif; color: #1b1b1b; margin-top: 0; font-size: 1rem; text-transform: uppercase; ${textWrapStyle}">📄 RAW RESPONSE DATA</h3>
                <details>
                    <summary style="cursor: pointer; font-family: 'Space Mono', monospace; font-size: 0.8rem; margin-bottom: 0.5rem; ${textWrapStyle}">CLICK TO VIEW RAW DATA</summary>
                    <pre style="background: #f9f9f9; border: 2px solid #1b1b1b; color: #1b1b1b; padding: 1rem; overflow-x: auto; white-space: pre-wrap; font-family: 'Space Mono', monospace; font-size: 0.8rem; line-height: 1.5; ${textWrapStyle}">${escapeHtml(safeAnalysis.raw_response)}</pre>
                </details>
            </div>
        `;
    }

    // Citations Section
    if (citations && citations.length > 0) {
        html += `
            <div style="background: #ffffff; border: 3px solid #1b1b1b; box-shadow: 4px 4px 0px 0px #000000; padding: 1.25rem; margin-bottom: 1.5rem; max-width: 100%; ${textWrapStyle}">
                <h3 style="font-family: 'Anton', sans-serif; color: #0040e0; margin: 0 0 0.5rem 0; font-size: 1.2rem; text-transform: uppercase; ${textWrapStyle}">📚 REGULATORY CITATIONS</h3>
                <p style="color: #3b4b37; font-size: 0.85rem; margin-bottom: 1rem; ${textWrapStyle}">Verified sources consulted during analysis:</p>
        `;
        citations.forEach((citation, idx) => {
            html += `
                <div style="background: #f9f9f9; border: 2px solid #1b1b1b; border-left: 6px solid #0040e0; padding: 0.85rem; margin-bottom: 0.6rem; max-width: 100%; ${textWrapStyle}">
                    <strong style="font-family: 'Space Mono', monospace; font-size: 0.85rem; color: #1b1b1b; ${textWrapStyle}">[${idx + 1}] ${citation.title || 'Source'}</strong>
                    <br>
                    <a href="${citation.uri || '#'}" target="_blank" rel="noopener noreferrer" style="color: #0040e0; font-weight: 700; text-decoration: underline; font-family: 'Space Mono', monospace; font-size: 0.78rem; ${textWrapStyle}; display: inline-block; margin-top: 4px; max-width: 100%;">
                        🔗 ${citation.uri || 'No URL available'}
                    </a>
                </div>
            `;
        });
        html += `</div>`;
    }

    // Footer
    html += `
        <div style="background: #1b1b1b; color: #00ff41; border: 3px solid #1b1b1b; padding: 1rem; text-align: center; font-size: 0.84rem; font-family: 'Space Mono', monospace; max-width: 100%; ${textWrapStyle}">
            <p style="margin: 0; ${textWrapStyle}">INFORMATION AUDITED USING WEBCMD + GEMINI AI MULTIMODAL OCR.</p>
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
    <title>DietXplore Safety Report</title>
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
    a.download = 'dietxplore_report.html';
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
DIETXPLORE SAFETY REPORT
========================

User Restrictions: ${userRestrictions}

Ingredients Detected:
${analysisResults.ingredients.map((ing, idx) => `${idx + 1}. ${ing}`).join('\n')}

Analysis:
${analysisText}

Citations: ${analysisResults.citations ? analysisResults.citations.length : 0} sources consulted

Information verified using WebCMD web research + Gemini AI.
    `.trim();

    const blob = new Blob([textSummary], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dietxplore_summary.txt';
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
