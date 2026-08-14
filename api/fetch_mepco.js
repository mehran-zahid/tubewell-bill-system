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
    const apiKey = '319T0AA6I3W24GZ52PE7RHRJ81L2VQ581OHI004UCCOQ12RAD9P5LFAZR3FALVVZ882IU5OH9KPEU3T3';
    const targetUrl = 'http://bill.pitc.com.pk/mepcobill';
    
    // Step 1: Fetch the PITC search page via ScrapingBee to extract session cookies and hidden tokens
    const getUrl = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(targetUrl)}&render_js=false&premium_proxy=true`;
    
    const res1 = await fetch(getUrl);
    const html1 = await res1.text();
    
    // Parse session cookies from the ScrapingBee headers
    const spbSetCookie = res1.headers.get('spb-set-cookie');
    let sessionId = '';
    let rvtCookie = '';
    
    if (spbSetCookie) {
      const parts = spbSetCookie.split(',');
      for (const part of parts) {
        if (part.includes('ASP.NET_SessionId=')) {
          const match = part.match(/ASP\.NET_SessionId=([^;]+)/);
          if (match) sessionId = match[1];
        }
        if (part.includes('__RequestVerificationToken=')) {
          const match = part.match(/__RequestVerificationToken=([^;]+)/);
          if (match) rvtCookie = match[1];
        }
      }
    }

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
    const cookiesStr = `ASP.NET_SessionId=${sessionId};__RequestVerificationToken=${rvtCookie}`;

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
    formData.append('btnSearch', 'Search');

    const postUrl = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(targetUrl)}&render_js=false&premium_proxy=true&forward_headers=true&cookies=${encodeURIComponent(cookiesStr)}`;
    
    const res2 = await fetch(postUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
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
