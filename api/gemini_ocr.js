export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      status: 'error',
      error: 'GEMINI_API_KEY is missing in Vercel Environment Variables. Please set GEMINI_API_KEY under Vercel Project Settings -> Environment Variables.'
    });
  }

  try {
    const { imageB64, mimeType = 'image/jpeg' } = req.body || {};
    if (!imageB64) {
      return res.status(400).json({ status: 'error', error: 'Missing image data' });
    }

    const cleanBase64 = imageB64.replace(/^data:image\/\w+;base64,/, '');

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
No markdown codeblocks, no explanatory text outside JSON.
`;

    // Official Google Gemini 1.5 Flash Vision Endpoint
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

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
      ]
    };

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiPayload)
    });

    if (!response.ok) {
      const errText = await response.text();
      let msg = `Google Gemini API Error (HTTP ${response.status}): ${errText}`;
      try {
        const errObj = JSON.parse(errText);
        if (errObj && errObj.error && errObj.error.message) {
          msg = `Google Gemini Error (${errObj.error.status || response.status}): ${errObj.error.message}`;
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

    return res.status(200).json({
      status: 'success',
      rowsCount: Array.isArray(parsedRows) ? parsedRows.length : 0,
      rows: Array.isArray(parsedRows) ? parsedRows : [],
      rawText: rawText
    });
  } catch (err) {
    console.error('Vercel Gemini OCR Error:', err);
    return res.status(500).json({
      status: 'error',
      error: err.message || 'Failed to process AI OCR image on Vercel backend.'
    });
  }
}
