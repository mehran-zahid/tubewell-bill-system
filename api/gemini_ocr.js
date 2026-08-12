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
You are an expert OCR & Meter Reading Data Assistant for Pakistan Agricultural Tubewell Registers (مشترکہ ٹربائن).
Carefully read the handwritten register sheet in the image and extract all member log entries.

INSTRUCTIONS:
1. Extract Member Name (Urdu or English transliteration), Start Reading (شروع), End Reading (ختم), and Date (تاریخ) if visible.
2. Return ONLY a valid JSON array of objects with the exact schema below:

[
  {
    "userCode": "01",
    "nameEn": "Munir Ahmad",
    "nameUr": "منیر احمد",
    "startReading": 1156421,
    "endReading": 1156535,
    "notes": "13-7-26"
  }
]

DO NOT wrap in object keys like {"entries": [...]}. Return ONLY the JSON array.
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
        maxOutputTokens: 2000
      }
    };

    // Priority Multimodal Vision Models enabled on Google AI Studio
    const priorityVisionModels = [
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite',
      'gemini-flash-latest'
    ];

    let response = null;
    let lastErrText = '';
    let usedModel = '';

    for (const mName of priorityVisionModels) {
      try {
        const fetchStart = Date.now();
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${mName}:generateContent?key=${apiKey}`;
        console.log(`[OCR FETCH] Calling Vision Model: ${mName}...`);
        
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiPayload)
        });

        if (res.ok) {
          const textRes = await res.text();
          try {
            const jsonRes = JSON.parse(textRes);
            const rawPartsText = jsonRes?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (rawPartsText && rawPartsText.length > 5) {
              response = jsonRes;
              usedModel = mName;
              console.log(`[OCR SUCCESS VISION MODEL] Model ${mName} responded in ${Date.now() - fetchStart}ms.`);
              break;
            }
          } catch (e) {}
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

    const rawText = response?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    console.log('[RAW AI RESPONSE]', rawText);

    let parsedRows = [];
    try {
      const cleanJson = rawText.replace(/^```json\s*/m, '').replace(/^```\s*/m, '').replace(/```$/m, '').trim();
      const parsed = JSON.parse(cleanJson);
      
      if (Array.isArray(parsed)) {
        parsedRows = parsed;
      } else if (parsed && typeof parsed === 'object') {
        parsedRows = parsed.entries || parsed.rows || parsed.members || parsed.data || [];
      }
    } catch (e) {
      console.warn('[JSON PARSE WARN] Falling back to regex match:', e.message);
      const match = rawText.match(/\[[\s\S]*\]/);
      if (match) {
        try {
          parsedRows = JSON.parse(match[0]);
        } catch (e2) {}
      }
    }

    // Normalize property names (startReading / endReading / nameEn / nameUr)
    const normalizedRows = (Array.isArray(parsedRows) ? parsedRows : []).map((row, idx) => {
      const start = Number(row.startReading || row.start || row.start_reading || row.from || 0);
      const end = Number(row.endReading || row.end || row.end_reading || row.to || 0);
      const nameUr = row.nameUr || row.name_ur || row.nameUrdu || row.name || '';
      const nameEn = row.nameEn || row.name_en || row.nameEnglish || nameUr || `Member ${idx + 1}`;
      const userCode = String(row.userCode || row.user_code || row.id || (idx + 1)).padStart(2, '0');

      return {
        userCode,
        nameEn,
        nameUr,
        startReading: start,
        endReading: end,
        notes: row.notes || row.date || ''
      };
    });

    const totalDuration = Date.now() - startTime;
    console.log(`[OCR COMPLETE SUCCESS] Model: ${usedModel} | Duration: ${totalDuration}ms | Rows Extracted: ${normalizedRows.length}`);

    return res.status(200).json({
      status: 'success',
      modelUsed: usedModel,
      rowsCount: normalizedRows.length,
      rows: normalizedRows,
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
