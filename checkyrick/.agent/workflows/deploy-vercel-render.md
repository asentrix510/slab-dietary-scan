---
description: Deploy CheckyRick to Vercel and Render
---

# Deploying CheckyRick to Vercel and Render

This guide explains how to deploy the CheckyRick project using **Vercel** for the frontend and **Render** for the backend.

## Architecture

- **Backend (Flask API)**: Deploy to **Render** (supports Python/Flask applications)
- **Frontend (Static Site)**: Deploy to **Vercel** (excellent for static sites and serverless)

---

## Part 1: Deploy Backend to Render

### Prerequisites
- Create a [Render](https://render.com) account
- Push your code to a Git repository (GitHub, GitLab, or Bitbucket)

### Step 1: Prepare Backend Files

1. **Create a `render.yaml` file** (optional but recommended for infrastructure-as-code):
   ```yaml
   services:
     - type: web
       name: checkyrick-api
       runtime: python
       buildCommand: pip install -r requirements.txt
       startCommand: python app.py
       envVars:
         - key: GEMINI_API_KEY
           sync: false
         - key: PYTHON_VERSION
           value: 3.11.0
   ```

2. **Ensure `app.py` uses `PORT` environment variable**:
   ```python
   # At the end of app.py, modify the run command:
   if __name__ == '__main__':
       port = int(os.environ.get('PORT', 5000))
       app.run(host='0.0.0.0', port=port)
   ```

### Step 2: Deploy to Render

1. **Go to Render Dashboard**: https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. **Connect your repository** from GitHub/GitLab
4. **Configure the service**:
   - **Name**: `checkyrick-api`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python app.py`
5. **Add Environment Variables**:
   - Click **"Environment"** tab
   - Add `GEMINI_API_KEY` with your API key
6. Click **"Create Web Service"**
7. **Note the deployed URL**: `https://checkyrick-api.onrender.com` (example)

### Step 3: Test Backend
```bash
curl https://checkyrick-api.onrender.com/health
```

---

## Part 2: Deploy Frontend to Vercel

### Prerequisites
- Create a [Vercel](https://vercel.com) account
- Install Vercel CLI: `npm install -g vercel`

### Step 1: Prepare Frontend Files

1. **Create a `vercel.json` configuration**:
   ```json
   {
     "buildCommand": null,
     "outputDirectory": ".",
     "routes": [
       { "src": "/", "dest": "/landingpage.html" },
       { "src": "/(.*)", "dest": "/$1" }
     ],
     "headers": [
       {
         "source": "/(.*)",
         "headers": [
           { "key": "Access-Control-Allow-Origin", "value": "*" }
         ]
       }
     ]
   }
   ```

2. **Update API URLs in JavaScript files**:
   - Open `script.js` and `landingpage.js`
   - Replace `http://localhost:5000` with your Render backend URL
   - Example:
     ```javascript
     const API_BASE_URL = 'https://checkyrick-api.onrender.com';
     ```

3. **Create a `.vercelignore` file**:
   ```
   app.py
   start_server.py
   requirements.txt
   .env
   .git
   __pycache__
   ```

### Step 2: Deploy to Vercel

#### Option A: Using Vercel CLI
```bash
# Login to Vercel
vercel login

# Deploy (from project root)
vercel --prod
```

#### Option B: Using Vercel Dashboard
1. Go to https://vercel.com/dashboard
2. Click **"Add New..." → "Project"**
3. **Import Git Repository**
4. **Configure Project**:
   - **Framework Preset**: `Other`
   - **Root Directory**: `./`
   - **Build Command**: Leave empty (no build needed)
   - **Output Directory**: `./`
5. Click **"Deploy"**
6. **Note the deployed URL**: `https://checkyrick.vercel.app` (example)

### Step 3: Test Frontend
Open your Vercel URL in a browser and test the application.

---

## Part 3: Environment Variables & CORS

### Backend CORS Configuration
Ensure your Flask app allows requests from your Vercel domain:

```python
# In app.py
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={
    r"/*": {
        "origins": [
            "http://localhost:8000",
            "https://*.vercel.app",  # Allow all Vercel deployments
            "https://checkyrick.vercel.app"  # Your specific domain
        ]
    }
})
```

### Environment Variables on Render
- `GEMINI_API_KEY`: Your Google Gemini API key
- `PORT`: Automatically set by Render (do not override)

---

## Part 4: Alternative Deployment Options

### Option 1: Deploy Everything to Render
If you prefer a single platform:
1. Add static file serving to Flask:
   ```python
   @app.route('/')
   def landing():
       return send_from_directory('.', 'landingpage.html')
   ```
2. Deploy just to Render as a single web service

### Option 2: Deploy Everything to Vercel (Serverless Functions)
Convert Flask to Vercel Serverless Functions:
1. Create `api/` directory
2. Move Flask routes to serverless functions
3. Deploy entire project to Vercel

---

## Troubleshooting

### Backend Issues (Render)
- **Logs**: Check Render dashboard → Your service → Logs tab
- **Port binding**: Ensure app binds to `0.0.0.0` not `localhost`
- **Build fails**: Verify `requirements.txt` has all dependencies

### Frontend Issues (Vercel)
- **404 errors**: Check `vercel.json` routing configuration
- **API failures**: Verify API URL is correct in JavaScript files
- **CORS errors**: Ensure backend CORS is properly configured

### API Key Security
- **Never commit** `.env` files
- Use Render's environment variable dashboard
- Rotate keys if accidentally exposed

---

## Cost Considerations

### Render Free Tier
- ✅ 750 hours/month of free service
- ❌ Spins down after 15 minutes of inactivity (30-60s cold start)
- ✅ Automatic HTTPS

### Vercel Free Tier
- ✅ Unlimited static hosting
- ✅ 100GB bandwidth/month
- ✅ Custom domains

### Upgrade Recommendations
- If cold starts are an issue → Upgrade Render to paid tier ($7/month)
- If you need more bandwidth → Upgrade Vercel to Pro ($20/month)

---

## Success Checklist

- [ ] Backend deployed to Render with correct environment variables
- [ ] Backend health endpoint responds successfully
- [ ] Frontend deployed to Vercel
- [ ] API URLs updated in frontend JavaScript files
- [ ] CORS configured to allow Vercel domain
- [ ] Test full workflow: upload image → analyze → view report
- [ ] Custom domain configured (optional)
- [ ] Environment variables secured (not in code)

---

## Next Steps

1. **Custom Domain**: Configure custom domains in Render and Vercel dashboards
2. **Monitoring**: Set up uptime monitoring (UptimeRobot, Better Stack)
3. **Analytics**: Add Google Analytics or Vercel Analytics
4. **CI/CD**: Set up automatic deployments on git push
