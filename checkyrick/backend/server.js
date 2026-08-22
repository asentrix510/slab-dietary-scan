import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');

// ===== API KEY MANAGEMENT =====

class APIKeyManager {
  constructor() {
    this.keys = [];
    this.currentIndex = 0;
    this._loadKeys();
  }

  _loadKeys() {
    // Try to load multiple keys (GEMINI_API_KEY_1, GEMINI_API_KEY_2, etc.)
    for (let i = 1; i <= 9; i++) {
      const key = process.env[`GEMINI_API_KEY_${i}`];
      if (key) this.keys.push(key.trim());
    }

    // Fallback to single GEMINI_API_KEY if no numbered keys found
    if (this.keys.length === 0) {
      const singleKey = process.env.GEMINI_API_KEY;
      if (singleKey) this.keys.push(singleKey.trim());
    }

    if (this.keys.length === 0) {
      console.log('⚠️  WARNING: No API keys found in .env file!');
      console.log('   Please add at least one of:');
      console.log('   - GEMINI_API_KEY=your_api_key_here');
      console.log('   - GEMINI_API_KEY_1=your_api_key_here');
      console.log('   - GEMINI_API_KEY_2=your_api_key_here');
    } else {
      console.log(`✅ Loaded ${this.keys.length} API key(s)`);
    }
  }

  getKey() {
    if (this.keys.length === 0) throw new Error('No API keys available');
    const key = this.keys[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    return key;
  }

  getKeyForOperation(operationType) {
    if (this.keys.length === 0) throw new Error('No API keys available');

    let index;
    if (operationType === 'extract') {
      index = Math.abs(hashCode(operationType)) % this.keys.length;
    } else if (operationType === 'analyze') {
      index = (Math.abs(hashCode(operationType)) + 1) % this.keys.length;
    } else {
      index = this.currentIndex;
      this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    }
    return this.keys[index];
  }

  getAllKeys() {
    return [...this.keys];
  }
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return hash;
}

// ===== WEBCMD INTEGRATION =====

/**
 * Run a webcmd CLI command and return its output.
 * Uses cmd.exe /c on Windows so webcmd.cmd batch runner is resolved properly.
 */
async function runWebcmd(args, timeoutMs = 30000) {
  const isWin = process.platform === 'win32';
  const command = isWin ? 'cmd.exe' : 'webcmd';
  const commandArgs = isWin ? ['/c', 'webcmd', ...args] : args;

  try {
    const { stdout, stderr } = await execFileAsync(command, commandArgs, {
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024 * 5, // 5MB
      env: { ...process.env, PAGER: 'cat' },
    });
    return { success: true, output: stdout.trim(), stderr: stderr?.trim() || '' };
  } catch (err) {
    const errorMsg = err.stderr?.trim() || err.message || 'Unknown error';
    console.warn(`⚠️ webcmd error (${args.slice(0, 4).join(' ')}): ${errorMsg.substring(0, 150)}`);
    return {
      success: false,
      output: err.stdout?.trim() || '',
      stderr: errorMsg,
      error: err.message,
    };
  }
}

/**
 * Use `webcmd web fetch` to search for ingredient information.
 * Fetches from multiple authoritative sources for comprehensive research.
 */
async function researchIngredientWithWebcmd(ingredient) {
  const sources = [];

  // Clean parenthetical notes like "Celery (in Chicken Broth)" -> "Celery"
  // Clean commas like "Pasta, Whole wheat" -> "Pasta Whole wheat"
  const cleanName = ingredient
    .replace(/\(.*?\)/g, '')
    .replace(/,/g, ' ')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanName) return sources;

