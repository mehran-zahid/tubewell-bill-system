export const config = {
  maxDuration: 30,
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
};

export default async function handler(req, res) {
  const startTime = Date.now();
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[OCR ERROR] GEMINI_API_KEY environment variable is missing on Vercel backend.');
    return res.status(500).json({
      status: 'error',
      error: 'GEMINI_API_KEY environment variable is missing on Vercel backend. Please add GEMINI_API_KEY under Vercel Project Settings -> Environment Variables and redeploy.'
    });
  }

  try {
    const { imageB64, mimeType = 'image/jpeg' } = req.body || {};
    if (!imageB64) {
      console.error('[OCR ERROR] Missing image data in request body.');
      return res.status(400).json({ status: 'error', error: 'Missing image data' });
    }

    const cleanBase64 = imageB64.replace(/^data:image\/\w+;base64,/, '');
    const estimatedKb = Math.round((cleanBase64.length * 0.75) / 1024);
    console.log(`[OCR START] Received image scan request (${estimatedKb} KB).`);

    const promptText = `
You are an expert OCR & Meter Reading Data Assistant for Pakistan Agricultural Tubewell Registers.
Extract all member reading entries from this register log image into JSON.

RULES:
1. Identify member names (English or Urdu), User ID/Code if available, and start/end meter readings.
2. Return ONLY a valid JSON array of objects with the following schema:
[
  {
    "userCode": "01",
    "nameEn": "Malik Tariq",
    "nameUr": "ملک طارق",
    "startReading": 1240,
    "endReading": 1350,
    "notes": "Normal run"
  }
]
`;

    const geminiPayload = {
      contents: [
        {
          parts: [
            { text: promptText },
            {
              inlineData: {
                mimeType: mimeType,
                data: cleanBase64
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        maxOutputTokens: 1000
      }
    };

    // Official active Google Gemini models from Google AI Documentation (ai.google.dev/gemini-api/docs/models)
    const targetModels = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-3.5-flash'];

    let response = null;
    let lastErrText = '';
    let usedModel = '';

    for (const mName of targetModels) {
      try {
        const fetchStart = Date.now();
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${mName}:generateContent?key=${apiKey}`;
        console.log(`[OCR FETCH] Calling official Google endpoint for model: ${mName}...`);
        
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiPayload)
        });

        if (res.ok) {
          response = res;
          usedModel = mName;
          console.log(`[OCR SUCCESS MODEL] Model ${mName} responded OK in ${Date.now() - fetchStart}ms.`);
          break;
        } else {
          lastErrText = await res.text();
          console.warn(`[OCR WARN MODEL] Model ${mName} returned HTTP ${res.status}: ${lastErrText}`);
        }
      } catch (e) {
        lastErrText = e.message;
        console.error(`[OCR ERROR MODEL] Model ${mName} exception:`, e);
      }
    }

    if (!response) {
      console.error(`[OCR FAILURE ALL MODELS] All target models failed. Last error: ${lastErrText}`);
      let msg = `Google Gemini API Error: ${lastErrText}`;
      try {
        const errObj = JSON.parse(lastErrText);
        if (errObj && errObj.error && errObj.error.message) {
          msg = `Google Gemini Error (${errObj.error.status || 'API_ERROR'}): ${errObj.error.message}`;
        }
      } catch (e) {}

      return res.status(500).json({
        status: 'error',
        error: msg
      });
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    
    let parsedRows = [];
    try {
      const cleanJson = rawText.replace(/^```json\s*/m, '').replace(/^```\s*/m, '').replace(/```$/m, '').trim();
      parsedRows = JSON.parse(cleanJson);
    } catch (e) {
      const match = rawText.match(/\[[\s\S]*\]/);
      if (match) {
        try {
          parsedRows = JSON.parse(match[0]);
        } catch (e2) {}
      }
    }

    const totalDuration = Date.now() - startTime;
    console.log(`[OCR COMPLETE] Model: ${usedModel} | Duration: ${totalDuration}ms | Rows Extracted: ${parsedRows.length}`);

    return res.status(200).json({
      status: 'success',
      modelUsed: usedModel,
      rowsCount: Array.isArray(parsedRows) ? parsedRows.length : 0,
      rows: Array.isArray(parsedRows) ? parsedRows : [],
      rawText: rawText
    });
  } catch (err) {
    console.error('[OCR EXCEPTION]', err);
    return res.status(500).json({
      status: 'error',
      error: err.message || 'Failed to process AI OCR image on Vercel backend.'
    });
  }
}
