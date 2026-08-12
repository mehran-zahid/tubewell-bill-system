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

    // 1. First, dynamically list all models available for this API Key
    let availableModels = [];
    let listModelsError = null;

    try {
      const listResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      if (listResp.ok) {
        const listData = await listResp.json();
        if (listData && Array.isArray(listData.models)) {
          availableModels = listData.models
            .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
            .map(m => m.name.replace(/^models\//, ''));
        }
      } else {
        const errTxt = await listResp.text();
        listModelsError = `ListModels HTTP ${listResp.status}: ${errTxt}`;
      }
    } catch (e) {
      listModelsError = e.message;
    }

    // 2. Fallback candidate list if ListModels didn't return any
    const candidateModels = (availableModels.length > 0)
      ? availableModels
      : ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.5-flash', 'gemini-1.0-pro'];

    let data = null;
    let errorsList = [];

    for (const modelName of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiPayload)
        });

        if (response.ok) {
          data = await response.json();
          break;
        } else {
          const errText = await response.text();
          errorsList.push(`[${modelName}] HTTP ${response.status}: ${errText}`);
        }
      } catch (e) {
        errorsList.push(`[${modelName}] ${e.message}`);
      }
    }

    if (!data) {
      const activeListStr = availableModels.length > 0 ? availableModels.join(', ') : 'None found';
      return res.status(500).json({
        status: 'error',
        error: `Gemini OCR failed for key.\nAvailable Key Models: [${activeListStr}]\n\nDebug Logs:\n${errorsList.join('\n')}\n${listModelsError ? `\nListModels Error: ${listModelsError}` : ''}`
      });
    }

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
