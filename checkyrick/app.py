from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# ===== API KEY MANAGEMENT =====
class APIKeyManager:
    """Manages multiple API keys with round-robin rotation"""
    def __init__(self):
        self.keys = []
        self.current_index = 0
        self._load_keys()
    
    def _load_keys(self):
        """Load API keys from environment variables"""
        # Try to load multiple keys (GEMINI_API_KEY_1, GEMINI_API_KEY_2, etc.)
        key_count = 0
        for i in range(1, 10):  # Support up to 9 keys
            key = os.getenv(f'GEMINI_API_KEY_{i}')
            if key:
                self.keys.append(key.strip())
                key_count += 1
        
        # Fallback to single GEMINI_API_KEY if no numbered keys found
        if not self.keys:
            single_key = os.getenv('GEMINI_API_KEY')
            if single_key:
                self.keys.append(single_key.strip())
                key_count = 1
        
        if not self.keys:
            print("⚠️  WARNING: No API keys found in .env file!")
            print("   Please add at least one of:")
            print("   - GEMINI_API_KEY=your_api_key_here")
            print("   - GEMINI_API_KEY_1=your_api_key_here")
            print("   - GEMINI_API_KEY_2=your_api_key_here")
            print("   - etc.")
        else:
            print(f"✅ Loaded {len(self.keys)} API key(s)")
    
    def get_key(self, operation_type='default'):
        """Get an API key using round-robin rotation"""
        if not self.keys:
            raise ValueError("No API keys available")
        
        # Use round-robin to distribute load
        key = self.keys[self.current_index]
        self.current_index = (self.current_index + 1) % len(self.keys)
        return key
    
    def get_key_for_operation(self, operation_type):
        """Get a specific key for an operation type (for better distribution)"""
        if not self.keys:
            raise ValueError("No API keys available")
        
        # Use operation type to select key (ensures different operations use different keys)
        # This helps distribute load more evenly
        if operation_type == 'extract':
            # Use keys 0, 1 for extraction
            index = hash(operation_type) % len(self.keys)
        elif operation_type == 'analyze':
            # Use keys 2, 3 for analysis
            index = (hash(operation_type) + 1) % len(self.keys)
        else:
            # Default round-robin
            index = self.current_index
            self.current_index = (self.current_index + 1) % len(self.keys)
        
        return self.keys[index]
    
    def get_all_keys(self):
        """Get all available keys"""
        return self.keys.copy()

# Initialize API key manager
api_key_manager = APIKeyManager()

# ===== DIETARY SCANNER LOGIC =====

