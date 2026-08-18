export async function translateToUrdu(text) {
  if (!text) return text;
  
  try {
    const encodedText = encodeURIComponent(text);
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ur&dt=t&q=${encodedText}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const json = await response.json();
    
    let translatedText = '';
    if (json && json[0]) {
      for (let i = 0; i < json[0].length; i++) {
        if (json[0][i][0]) {
          translatedText += json[0][i][0];
        }
      }
    }
    return translatedText || text;
  } catch (error) {
    console.error('Translation error:', error);
    return text; // fallback to original text on failure
  }
}
