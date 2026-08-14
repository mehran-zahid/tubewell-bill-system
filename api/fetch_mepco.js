export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Tubewell-Build-Sync', '2026-08-14-v2.0-scrapingbee');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { refno, ref } = req.query;
  const rawRef = refno || ref || '29153110982900';
  const cleanRef = String(rawRef).replace(/\D/g, '');

  const parseBillHtml = (htmlText) => {
    if (!htmlText || htmlText.includes('anti-forgery')) return null;

    // Extract amount matching old and new PITC layouts
    const amountMatch = htmlText.match(/payable-card-amount">\s*([\d,]+)\s*</i) || 
                        htmlText.match(/PAYABLE\s*WITHIN[\s\S]*?DUE\s*DATE[\s\S]*?payable-card-amount">\s*([\d,]+)/i) ||
                        htmlText.match(/DUE\s*DATE[\s\S]*?right-main-val[\s\S]*?>([\d,]+)</i) ||
                        htmlText.match(/DUE\s*DATE[^\d]*([\d,]+)/i) || 
                        htmlText.match(/PAYABLE\s*WITHIN\s*DUE\s*DATE[^\d]*([\d,]+)/i) ||
                        htmlText.match(/Net\s*Amount[^\d]*([\d,]+)/i) ||
                        htmlText.match(/Amount\s*Due[^\d]*([\d,]+)/i);

    // Extract due date matching old and new PITC layouts
    const dueDateMatch = htmlText.match(/right-main-val--due">([^<]+)</i) ||
                         htmlText.match(/DUE\s*DATE[\s\S]*?right-main-val--due">\s*(.+?)\s*</i) ||
                         htmlText.match(/(\d{2}[-\/\s]\w{3}[-\/\s]\d{2,4})/);

    // Extract consumer name matching old and new PITC layouts
    const nameMatch = htmlText.match(/NAME &amp; ADDRESS[\s\S]*?val-space--address">([^,<]+)/i) ||
                      htmlText.match(/NAME[:\s]*([A-Z\s]{4,30})/i);

    const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;
    
    if (amount > 0) {
      return {
        status: 'success',
        bill: {
          referenceNo: cleanRef,
          name: nameMatch ? nameMatch[1].trim() : 'MEPCO Consumer',
          totalAmount: amount,
          amountWithinDueDate: amount,
          dueDate: dueDateMatch ? dueDateMatch[1].trim() : '—'
        }
      };
    }
    return null;
  };

  try {
    const targetUrl = 'http://bill.pitc.com.pk/mepcobill';
    
    // Step 1: Fetch the PITC search page directly to extract session cookies and hidden tokens
    const res1 = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    });
    
    const html1 = await res1.text();
    
    // Parse session cookies
    let cookies = [];
    const setCookie = res1.headers.get('set-cookie');
    if (setCookie) {
      // Vercel/Node.js fetch joins multiple set-cookie headers with commas
      const parts = setCookie.split(',');
      for (const part of parts) {
        const match = part.match(/([^=]+)=([^;]+)/);
        if (match && !['path', 'expires', 'httponly'].includes(match[1].trim().toLowerCase())) {
          cookies.push(`${match[1].trim()}=${match[2].trim()}`);
        }
      }
    }
    const cookiesStr = cookies.join('; ');

    // Parse hidden ASP.NET form fields required for the POST request
    const getHidden = (name) => {
      const match = html1.match(new RegExp('name="' + name + '"[^>]*value="([^"]*)"'));
      return match ? match[1] : '';
    };
    
    const vs = getHidden('__VIEWSTATE');
    const vsg = getHidden('__VIEWSTATEGENERATOR');
    const ev = getHidden('__EVENTVALIDATION');
    const rvt = getHidden('__RequestVerificationToken');

    if (!vs) {
      throw new Error('PITC firewall blocked the request or the search page is currently down.');
    }

    // Step 2: Submit the reference number via POST request to retrieve the bill
    const formData = new URLSearchParams();
    formData.append('__EVENTTARGET', '');
    formData.append('__EVENTARGUMENT', '');
    formData.append('__LASTFOCUS', '');
    formData.append('__VIEWSTATE', vs);
    formData.append('__VIEWSTATEGENERATOR', vsg);
    formData.append('__EVENTVALIDATION', ev);
    formData.append('__RequestVerificationToken', rvt);
    formData.append('rbSearchByList', 'refno');
    formData.append('searchTextBox', cleanRef);
    formData.append('ruCodeTextBox', '');
    formData.append('btnSearch', 'Search');

    const res2 = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookiesStr,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      },
      body: formData.toString()
    });

    const html2 = await res2.text();
    
    // Step 3: Parse the final HTML to extract bill details
    const parsed = parseBillHtml(html2);
    if (parsed) {
      return res.status(200).json(parsed);
    }
    
    return res.status(404).json({
      status: 'error',
      error: 'Bill not found. Please ensure the reference number is correct.'
    });

  } catch (err) {
    return res.status(500).json({
      status: 'error',
      error: 'Automated fetch failed: ' + err.message
    });
  }
}