class DietaryScanner:
    def __init__(self, api_key_manager):
        from google.genai import Client
        self.api_key_manager = api_key_manager
        self.model_name = 'gemini-2.5-flash'
    
    def _get_client_for_operation(self, operation_type='default'):
        """Get a client with a key for the specified operation"""
        from google.genai import Client
        key = self.api_key_manager.get_key_for_operation(operation_type)
        return Client(api_key=key), key

    def _generate_with_retry(self, contents, config=None, retries=3, operation_type='default'):
        import time
        import random
        
        # Get all available keys
        keys_to_try = self.api_key_manager.get_all_keys()
        if not keys_to_try:
            raise ValueError("No API keys available")
        
        last_error = None
        
        # Try each key in rotation
        for key_attempt in range(len(keys_to_try)):
            # Get a client with a key for this operation
            client, current_key = self._get_client_for_operation(operation_type)
            
            for attempt in range(retries):
                try:
                    return client.models.generate_content(
                        model=self.model_name,
                        contents=contents,
                        config=config
                    )
                except Exception as e:
                    last_error = e
                    # Check for overload or server errors (503, 500, etc)
                    error_str = str(e)
                    error_lower = error_str.lower()
                    
                    # Check if it's a retryable error
                    is_retryable = (
                        '503' in error_str or 
                        'overloaded' in error_lower or 
                        '429' in error_str or 
                        '500' in error_str or 
                        'internal' in error_lower or
                        'rate limit' in error_lower or
                        'quota' in error_lower
                    )
                    
                    # Check if it's an authentication error (wrong key)
                    is_auth_error = (
                        '401' in error_str or
                        '403' in error_str or
                        'unauthorized' in error_lower or
                        'permission' in error_lower or
                        ('invalid' in error_lower and 'key' in error_lower)
                    )
                    
                    if is_auth_error:
                        # If auth error, try next key immediately
                        print(f"⚠️ Authentication error with key {key_attempt + 1}. Trying next key...")
                        break  # Break inner loop to try next key
                    
                    if is_retryable and attempt < retries - 1:
                        wait_time = (2 ** attempt) + random.random()
                        print(f"⚠️ API Error (retryable). Retrying in {wait_time:.2f}s... (Attempt {attempt+1}/{retries}, Key {key_attempt + 1})")
                        print(f"   Error: {error_str[:200]}")
                        time.sleep(wait_time)
                    else:
                        # If it's not a transient error, try next key
                        if key_attempt < len(keys_to_try) - 1:
                            print(f"⚠️ API Error with key {key_attempt + 1}. Trying next key...")
                            break  # Break inner loop to try next key
                        else:
                            # Last key, last attempt
                            print(f"❌ API Error (all keys exhausted): {error_str}")
                            raise e
        
        raise last_error if last_error else Exception("Failed to generate content with all available keys")

    def extract_ingredients(self, image_data):
        """Extract ingredients from image using OCR"""
        from google.genai import types
        
        prompt = """
        You are an expert in reading food labels and ingredient lists.
        
        **Task:**
        Extract ALL ingredients from the provided image. List them clearly, one per line.
        If you see chemical names, preservatives, additives, or E-numbers, include them.
        
        **Output Format:**
        Return ONLY a simple list of ingredients, one per line, no additional text.
        """
        
        # Create image part
        image_part = types.Part.from_bytes(
            data=image_data['data'],
            mime_type=image_data['mime_type']
        )
        
        response = self._generate_with_retry(
            contents=[prompt, image_part],
            operation_type='extract'
        )
        
        # Handle response - check if it has text attribute
        if hasattr(response, 'text'):
            ingredients_text = response.text.strip()
        elif hasattr(response, 'candidates') and response.candidates:
            ingredients_text = response.candidates[0].content.parts[0].text.strip()
        else:
            raise ValueError(f"Unexpected response format: {type(response)}")
        
        ingredients = [ing.strip() for ing in ingredients_text.split('\n') if ing.strip()]
        
        return ingredients

    def _extract_json_from_response(self, response_text):
        """Extract JSON from response using multiple strategies"""
        import re
        import json
        
        # Strategy 1: Remove markdown code fences
        if response_text.startswith('```'):
            # Remove opening fence (handles ```json, ```, etc.)
            response_text = re.sub(r'^```(?:json|JSON)?\s*\n?', '', response_text, flags=re.IGNORECASE)
            # Remove closing fence
            response_text = re.sub(r'\n?```\s*$', '', response_text)
            response_text = response_text.strip()
        
        # Strategy 2: Extract JSON object between first { and last }
        json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
        if json_match:
            response_text = json_match.group(0)
        
        # Strategy 3: Remove any leading/trailing text
        response_text = response_text.strip()
        
        # Strategy 4: Try to parse and validate JSON
        try:
            # Attempt to parse to validate it's valid JSON
            parsed = json.loads(response_text)
            # If successful, return as JSON string (normalized)
            return json.dumps(parsed, ensure_ascii=False)
        except json.JSONDecodeError:
            # If parsing fails, try to fix common issues
            # Remove any text before first {
            first_brace = response_text.find('{')
            if first_brace > 0:
                response_text = response_text[first_brace:]
            
            # Remove any text after last }
            last_brace = response_text.rfind('}')
            if last_brace > 0 and last_brace < len(response_text) - 1:
                response_text = response_text[:last_brace + 1]
            
            # Try parsing again
            try:
                parsed = json.loads(response_text)
                return json.dumps(parsed, ensure_ascii=False)
            except json.JSONDecodeError:
                # If still fails, return the cleaned text (will be handled by frontend)
                return response_text
    
    def analyze_ingredients(self, ingredients, dietary_restrictions):
        """Analyze ingredients against dietary restrictions with Google Search grounding"""
        from google.genai import types
        import re
        import json
        
        analysis_prompt = f"""You are an expert Food Chemist and Regulatory Analyst with access to current web information.

CRITICAL OUTPUT REQUIREMENT: You MUST respond with ONLY valid JSON. No markdown, no code fences, no explanations, no text before or after the JSON. Start directly with {{ and end with }}.

Analyze these ingredients against the user's dietary restrictions AND provide comprehensive global regulatory information.

User Dietary Restrictions: {dietary_restrictions}
Ingredients: {', '.join(ingredients)}

For EACH ingredient, search and analyze:

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
{{
  "compliance_status": "SAFE" | "WARNING" | "DANGER",
  "restriction_conflicts": [
    {{"ingredient": "name", "issue": "description", "severity": "high|medium|low"}}
  ],
  "regulatory_bans": [
    {{"ingredient": "name", "countries": ["country1", "country2"], "reason": "explanation"}}
  ],
  "regulatory_restrictions": [
    {{"ingredient": "name", "countries": ["country1"], "type": "type", "reason": "explanation"}}
  ],
  "health_notes": [
    {{"ingredient": "name", "note": "information", "type": "positive|negative|neutral"}}
  ],
  "summary": "brief overall assessment text"
}}

IMPORTANT RULES:
- compliance_status must be exactly one of: "SAFE", "WARNING", or "DANGER"
- All arrays can be empty [] if no items found
- countries must be an array, even if only one country
- severity must be "high", "medium", or "low"
- type in health_notes must be "positive", "negative", or "neutral"
- For regulatory_restrictions, include ALL types: legal limits, warnings, environmental, ethical, consumer trends
- Use double quotes for all strings
- Escape any quotes within strings with backslash
- Return ONLY the JSON object, nothing else"""
        
        # Use Google Search tool
        grounding_tool = types.Tool(
            google_search=types.GoogleSearch()
        )
        
        config = types.GenerateContentConfig(
            tools=[grounding_tool]
        )
        
        response = self._generate_with_retry(
            contents=analysis_prompt,
            config=config,
            operation_type='analyze'
        )
        
        # Clean the response text to ensure valid JSON
        if hasattr(response, 'text'):
            response_text = response.text.strip()
        elif hasattr(response, 'candidates') and response.candidates:
            response_text = response.candidates[0].content.parts[0].text.strip()
        else:
            raise ValueError(f"Unexpected response format: {type(response)}")
        
        # Robust JSON extraction with multiple strategies
        response_text = self._extract_json_from_response(response_text)
        
        # Extract citations from grounding metadata
        citations = []
        if hasattr(response, 'candidates') and response.candidates:
            candidate = response.candidates[0]
            if hasattr(candidate, 'grounding_metadata') and candidate.grounding_metadata:
                grounding = candidate.grounding_metadata
                if hasattr(grounding, 'grounding_chunks') and grounding.grounding_chunks:
                    for chunk in grounding.grounding_chunks:
                        if hasattr(chunk, 'web') and chunk.web:
                            citations.append({
                                'uri': chunk.web.uri if hasattr(chunk.web, 'uri') else '',
                                'title': chunk.web.title if hasattr(chunk.web, 'title') else chunk.web.uri if hasattr(chunk.web, 'uri') else 'Source'
                            })
        
        # Try to parse and validate the JSON structure
        try:
            parsed_json = json.loads(response_text)
            # Ensure all required fields exist with defaults
            default_structure = {
                'compliance_status': 'SAFE',
                'restriction_conflicts': [],
                'regulatory_bans': [],
                'regulatory_restrictions': [],
                'health_notes': [],
                'summary': 'Analysis complete'
            }
            
            # Merge with defaults to ensure all fields exist
            for key, default_value in default_structure.items():
                if key not in parsed_json:
                    parsed_json[key] = default_value
            
            # Validate compliance_status
            if parsed_json.get('compliance_status') not in ['SAFE', 'WARNING', 'DANGER']:
                parsed_json['compliance_status'] = 'SAFE'
            
            # Return normalized JSON string
            return json.dumps(parsed_json, ensure_ascii=False), citations
        except (json.JSONDecodeError, TypeError) as e:
            # If JSON parsing fails, create a structured error response
            error_response = {
                'compliance_status': 'WARNING',
                'restriction_conflicts': [],
                'regulatory_bans': [],
                'regulatory_restrictions': [],
                'health_notes': [],
                'summary': f'Analysis completed but response format was unexpected. Raw response: {response_text[:500]}',
                'raw_response': response_text,
                'parse_error': str(e)
            }
            return json.dumps(error_response, ensure_ascii=False), citations

