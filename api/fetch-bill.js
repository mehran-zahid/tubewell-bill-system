export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { refno, ref } = req.query;
  const rawRef = refno || ref;
  const cleanRef = String(rawRef || '').replace(/\D/g, '');

  if (!cleanRef || cleanRef.length < 14) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Invalid reference number' }));
  }

  const SCRAPER_API_KEY = '21698ab8ec7f367a849f7dcaffb73f79';
  const targetUrl = 'http://bill.pitc.com.pk/mepcobill';
  const scraperUrl = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&keep_headers=true&premium=true&country_code=pk&url=${encodeURIComponent(targetUrl)}`;

  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9'
    };

    // Step 1: GET the search page to grab __VIEWSTATE and session cookies
    const res1 = await fetch(scraperUrl, {
      method: 'GET',
      headers
    });

    const html1 = await res1.text();
    const rawSetCookie = res1.headers.get('set-cookie') || '';

    if (!html1.includes('__VIEWSTATE')) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Failed to access PITC server via ScraperAPI. The page may be down.' }));
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
        ...headers,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookieStr,
        'Referer': targetUrl,
        'Origin': 'http://bill.pitc.com.pk'
      },
      body: formData.toString()
    });

    let html2 = await res2.text();

    if (html2.includes('anti-forgery')) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'PITC anti-forgery validation failed — token mismatch.' }));
    }

    // Step 3: Fetch and inject meter snaps server-side to bypass CORS
    const refNoMatch = html2.match(/data-ref-no="([^"]+)"/);
    const billMonthMatch = html2.match(/data-bill-month="([^"]+)"/);
    const meterCountMatch = html2.match(/data-meter-count="([^"]+)"/);

    if (refNoMatch && billMonthMatch) {
      try {
        const snapTargetUrl = 'https://usersnap.pitc.com.pk/api/SnapsForDuplicateBill/ToDuplicate';
        const snapScraperUrl = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&keep_headers=true&premium=true&country_code=pk&url=${encodeURIComponent(snapTargetUrl)}`;

        const snapRes = await fetch(snapScraperUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            REF_NO: refNoMatch[1],
            BILL_MONTH: billMonthMatch[1]
          })
        });
        
        if (snapRes.ok) {
          const snapData = await snapRes.json();
          if (String(snapData.STATUS) === '1' && snapData.DATA && snapData.DATA.length > 0) {
            const data = snapData.DATA[0];
            let imagesHtml = '';
            const meterCount = parseInt(meterCountMatch ? meterCountMatch[1] : '0', 10);
            const useSnap5to8 = data.SNAP_5 && data.SNAP_5 !== 'null';
            
            for (let i = 0; i < meterCount; i++) {
              const snapKey = useSnap5to8 ? 'SNAP_' + (i + 5) : 'SNAP_' + (i + 1);
              const base64Img = data[snapKey];
              if (base64Img && base64Img !== 'null') {
                imagesHtml += `<div class="meter-snap-cell meter-snap-cell--zoomable" data-meter-snap-zoom-init="1" role="button" tabindex="0" aria-label="View meter snap enlarged"><img src="data:image/png;base64,${base64Img}" alt="Meter snap ${i + 1}" loading="lazy" /></div>`;
              }
            }
            
            if (imagesHtml) {
              // Replace the multiline opening tag (it spans multiple lines with data- attributes)
              html2 = html2.replace(/(<div class="meter-snaps-grid[\s\S]*?>)/, `$1${imagesHtml}`);
              // Remove the client-side loader script (handles ?v= query strings)
              html2 = html2.replace(/<script[^>]*src="[^"]*meter-snaps-loader\.js[^"]*"[^>]*><\/script>/gi, '');
              html2 = html2.replace(/<script[^>]*src="[^"]*meter-snap-zoom\.js[^"]*"[^>]*><\/script>/gi, '');
            }
          }
        } else {
          console.error('usersnap api failed with status', snapRes.status, await snapRes.text());
        }
      } catch (err) {
        console.error('Failed to fetch meter snaps in proxy:', err);
      }
    }
    
    res.setHeader('Content-Type', 'text/html');
    res.end(html2);
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Failed to complete request: ' + error.message }));
  }
}
