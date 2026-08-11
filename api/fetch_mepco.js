export default async function handler(req, res) {
  // Enable CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { refno } = req.query;
  if (!refno) {
    return res.status(400).json({ error: 'Missing refno parameter' });
  }

  const cleanRef = refno.replace(/\D/g, '');

  try {
    const targetUrl = `https://bill.pitc.com.pk/mepcobill/general?refno=${cleanRef}&ru=R`;
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    const htmlText = await response.text();

    const amountMatch = htmlText.match(/DUE\s*DATE[^\d]*([\d,]+)/i) || 
                        htmlText.match(/PAYABLE\s*WITHIN\s*DUE\s*DATE[^\d]*([\d,]+)/i) ||
                        htmlText.match(/Net\s*Amount[^\d]*([\d,]+)/i) ||
                        htmlText.match(/Rs\.?\s*([\d,]{4,})/i);

    const dueDateMatch = htmlText.match(/DUE\s*DATE[:\s]*(\d{1,2}[-\/]\w{3}[-\/]\d{2,4})/i) ||
                         htmlText.match(/(\d{2}[-\/]\d{2}[-\/]\d{4})/);

    const nameMatch = htmlText.match(/NAME[:\s]*([A-Z\s]{4,30})/i);

    const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;

    return res.status(200).json({
      status: 'success',
      bill: {
        referenceNo: cleanRef,
        name: nameMatch ? nameMatch[1].trim() : 'MEPCO Consumer',
        totalAmount: amount,
        amountWithinDueDate: amount,
        dueDate: dueDateMatch ? dueDateMatch[1] : '—'
      }
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', error: err.message });
  }
}
