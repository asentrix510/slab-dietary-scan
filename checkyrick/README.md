# Dietary Deep Scan System (CheckyRick) 🧬

[![Deployment Status](https://img.shields.io/badge/status-deployed-success)](https://checkyrick.vercel.app)
[![Backend](https://img.shields.io/badge/backend-render-blue)](https://render.com)
[![Frontend](https://img.shields.io/badge/frontend-vercel-black)](https://vercel.com)
[![AI Powered](https://img.shields.io/badge/AI-Gemini%202.5%20Flash-orange)](https://ai.google.dev)

An advanced dietary analysis system that performs **Google Search-grounded research** on food ingredients to verify compliance with dietary restrictions, check for global bans, and assess health impacts.

## 🌐 Live Deployment

- **Frontend**: Deployed on Vercel (Static Site)
- **Backend API**: Deployed on Render (Flask/Python)
- **Status**: ✅ Production Ready

## ✨ Key Features

### 🔍 **Web-Grounding with Google Search**
- Uses **Google Gemini 2.5 Flash** with built-in search grounding
- Verifies every finding with real-time web searches
- No need for separate search API keys (uses Gemini's grounding capabilities)
- Multi-API key support with intelligent round-robin rotation for high availability

### 📚 **Transparent Citations**
- Every claim is backed by source URLs
- Displays a dedicated "Sources & Citations" section in reports
- Links directly to the websites where information was found
- Grounding metadata extracted from Gemini API responses

### 🌍 **Global Regulatory Analysis**
- **Bans**: Identifies ingredients completely prohibited in specific countries
- **Restrictions**: Flags limited usage, concentration limits, and warning requirements
- **Compliance**: Checks against your specific dietary needs (Vegan, Halal, Allergies, etc.)
- **Environmental & Ethical**: Flags sustainability and ethical concerns (e.g., palm oil deforestation)

### 🔬 **Advanced Ingredient Extraction**
- Extracts ingredients directly from product label images using Multimodal AI
- Identifies chemical names, E-numbers, and preservatives
- Understands complex chemical compositions (e.g., flagging "Casein" for dairy restrictions)
- Multimodal OCR with context-aware ingredient recognition

### 📊 **Professional HTML Reports**
- Generates beautiful, responsive reports in real-time
- Color-coded safety status (Safe/Warning/Danger)
- Interactive loading spinner with blur overlay
- Downloadable in HTML or Text formats
- Mobile-responsive design

### ⚡ **Enterprise-Grade Reliability**
- **Multi-API Key Support**: Configure up to 9 API keys for load distribution
- **Round-Robin Rotation**: Intelligent key rotation to maximize uptime
- **Automatic Retry Logic**: Handles transient errors with exponential backoff
- **Comprehensive Error Handling**: Graceful degradation and informative error messages

## 🛠️ Tech Stack

### Backend
- **Framework**: Flask (Python 3.11+)
- **AI Engine**: Google Gemini 2.5 Flash (`google-genai` SDK)
- **CORS**: Flask-CORS for cross-origin requests
- **Deployment**: Render (Free tier with auto-scaling)

### Frontend
- **Core**: HTML5, CSS3, Vanilla JavaScript
- **Styling**: Custom CSS with Fredoka font family
- **Features**: Drag-and-drop file upload, real-time analysis, citation display
- **Deployment**: Vercel (Static hosting)

### API Architecture
- **RESTful API**: Simple, stateless endpoints
- **Synchronous Analysis**: Direct response model (replaced SSE for reliability)
- **Health Checks**: `/health` endpoint for uptime monitoring
- **Environment-based Configuration**: Secure API key management

## 🚀 Installation

### Prerequisites
- Python 3.11 or higher
- Google Gemini API key(s) from [Google AI Studio](https://aistudio.google.com)
- Git

### Local Setup

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd CheckyRick
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Set up API Keys:**
   Create a `.env` file in the root directory:
   
   **Single Key (Basic):**
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```
   
   **Multiple Keys (Recommended for Production):**
   ```env
   GEMINI_API_KEY_1=your_first_api_key
   GEMINI_API_KEY_2=your_second_api_key
   GEMINI_API_KEY_3=your_third_api_key
   GEMINI_API_KEY_4=your_fourth_api_key
   ```
   
   > **Note**: Multi-key setup provides better reliability and higher rate limits

## 💻 Usage

### Running Locally

1. **Start the Backend Server:**
   ```bash
   python app.py
   ```
   *The server will start at `http://localhost:5000`*

2. **Launch the Frontend:**
   - Open `index.html` in your web browser
   - Or use a local server: `python -m http.server 8000`

3. **Analyze a Product:**
   - **Upload**: Drag & drop an image of an ingredient label
   - **Restrictions**: Enter your dietary needs (e.g., "No gluten, Vegan, Allergic to peanuts")
   - **Analyze**: Click "Run Deep Analysis"
   - **View Report**: Read the comprehensive analysis with cited sources

### Deployment

For detailed deployment instructions, see the [deployment workflow](.agent/workflows/deploy-vercel-render.md).

**Quick Deploy:**
- **Frontend**: `vercel --prod`
- **Backend**: Deploy to Render using `render.yaml` configuration

## 📋 Example Usage

### Dietary Restriction Examples
- **Religious**: `Halal, No Alcohol, No Pork`
- **Lifestyle**: `Vegan, No Palm Oil, Cruelty-Free`
- **Health**: `Gluten-Free, No Artificial Dyes, Low Sodium`
- **Allergy**: `No Peanuts, No Dairy, No Soy`
- **Age-Specific**: `Toddler Safe, No Added Sugar, No Caffeine`

## 🏗️ Project Structure

```
CheckyRick/
├── app.py                  # Flask backend with multi-key support
├── start_server.py         # Server startup script
├── index.html              # Main scanner interface (landing page)
├── scanner.html            # Analysis page
├── account.html            # User account page
├── account_login.html      # Login page
├── script.js               # Main frontend logic with analysis handling
├── index.js                # Landing page logic
├── style.css               # Scanner page styles
├── index.css               # Main application styles
├── requirements.txt        # Python dependencies
├── .env                    # Environment variables (API keys)
├── vercel.json            # Vercel deployment configuration
├── render.yaml            # Render deployment configuration
├── .vercelignore          # Files to exclude from Vercel deployment
└── .agent/
    └── workflows/
        └── deploy-vercel-render.md  # Deployment guide
```

## 🔧 Configuration

### Backend Configuration (`app.py`)
- **Multi-API Key Management**: Automatic round-robin rotation
- **Port Configuration**: Uses `PORT` environment variable (Render) or defaults to 5000
- **CORS**: Configured to allow Vercel frontend
- **Error Handling**: Comprehensive retry logic with exponential backoff

### Frontend Configuration
- **API Base URL**: Update in `script.js` and `index.js` for deployment
- **Loading States**: Visual feedback during analysis
- **Citation Display**: Automatic extraction and display of web sources

## 🐛 Troubleshooting

### Common Issues

**Backend won't start:**
- Verify API keys are set in `.env` file
- Check Python version (3.11+)
- Install dependencies: `pip install -r requirements.txt`

**Analysis fails:**
- Check API key validity in Google AI Studio
- Verify image format (JPEG, PNG supported)
- Check backend logs for specific error messages

**CORS errors:**
- Ensure backend CORS is configured for your frontend domain
- On localhost, use `http://localhost:8000` (not `file://`)

**Deployment issues:**
- **Render**: Check logs in Render dashboard
- **Vercel**: Verify `vercel.json` configuration
- **API Keys**: Ensure environment variables are set in deployment platforms

## 📊 API Endpoints

### `POST /analyze`
Analyzes food product images against dietary restrictions.

**Request:**
- `restrictions` (form-data): Dietary restrictions as text
- `image` (form-data): Product label image file

**Response:**
```json
{
  "success": true,
  "ingredients": ["ingredient1", "ingredient2"],
  "analysis": "{ JSON analysis object }",
  "citations": [
    {"uri": "https://example.com", "title": "Source Title"}
  ],
  "restrictions": "User's restrictions"
}
```

### `GET /health`
Health check endpoint for monitoring.

**Response:**
```json
{
  "status": "ok"
}
```

## 🔐 Security

- **API Keys**: Never commit `.env` files to version control
- **Environment Variables**: Use platform-specific secret management (Render, Vercel)
- **CORS**: Configured to allow only specific domains in production
- **Input Validation**: Backend validates all user inputs

## 📈 Performance

- **Multi-Key Setup**: Supports up to 9 API keys for load distribution
- **Round-Robin**: Distributes requests across keys to maximize throughput
- **Retry Logic**: Automatic failover to alternative keys on errors
- **Cold Start**: Render free tier spins down after 15 mins (30-60s startup)

## 🚀 Future Enhancements

- [ ] User authentication and history tracking
- [ ] Batch analysis for multiple products
- [ ] Mobile app (React Native/Flutter)
- [ ] Barcode scanning integration
- [ ] Community-contributed ingredient database
- [ ] Multi-language support
- [ ] Export to PDF