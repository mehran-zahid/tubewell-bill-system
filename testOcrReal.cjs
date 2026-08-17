const fs = require('fs');

const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const prompt = `You are an OCR and data extraction assistant. 
Extract the following information from the provided image of a physical register page:
1. Date (If a date is blank or not mentioned for a row, assume it is the SAME as the date from the previous/upper row. Every row must have a date).
2. Member ID (a handwritten number between 1 and 24 on the far left. Note: it might have a leading zero like '01').
3. Start Reading (a numerical value).
4. End Reading (a numerical value).

The image contains MULTIPLE rows of data. You must extract every single row you can read.
Respond ONLY with valid JSON. Do not use Markdown formatting or code blocks. The JSON should match exactly this format (an array of objects):
[
  {
    "date": "YYYY-MM-DD or whatever format is written",
    "memberId": "extracted ID as string",
    "startReading": number,
    "endReading": number
  }
]`;

async function testOCR(imagePath) {
  try {
    const fileBuffer = fs.readFileSync(imagePath);
    const base64Data = fileBuffer.toString('base64');
    
    const requestBody = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: base64Data
              }
            }
          ]
        }
      ]
    };

    console.log('Sending request to Gemini...');
    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    let textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!textResponse) {
      throw new Error('No text returned from Gemini');
    }
    
    console.log('Raw text response:\\n', textResponse);
    textResponse = textResponse.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
    console.log('\\nParsed JSON:', JSON.parse(textResponse));
    
  } catch (err) {
    console.error('Error during OCR test:', err);
  }
}

// Ensure the path correctly points to the image
testOCR('C:\\\\Users\\\\abc\\\\.gemini\\\\antigravity-ide\\\\brain\\\\68f82442-7834-40dc-9e2b-39b171c34d17\\\\.user_uploaded\\\\media_1786900619157.jpg');
