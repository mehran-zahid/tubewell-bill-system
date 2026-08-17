import React, { createContext, useContext, useState } from 'react';

const OCRContext = createContext();

export function OCRProvider({ children }) {
  const [images, setImages] = useState([]);
  const [extractedData, setExtractedData] = useState(null);
  const [scanError, setScanError] = useState(null);

  const clearOCRState = () => {
    setImages([]);
    setExtractedData(null);
    setScanError(null);
  };

  return (
    <OCRContext.Provider
      value={{
        images,
        setImages,
        extractedData,
        setExtractedData,
        scanError,
        setScanError,
        clearOCRState
      }}
    >
      {children}
    </OCRContext.Provider>
  );
}

export function useOCR() {
  return useContext(OCRContext);
}
