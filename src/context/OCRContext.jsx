import React, { createContext, useContext, useState } from 'react';

const OCRContext = createContext();

export function OCRProvider({ children }) {
  const [images, setImages] = useState([]);
  const [extractedData, setExtractedData] = useState(null);
  const [scanError, setScanError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
  const [scanningImageIndex, setScanningImageIndex] = useState(null);

  const clearOCRState = () => {
    setImages([]);
    setExtractedData(null);
    setScanError(null);
    setIsProcessing(false);
    setScanProgress({ current: 0, total: 0 });
    setScanningImageIndex(null);
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
        isProcessing,
        setIsProcessing,
        scanProgress,
        setScanProgress,
        scanningImageIndex,
        setScanningImageIndex,
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
