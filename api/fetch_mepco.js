export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Tubewell-Build-Sync', '2026-08-14-v4.0-scraperapi');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { refno, ref } = req.query;
  const rawRef = refno || ref || '29153110982900';
  const cleanRef = String(rawRef).replace(/\D/g, '');

  // ── ScraperAPI Key ──────────────────────────────────────────────
  const SCRAPER_API_KEY = '21698ab8ec7f367a849f7dcaffb73f79';
  // ────────────────────────────────────────────────────────────────

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

  const tryScraperAPI = async () => {
    const targetUrl = 'http://bill.pitc.com.pk/mepcobill';
    
    // Key fix: Omit session_number to avoid "Protected domains" block.
    // PITC validates the ASP.NET cookies and tokens, not the IP address matching exactly.
    // Use the direct IP to avoid DNS ENOTFOUND issues in Vercel regions, passing Host header.
    const scraperUrl = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&keep_headers=true&premium=true&country_code=pk&url=${encodeURIComponent(targetUrl)}`;

    // Step 1: GET the search page to grab __VIEWSTATE and session cookies
    const res1 = await fetch(scraperUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    const html1 = await res1.text();
    const rawSetCookie = res1.headers.get('set-cookie') || '';

    if (!html1.includes('__VIEWSTATE')) {
      throw new Error('PITC firewall blocked the request or the search page is currently down.');
    }

    const sessionId = (rawSetCookie.match(/ASP\.NET_SessionId=([a-z0-9]+)/i) || [])[1] || '';
    const rvtFromCookie = (rawSetCookie.match(/__RequestVerificationToken=([^;,\s]+)/) || [])[1] || '';

    const getHidden = (name) => {
      const m = html1.match(new RegExp(`name="${name}"[^>]*value="([^"]*)"`)) ||
                html1.match(new RegExp(`name="${name}"\\s+value="([^"]*)"`));
      return m ? m[1] : '';
    };

    const vs  = getHidden('__VIEWSTATE');
    const vsg = getHidden('__VIEWSTATEGENERATOR');
    const ev  = getHidden('__EVENTVALIDATION');
    const rvtForm = getHidden('__RequestVerificationToken') || rvtFromCookie;

    const cookieStr = [
      sessionId ? `ASP.NET_SessionId=${sessionId}` : '',
      rvtFromCookie ? `__RequestVerificationToken=${rvtFromCookie}` : ''
    ].filter(Boolean).join('; ');

    const formData = new URLSearchParams({
      __EVENTTARGET: '',
      __EVENTARGUMENT: '',
      __LASTFOCUS: '',
      __VIEWSTATE: vs,
      __VIEWSTATEGENERATOR: vsg,
      __EVENTVALIDATION: ev,
      __RequestVerificationToken: rvtForm,
      rbSearchByList: 'refno',
      searchTextBox: cleanRef,
      ruCodeTextBox: '',
      btnSearch: 'Search'
    });

    // Step 2: POST the search form to ScraperAPI
    const res2 = await fetch(scraperUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookieStr,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': targetUrl,
        'Origin': 'http://bill.pitc.com.pk',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      body: formData.toString()
    });

    if (!res2.ok) throw new Error(`PITC POST returned HTTP ${res2.status}`);

    const html2 = await res2.text();

    if (html2.includes('anti-forgery')) {
      throw new Error('PITC anti-forgery validation failed — token mismatch.');
    }

    return parseBillHtml(html2);
  };

  // ── Main Handler ──
  try {
    const parsed = await tryScraperAPI();

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