# ===== API ENDPOINTS =====

@app.route('/analyze', methods=['POST'])
def analyze():
    """Start analysis and return results synchronously"""
    try:
        # Check if API keys are configured
        if not api_key_manager.get_all_keys():
            return jsonify({'error': 'API keys not configured. Please set GEMINI_API_KEY_1, GEMINI_API_KEY_2, etc. in .env file'}), 500
        
        # Get form data
        restrictions = request.form.get('restrictions')
        image_file = request.files.get('image')
        
        if not restrictions or not image_file:
            return jsonify({'error': 'Missing required fields'}), 400
        
        # Read image
        image_bytes = image_file.read()
        image_data = {
            'mime_type': image_file.content_type,
            'data': image_bytes
        }
        
        scanner = DietaryScanner(api_key_manager)
        
        # Step 1: Extract ingredients
        ingredients = scanner.extract_ingredients(image_data)
        
        # Step 2: Analyze (now returns citations too)
        analysis_json, citations = scanner.analyze_ingredients(ingredients, restrictions)
        
        return jsonify({
            'success': True,
            'ingredients': ingredients,
            'analysis': analysis_json,
            'citations': citations,
            'restrictions': restrictions
        })
        
    except Exception as e:
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    print("🚀 Starting Dietary Deep Scan Backend...")
    if api_key_manager.get_all_keys():
        print(f"✅ {len(api_key_manager.get_all_keys())} API key(s) loaded and ready")
        print("   Using round-robin rotation for load distribution")
    else:
        print("❌ WARNING: No API keys found in .env file!")
        print("   Please add API keys to .env file:")
        print("   GEMINI_API_KEY_1=your_first_key")
        print("   GEMINI_API_KEY_2=your_second_key")
        print("   GEMINI_API_KEY_3=your_third_key")
        print("   GEMINI_API_KEY_4=your_fourth_key")
    
    # Get port from environment variable (for Render/hosting platforms) or use 5000 locally
    port = int(os.environ.get('PORT', 5000))
    print(f"📡 Server running on http://localhost:{port}")
    print("💡 Open index.html in your browser to use the application")
    
    # Use 0.0.0.0 to allow external connections (required for deployment)
    app.run(host='0.0.0.0', debug=True, port=port)
