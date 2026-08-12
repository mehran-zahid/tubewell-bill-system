export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Tubewell-Build-Sync', '2026-08-12-v1.1.0');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { refno, ref } = req.query;
  const rawRef = refno || ref || '29153110982900';
  const cleanRef = String(rawRef).replace(/\D/g, '');

  const parseBillHtml = (htmlText) => {
    if (!htmlText || htmlText.includes('anti-forgery')) return null;

    const amountMatch = htmlText.match(/DUE\s*DATE[^\d]*([\d,]+)/i) || 
                        htmlText.match(/PAYABLE\s*WITHIN\s*DUE\s*DATE[^\d]*([\d,]+)/i) ||
                        htmlText.match(/Net\s*Amount[^\d]*([\d,]+)/i) ||
                        htmlText.match(/Rs\.?\s*([\d,]{4,})/i) ||
                        htmlText.match(/Amount\s*Due[^\d]*([\d,]+)/i);

    const dueDateMatch = htmlText.match(/DUE\s*DATE[:\s]*(\d{1,2}[-\/]\w{3}[-\/]\d{2,4})/i) ||
                         htmlText.match(/(\d{2}[-\/]\d{2}[-\/]\d{4})/);

    const nameMatch = htmlText.match(/NAME[:\s]*([A-Z\s]{4,30})/i);

    const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;
    if (amount > 0) {
      return {
        status: 'success',
        bill: {
          referenceNo: cleanRef,
          name: nameMatch ? nameMatch[1].trim() : 'MEPCO Consumer',
          totalAmount: amount,
          amountWithinDueDate: amount,
          dueDate: dueDateMatch ? dueDateMatch[1] : '—'
        }
      };
    }
    return null;
  };

  const targetUrls = [
    `http://ebill.pitc.com.pk/mepcobill/general?refno=${cleanRef}&ru=R`,
    `http://bill.pitc.com.pk/mepcobill/general?refno=${cleanRef}&ru=R`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(`http://ebill.pitc.com.pk/mepcobill/general?refno=${cleanRef}&ru=R`)}`,
    `https://api.allorigins.win/get?url=${encodeURIComponent(`http://ebill.pitc.com.pk/mepcobill/general?refno=${cleanRef}&ru=R`)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(`http://ebill.pitc.com.pk/mepcobill/general?refno=${cleanRef}&ru=R`)}`
  ];

  const fetchWithTimeout = async (url) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      let htmlText = '';
      if (url.includes('allorigins') && url.includes('/get?')) {
        const json = await response.json();
        htmlText = json.contents || '';
      } else {
        htmlText = await response.text();
      }

      const parsed = parseBillHtml(htmlText);
      if (parsed) return parsed;
      throw new Error('Parse error');
    } catch (e) {
      clearTimeout(timeoutId);
      throw e;
    }
  };

  try {
    const result = await Promise.any(targetUrls.map(url => fetchWithTimeout(url)));
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      error: 'PITC MEPCO automated fetch failed across all DISCO nodes.'
    });
  }
}