  // Phase 1: High-yield search and knowledge targets (parallel)
  const searchQueries = [
    {
      label: 'Bing - Safety & Regulations',
      url: `https://www.bing.com/search?q=${encodeURIComponent(cleanName + ' food safety regulations banned countries')}`,
    },
    {
      label: 'DuckDuckGo Lite',
      url: `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(cleanName + ' food safety regulatory status allergen')}`,
    },
    {
      label: 'Wikipedia',
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(cleanName.replace(/\s+/g, '_'))}`,
    },
    {
      label: 'PubChem',
      url: `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(cleanName)}/description/JSON`,
    },
  ];

  const searchPromises = searchQueries.map(async (query) => {
    const result = await runWebcmd(['web', 'fetch', '--url', query.url], 20000);
    if (result.success && result.output && result.output.length > 50) {
      sources.push({
        source: query.label,
        url: query.url,
        content: result.output.substring(0, 4000),
      });
    }
    return result;
  });

  await Promise.allSettled(searchPromises);
  return sources;
}

/**
 * Research all ingredients in parallel using WebCMD, with concurrency limiting.
 */
async function researchAllIngredients(ingredients, onProgress) {
  const CONCURRENCY = 4;
  const results = {};
  const queue = [...ingredients];
  let completedCount = 0;

  async function worker() {
    while (queue.length > 0) {
      const ingredient = queue.shift();
      if (!ingredient) break;
      if (onProgress) {
        const cleanName = ingredient.replace(/\(.*?\)/g, '').replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
        onProgress(`🌐 WebCMD Researching "${cleanName.substring(0, 25)}"`, `Querying Bing, Wikipedia & PubChem (${completedCount + 1}/${ingredients.length})`);
      }
      results[ingredient] = await researchIngredientWithWebcmd(ingredient);
      completedCount++;
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, ingredients.length) }, () => worker());
  await Promise.all(workers);

  return results;
}

// ===== DIETARY SCANNER =====

class DietaryScanner {
  constructor(apiKeyManager) {
    this.apiKeyManager = apiKeyManager;
    this.modelName = 'gemini-3.6-flash';
  }

  _getClient(operationType = 'default') {
    const key = this.apiKeyManager.getKeyForOperation(operationType);
    return new GoogleGenAI({ apiKey: key });
  }

  async _generateWithRetry(contents, config = {}, retries = 3, operationType = 'default') {
    const keysToTry = this.apiKeyManager.getAllKeys();
    if (keysToTry.length === 0) throw new Error('No API keys available');

    let lastError = null;

    for (let keyAttempt = 0; keyAttempt < keysToTry.length; keyAttempt++) {
      const ai = this._getClient(operationType);

      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model: this.modelName,
            contents,
            config,
          });
          return response;
        } catch (e) {
          lastError = e;
          const errorStr = String(e.message || e);
          const errorLower = errorStr.toLowerCase();

          const isRetryable = (
            errorStr.includes('503') ||
            errorLower.includes('overloaded') ||
            errorStr.includes('429') ||
            errorStr.includes('500') ||
            errorLower.includes('internal') ||
            errorLower.includes('rate limit') ||
            errorLower.includes('quota')
          );

          const isAuthError = (
            errorStr.includes('401') ||
            errorStr.includes('403') ||
            errorLower.includes('unauthorized') ||
            errorLower.includes('permission') ||
            (errorLower.includes('invalid') && errorLower.includes('key'))
          );

          if (isAuthError) {
            console.log(`⚠️ Authentication error with key ${keyAttempt + 1}. Trying next key...`);
            break;
          }

          if (isRetryable && attempt < retries - 1) {
            const waitTime = (2 ** attempt) + Math.random();
            console.log(`⚠️ API Error (retryable). Retrying in ${waitTime.toFixed(2)}s... (Attempt ${attempt + 1}/${retries}, Key ${keyAttempt + 1})`);
            console.log(`   Error: ${errorStr.substring(0, 200)}`);
            await new Promise(r => setTimeout(r, waitTime * 1000));
          } else {
            if (keyAttempt < keysToTry.length - 1) {
              console.log(`⚠️ API Error with key ${keyAttempt + 1}. Trying next key...`);
              break;
            } else {
              console.log(`❌ API Error (all keys exhausted): ${errorStr}`);
              throw e;
            }
          }
        }
      }
    }

    throw lastError || new Error('Failed to generate content with all available keys');
  }

  /**
   * Extract ingredients from image using Gemini OCR
   */
  async extractIngredients(imageBuffer, mimeType) {
    const prompt = `
You are an expert in reading food labels and ingredient lists.

**Task:**
Extract ALL ingredients from the provided image. List them clearly, one per line.
If you see chemical names, preservatives, additives, or E-numbers, include them.

**Output Format:**
Return ONLY a simple list of ingredients, one per line, no additional text.
`;

    // Create inline image data for Gemini
    const imagePart = {
      inlineData: {
        data: imageBuffer.toString('base64'),
        mimeType,
      },
    };

    const response = await this._generateWithRetry(
      [{ role: 'user', parts: [{ text: prompt }, imagePart] }],
      {},
      3,
      'extract'
    );

    const ingredientsText = response.text?.trim() ||
      response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    if (!ingredientsText) {
      throw new Error('Failed to extract ingredients from image');
    }

    const ingredients = ingredientsText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    return ingredients;
  }

  /**
   * Analyze ingredients against dietary restrictions using Gemini + WebCMD research data
   */
  async analyzeIngredients(ingredients, dietaryRestrictions, researchData) {
    // Build context from WebCMD research
    let researchContext = '';
    for (const [ingredient, sources] of Object.entries(researchData)) {
      if (sources.length > 0) {
        researchContext += `\n--- Research for "${ingredient}" ---\n`;
        for (const source of sources) {
          researchContext += `[Source: ${source.source}]\n${source.content}\n\n`;
        }
      }
    }

    const analysisPrompt = `You are an expert Food Chemist and Regulatory Analyst.

CRITICAL OUTPUT REQUIREMENT: You MUST respond with ONLY valid JSON. No markdown, no code fences, no explanations, no text before or after the JSON. Start directly with { and end with }.

Analyze these ingredients against the user's dietary restrictions using the web research data provided below.

User Dietary Restrictions: ${dietaryRestrictions}
Ingredients: ${ingredients.join(', ')}

=== WEB RESEARCH DATA (from WebCMD searches) ===
${researchContext || 'No specific web research data available. Use your knowledge.'}
=== END OF RESEARCH DATA ===

For EACH ingredient, analyze:

1. **User Restriction Compliance**: Check if ingredient violates user's dietary restrictions
   - Look for chemical composition, not just exact name matches
   - Example: "No Onion" should flag "Allium", sulfur compounds, onion powder, etc.

2. **Complete Bans**: Countries/regions where ingredient is COMPLETELY PROHIBITED
   - Include the specific countries
   - Explain why it's banned (health, safety, religious, etc.)

3. **Regulatory Restrictions**: Countries/regions with LIMITATIONS on the ingredient
   - Concentration limits (e.g., "max 100ppm")
   - Warning label requirements
   - Age restrictions
   - Usage restrictions (e.g., "banned in baby food")

4. **Environmental & Ethical Concerns**: Global avoidance trends
   - Environmental issues (e.g., palm oil deforestation)
   - Ethical concerns (e.g., animal testing, labor practices)
   - Countries/regions actively discouraging use
   - Certification requirements (e.g., RSPO for palm oil)

5. **Health Impact**: Evidence-based health information
   - Proven health benefits
   - Known health risks
   - Allergen information
   - Recent scientific findings

REQUIRED JSON STRUCTURE (use this exact format):
{
  "compliance_status": "SAFE" | "WARNING" | "DANGER",
  "restriction_conflicts": [
    {"ingredient": "name", "issue": "description", "severity": "high|medium|low"}
  ],
  "regulatory_bans": [
    {"ingredient": "name", "countries": ["country1", "country2"], "reason": "explanation"}
  ],
  "regulatory_restrictions": [
    {"ingredient": "name", "countries": ["country1"], "type": "type", "reason": "explanation"}
  ],
  "health_notes": [
    {"ingredient": "name", "note": "information", "type": "positive|negative|neutral"}
  ],
  "summary": "brief overall assessment text"
}

IMPORTANT RULES:
- compliance_status must be exactly one of: "SAFE", "WARNING", or "DANGER"
- All arrays can be empty [] if no items found
- countries must be an array, even if only one country
- severity must be "high", "medium", or "low"
- type in health_notes must be "positive", "negative", or "neutral"
- For regulatory_restrictions, include ALL types: legal limits, warnings, environmental, ethical, consumer trends
- Use double quotes for all strings
- Escape any quotes within strings with backslash
- Return ONLY the JSON object, nothing else`;

    const response = await this._generateWithRetry(
      analysisPrompt,
      {},
      3,
      'analyze'
    );

    let responseText = response.text?.trim() ||
      response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    if (!responseText) {
      throw new Error('Failed to generate analysis');
    }

    // Robust JSON extraction
    responseText = this._extractJsonFromResponse(responseText);

    // Build citations from WebCMD sources
    const citations = [];
    const seenUrls = new Set();
    for (const sources of Object.values(researchData)) {
      for (const source of sources) {
        // Skip DuckDuckGo/Bing search page URLs, prefer actual content URLs
        const cleanUrl = source.url;
        if (!seenUrls.has(cleanUrl)) {
          seenUrls.add(cleanUrl);
          citations.push({
            uri: cleanUrl,
            title: `${source.source} - Research Source`,
          });
        }
      }
    }

    // Parse and validate JSON
    try {
      const parsed = JSON.parse(responseText);
      const defaultStructure = {
        compliance_status: 'SAFE',
        restriction_conflicts: [],
        regulatory_bans: [],
        regulatory_restrictions: [],
        health_notes: [],
        summary: 'Analysis complete',
      };

      for (const [key, defaultValue] of Object.entries(defaultStructure)) {
        if (!(key in parsed)) parsed[key] = defaultValue;
      }

      if (!['SAFE', 'WARNING', 'DANGER'].includes(parsed.compliance_status)) {
        parsed.compliance_status = 'SAFE';
      }

      return { analysis: JSON.stringify(parsed), citations };
    } catch (e) {
      const errorResponse = {
        compliance_status: 'WARNING',
        restriction_conflicts: [],
        regulatory_bans: [],
        regulatory_restrictions: [],
        health_notes: [],
        summary: `Analysis completed but response format was unexpected. Raw response: ${responseText.substring(0, 500)}`,
        raw_response: responseText,
        parse_error: e.message,
      };
      return { analysis: JSON.stringify(errorResponse), citations };
    }
  }

  _extractJsonFromResponse(responseText) {
    // Strategy 1: Remove markdown code fences
    if (responseText.startsWith('```')) {
      responseText = responseText.replace(/^```(?:json|JSON)?\s*\n?/i, '');
      responseText = responseText.replace(/\n?```\s*$/, '');
      responseText = responseText.trim();
    }

    // Strategy 2: Extract JSON object between first { and last }
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      responseText = jsonMatch[0];
    }

    responseText = responseText.trim();

    // Strategy 3: Try to parse and validate
    try {
      const parsed = JSON.parse(responseText);
      return JSON.stringify(parsed);
    } catch {
      // Strategy 4: Fix common issues
      const firstBrace = responseText.indexOf('{');
      if (firstBrace > 0) responseText = responseText.substring(firstBrace);

      const lastBrace = responseText.lastIndexOf('}');
      if (lastBrace > 0 && lastBrace < responseText.length - 1) {
        responseText = responseText.substring(0, lastBrace + 1);
      }

      try {
        const parsed = JSON.parse(responseText);
        return JSON.stringify(parsed);
      } catch {
        return responseText;
      }
    }
  }
}

