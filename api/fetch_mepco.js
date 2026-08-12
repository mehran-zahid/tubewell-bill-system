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

  // Strategy 1: Session Cookie Handshake with PITC
  try {
    const initRes = await fetch('http://bill.pitc.com.pk/mepcobill', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      }
    });

    const setCookies = initRes.headers.getSetCookie ? initRes.headers.getSetCookie().join('; ') : (initRes.headers.get('set-cookie') || '');

    const billRes = await fetch(`http://bill.pitc.com.pk/mepcobill/general?refno=${cleanRef}&ru=R`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Cookie': setCookies
      }
    });

    if (billRes.ok) {
      const html = await billRes.text();
      const parsed = parseBillHtml(html);
      if (parsed) return res.status(200).json(parsed);
    }
  } catch (e) {}

  // Strategy 2: Direct DISCO Candidates via Codetabs and AllOrigins
  const targetUrl = `http://bill.pitc.com.pk/mepcobill/general?refno=${cleanRef}&ru=R`;
  const candidateUrls = [
    targetUrl,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`,
    `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`
  ];

  for (const url of candidateUrls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const resObj = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        }
      });
      clearTimeout(timeoutId);

      if (resObj.ok) {
        let htmlText = '';
        if (url.includes('allorigins')) {
          const json = await resObj.json();
          htmlText = json.contents || '';
        } else {
          htmlText = await resObj.text();
        }

        const parsed = parseBillHtml(htmlText);
        if (parsed) return res.status(200).json(parsed);
      }
    } catch (e) {}
  }

  return res.status(500).json({
    status: 'error',
    error: 'Could not fetch bill from MEPCO PITC servers.'
  });
}
