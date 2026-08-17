const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`;

fetch(url)
  .then(res => res.json())
  .then(data => {
    console.log(data.models.map(m => m.name).join('\n'));
  })
  .catch(console.error);
