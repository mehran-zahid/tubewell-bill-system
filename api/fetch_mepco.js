export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Tubewell-Build-Sync', '2026-08-14-v3.0-browserless');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { refno, ref } = req.query;
  const rawRef = refno || ref || '29153110982900';
  const cleanRef = String(rawRef).replace(/\D/g, '');

  // ── ScraperAPI Key ──────────────────────────────────────────────
  const SCRAPER_API_KEY = '21698ab8ec7f367a849f7dcaffb73f79';
  // ───────────────────────────────────────────────────────────────────────

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

  // ── Strategy: ScraperAPI 2-Step Fetch ──
  // ASP.NET anti-CSRF requires a 2-step process to get hidden tokens.
  // We use ScraperAPI with a session_number so that the same IP and cookies
  // are maintained across both the GET and POST requests.
  const tryScraperAPI = async () => {
    const targetUrl = 'http://bill.pitc.com.pk/mepcobill';
    // premium=true forces Residential IPs which bypasses PITC's datacenter firewall!
    // country_code=pk ensures it uses Pakistani IPs which PITC trusts!
    const scraperUrl = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(targetUrl)}&session_number=${cleanRef}&keep_headers=true&premium=true&country_code=pk`;

    // Step 1: GET to retrieve hidden tokens
    const res1 = await fetch(scraperUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    const html1 = await res1.text();
    
    // Fallback manual cookie handling in case ScraperAPI session cookies drop
    const rawSetCookie = res1.headers.get('set-cookie') || '';
    const sessionMatch = rawSetCookie.match(/ASP\.NET_SessionId=([a-z0-9]+)/i);
    const sessionId = sessionMatch ? sessionMatch[1] : '';
    const rvtCookieMatch = rawSetCookie.match(/__RequestVerificationToken=([^;,\s]+)/);
    const rvtFromCookie = rvtCookieMatch ? rvtCookieMatch[1] : '';

    const getHidden = (name) => {
      const m = html1.match(new RegExp(`name="${name}"[^>]*value="([^"]*)"`)) ||
                html1.match(new RegExp(`name="${name}"\\s+value="([^"]*)"`));
      return m ? m[1] : '';
    };

    const vs  = getHidden('__VIEWSTATE');
    const vsg = getHidden('__VIEWSTATEGENERATOR');
    const ev  = getHidden('__EVENTVALIDATION');
    const rvtForm = getHidden('__RequestVerificationToken') || rvtFromCookie;

    if (!vs) throw new Error('PITC blocked request — no VIEWSTATE found.');

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

    // Step 2: POST the form data back using the SAME ScraperAPI session
    const res2 = await fetch(scraperUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookieStr,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': targetUrl,
        'Origin': 'http://bill.pitc.com.pk'
      },
      body: formData.toString()
    });

    if (!res2.ok) throw new Error(`PITC POST returned HTTP ${res2.status}`);
    const html2 = await res2.text();
    if (html2.includes('anti-forgery')) throw new Error('PITC anti-forgery validation failed.');
    return parseBillHtml(html2);
  };

  const tryDirectFetch = async () => {
    const targetUrl = 'http://bill.pitc.com.pk/mepcobill';

    const res1 = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    const html1 = await res1.text();
    const rawSetCookie = res1.headers.get('set-cookie') || '';

    const sessionMatch = rawSetCookie.match(/ASP\.NET_SessionId=([a-z0-9]+)/i);
    const sessionId = sessionMatch ? sessionMatch[1] : '';

    const rvtCookieMatch = rawSetCookie.match(/__RequestVerificationToken=([^;,\s]+)/);
    const rvtFromCookie = rvtCookieMatch ? rvtCookieMatch[1] : '';

    const getHidden = (name) => {
      const m = html1.match(new RegExp(`name="${name}"[^>]*value="([^"]*)"`)) ||
                html1.match(new RegExp(`name="${name}"\\s+value="([^"]*)"`));
      return m ? m[1] : '';
    };

    const vs  = getHidden('__VIEWSTATE');
    const vsg = getHidden('__VIEWSTATEGENERATOR');
    const ev  = getHidden('__EVENTVALIDATION');
    const rvtForm = getHidden('__RequestVerificationToken') || rvtFromCookie;

    if (!vs) {
      throw new Error('PITC firewall blocked the request or the search page is currently down.');
    }

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

    const res2 = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookieStr,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': targetUrl,
        'Origin': 'http://bill.pitc.com.pk',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
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
    let parsed = null;

    try {
      parsed = await tryScraperAPI();
    } catch (err) {
      console.error('[fetch_mepco] ScraperAPI failed:', err.message);
      // Optional fallback to pure fetch
      parsed = await tryDirectFetch();
    }

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
