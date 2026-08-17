/**
 * Extracts data from an array of base64 image strings using the secure Vercel backend.
 * @param {string[]} base64ImagesArray - Array of base64 strings of the images.
 * @param {Function} [onProgress] - Optional callback function reporting progress `(currentImageIndex, totalImages)`.
 * @returns {Promise<Object[]>} - The extracted JSON data containing date, memberId, startReading, and endReading.
 */
export const extractRegisterData = async (base64ImagesArray, onProgress) => {
  try {
    const allExtractedData = [];
    const totalImages = base64ImagesArray.length;

    for (let i = 0; i < totalImages; i++) {
      if (onProgress) {
        onProgress(i + 1, totalImages);
      }
      
      const base64Image = base64ImagesArray[i];

      let imageSuccess = false;
      let lastError = null;

      try {
        console.log(`Sending image ${i + 1} to secure Vercel backend...`);
        const response = await fetch('/api/ocr', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ base64Image })
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.warn(`Backend OCR Error for image ${i + 1}:`, errorData);
          lastError = new Error(errorData.error || 'Failed to communicate with backend');
          throw lastError;
        }

        const data = await response.json();
        console.log(`Successfully extracted data for image ${i + 1} via backend!`);
        
        if (Array.isArray(data)) {
          allExtractedData.push(...data);
          imageSuccess = true;
        } else {
          throw new Error("Invalid response format from backend");
        }

      } catch (err) {
        console.warn(`Exception caught for image ${i + 1}:`, err);
        throw err;
      }

      if (!imageSuccess) {
        console.error(`Backend failed for image ${i + 1}.`);
        throw lastError || new Error(`Backend OCR failed for image ${i + 1}.`);
      }
    } // End of images loop

    return allExtractedData;

  } catch (error) {
    console.error('Error in extractRegisterData:', error);
    throw error;
  }
};