// ===== EXPRESS APP SETUP =====

const app = express();
app.use(cors());
app.use(express.json());

// Configure multer for image uploads (in-memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

const apiKeyManager = new APIKeyManager();

// ===== API ENDPOINTS (registered BEFORE static middleware) =====

app.post('/analyze', upload.single('image'), async (req, res) => {
  // Set Server-Sent Events headers for real-time live status updates
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const sendProgress = (title, detail) => {
    res.write(`data: ${JSON.stringify({ type: 'progress', title, detail })}\n\n`);
  };

  const sendError = (errorMsg) => {
    res.write(`data: ${JSON.stringify({ type: 'error', error: errorMsg })}\n\n`);
    res.end();
  };

  try {
    // Check if API keys are configured
    if (apiKeyManager.getAllKeys().length === 0) {
      return sendError('API keys not configured. Please set GEMINI_API_KEY_1, GEMINI_API_KEY_2, etc. in .env file');
    }

    const restrictions = req.body.restrictions;
    const imageFile = req.file;

    if (!restrictions || !imageFile) {
      return sendError('Missing required fields (image or restrictions)');
    }

    const scanner = new DietaryScanner(apiKeyManager);

    // Step 1: Extract ingredients with Gemini OCR
    console.log('🔍 Step 1: Extracting ingredients from image...');
    sendProgress('🔍 Step 1: Extracting Ingredients...', 'Scanning label image with Gemini Vision OCR...');
    
    const ingredients = await scanner.extractIngredients(imageFile.buffer, imageFile.mimetype);
    console.log(`✅ Extracted ${ingredients.length} ingredients`);
    
    const ingredientsPreview = ingredients.slice(0, 3).join(', ') + (ingredients.length > 3 ? '...' : '');
    sendProgress('🔍 Ingredients Identified', `Found ${ingredients.length} ingredients: ${ingredientsPreview}`);

    // Step 2: Research each ingredient with WebCMD
    console.log('🌐 Step 2: Researching ingredients with WebCMD...');
    sendProgress('🌐 Step 2: WebCMD Researching...', `Querying live web index across ${ingredients.length} ingredients...`);

    const researchData = await researchAllIngredients(ingredients, (title, detail) => {
      sendProgress(title, detail);
    });

    const totalSources = Object.values(researchData).reduce((sum, s) => sum + s.length, 0);
    console.log(`✅ Gathered ${totalSources} research sources across ${ingredients.length} ingredients`);
    sendProgress('🌐 WebCMD Research Complete', `Gathered ${totalSources} verified sources across ${ingredients.length} ingredients.`);

    // Step 3: Analyze with Gemini (fed WebCMD research data)
    console.log('🧪 Step 3: Analyzing ingredients with Gemini + WebCMD data...');
    sendProgress('🧪 Step 3: Analyzing Safety & Rules...', 'Evaluating ingredients against your dietary ruleset with Gemini...');

    const { analysis, citations } = await scanner.analyzeIngredients(
      ingredients,
      restrictions,
      researchData
    );
    console.log(`✅ Analysis complete with ${citations.length} citations`);
    sendProgress('⚡ Compiling Safety Report...', 'Finalizing analysis structure and verification citations...');

    // Send complete result
    res.write(`data: ${JSON.stringify({
      type: 'complete',
      data: {
        success: true,
        ingredients,
        analysis,
        citations,
        restrictions,
      }
    })}\n\n`);
    res.end();

  } catch (e) {
    console.error(`Error: ${e.message}`);
    console.error(e.stack);
    sendError(e.message);
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ===== STATIC FILE SERVING (after API routes) =====

// Serve root as index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// Serve static files from the frontend directory
app.use(express.static(FRONTEND_DIR, {
  index: false, // Don't auto-serve index.html on /
}));

// ===== START SERVER =====

const PORT = parseInt(process.env.PORT || '5000', 10);

app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 Starting Dietary Deep Scan Backend (Node.js + WebCMD)...');
  const keys = apiKeyManager.getAllKeys();
  if (keys.length > 0) {
    console.log(`✅ ${keys.length} API key(s) loaded and ready`);
    console.log('   Using round-robin rotation for load distribution');
  } else {
    console.log('❌ WARNING: No API keys found in .env file!');
    console.log('   Please add API keys to .env file:');
    console.log('   GEMINI_API_KEY_1=your_first_key');
    console.log('   GEMINI_API_KEY_2=your_second_key');
  }
  console.log(`📡 Server running on http://localhost:${PORT}`);
  console.log('🌐 Using WebCMD for web research');
  console.log('💡 Open index.html in your browser to use the application');
});
