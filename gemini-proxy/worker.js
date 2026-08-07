/* =================================================================
   Cloudflare Worker — Gemini API Proxy
   Keeps API key server-side, adds rate limiting
   Deploy: npx wrangler deploy
   ================================================================= */

const RATE_LIMIT = 30; // requests per minute per IP
const RATE_WINDOW = 60; // seconds

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders(request)
      });
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'POST only' }, 405, request);
    }

    // Rate limiting using KV (or in-memory for simple deployment)
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rateLimitKey = `rl:${clientIP}`;
    
    if (env.RATE_LIMIT_KV) {
      const count = parseInt(await env.RATE_LIMIT_KV.get(rateLimitKey) || '0');
      if (count >= RATE_LIMIT) {
        return jsonResponse({ error: 'Rate limit exceeded. Try again in a minute.' }, 429, request);
      }
      await env.RATE_LIMIT_KV.put(rateLimitKey, String(count + 1), { expirationTtl: RATE_WINDOW });
    }

    try {
      const body = await request.json();
      const { messages, context, prompt } = body;

      const geminiKey = env.GEMINI_API_KEY;
      if (!geminiKey) {
        return jsonResponse({ error: 'API key not configured' }, 500, request);
      }

      // Build Gemini request
      const geminiBody = {
        contents: messages || [{ role: 'user', parts: [{ text: prompt || 'Hello' }] }],
        generationConfig: {
          maxOutputTokens: 500,
          temperature: 0.7
        }
      };

      if (context) {
        geminiBody.system_instruction = { parts: [{ text: context }] };
      }

      const geminiResp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiBody)
        }
      );

      if (!geminiResp.ok) {
        const errText = await geminiResp.text();
        return jsonResponse({ error: 'Gemini API error', details: errText }, geminiResp.status, request);
      }

      const geminiData = await geminiResp.json();
      const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

      return jsonResponse({ response: text }, 200, request);

    } catch (err) {
      return jsonResponse({ error: err.message }, 500, request);
    }
  }
};

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(data, status, request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(request)
    }
  });
}
