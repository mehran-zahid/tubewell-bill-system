const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const FALLBACK_MODELS = [
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash'
];

/**
 * Extracts data from an array of base64 image strings using the Gemini API.
 * @param {string[]} base64ImagesArray - Array of base64 strings of the images.
 * @returns {Promise<Object>} - The extracted JSON data containing date, memberId, startReading, and endReading.
 */
export const extractRegisterData = async (base64ImagesArray) => {
  try {
    const currentYear = new Date().getFullYear();
    const prompt = `You are an OCR and data extraction assistant. 
Extract the following information from the provided image(s) of a physical register page:
1. Date: Look for the date written on the page. Dates here are usually written in D-M-YY or DD-MM-YY format (e.g., '7-8-26' means August 7, 2026). People often don't write leading zeros. If the year is missing, assume it is ${currentYear}. You MUST convert whatever is written strictly into the YYYY-MM-DD format (e.g., '2026-08-07'). If a row has no date next to it, copy the exact date from the row directly above it. Every single row must have a date. NOTE: The rows are written in chronological order from top to bottom. Use this context to correctly read messy handwriting (e.g., don't jump backward in months).
2. Member ID (a handwritten number between 1 and 24 on the far left. Note: it might have a leading zero like '01').
3. Start Reading (a numerical value).
4. End Reading (a numerical value).

The images contain MULTIPLE rows of data. You must extract every single row you can read across all provided images.

Respond ONLY with valid JSON. Do not use Markdown formatting or code blocks. The JSON should match exactly this format (an array of objects):
[
  {
    "date": "YYYY-MM-DD",
    "memberId": "extracted ID as string",
    "startReading": number,
    "endReading": number
  }
]`;

    const parts = [{ text: prompt }];

    base64ImagesArray.forEach(base64Image => {
      const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
      const mimeType = base64Image.includes(',') ? base64Image.split(';')[0].split(':')[1] : 'image/jpeg';
      parts.push({
        inline_data: {
          mime_type: mimeType,
          data: base64Data
        }
      });
    });

    const requestBody = {
      contents: [
        {
          parts: parts
        }
      ],
      generationConfig: {
        temperature: 0.1 // Keep it low for more deterministic OCR results
      }
    };

    let lastError = null;

    // Loop through fallback models
    for (const model of FALLBACK_MODELS) {
      try {
        console.log(`Attempting OCR with model: ${model}`);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.warn(`Gemini API Error with ${model}:`, errorData);
          lastError = new Error(errorData.error?.message || `Failed to communicate with ${model}`);
          continue; // Move to the next model in the array
        }

        const data = await response.json();
        
        // The response is usually deeply nested
        let textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!textResponse) {
          throw new Error(`No text returned from ${model}`);
        }

        // Clean up potential markdown formatting if Gemini ignored our instruction
        textResponse = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();

        const parsedJson = JSON.parse(textResponse);
        console.log(`Successfully extracted data using ${model}!`);
        return parsedJson;

      } catch (err) {
        console.warn(`Exception caught while using ${model}:`, err);
        lastError = err;
        continue; // Move to the next model in the array
      }
    }

    // If we reach here, all models in the fallback array failed
    console.error('All fallback models failed.');
    throw lastError || new Error('All OCR models failed.');

  } catch (error) {
    console.error('Error in extractRegisterData:', error);
    throw error;
  }
};
