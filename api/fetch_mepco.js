export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { refno, ref } = req.query;
  const rawRef = refno || ref || '';
  if (!rawRef) {
    return res.status(400).json({ status: 'error', error: 'Missing reference number (refno)' });
  }

  const cleanRef = String(rawRef).replace(/\D/g, '');

  const candidateUrls = [
    `http://bill.pitc.com.pk/mepcobill/general?refno=${cleanRef}&ru=R`,
    `http://ebill.pitc.com.pk/mepcobill/general?refno=${cleanRef}&ru=R`,
    `https://api.allorigins.win/get?url=${encodeURIComponent(`http://bill.pitc.com.pk/mepcobill/general?refno=${cleanRef}&ru=R`)}`
  ];

  const fetchOne = async (url) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
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
      if (url.includes('allorigins')) {
        const json = await response.json();
        htmlText = json.contents || '';
      } else {
        htmlText = await response.text();
      }

      if (htmlText.length > 300) {
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
      }
      throw new Error('Could not parse valid bill amount');
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  };

  try {
    // Try candidates in parallel or race first successful result
    const result = await Promise.any(candidateUrls.map(url => fetchOne(url)));
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      error: 'Could not fetch bill from MEPCO PITC servers.'
    });
  }
}
