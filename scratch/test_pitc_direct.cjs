const refno = '29153110982900';

async function testFetch() {
  const targetUrl = 'http://bill.pitc.com.pk/mepcobill';
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9'
  };

  const res1 = await fetch(targetUrl, { headers });
  const html1 = await res1.text();
  
  const rawSetCookie = res1.headers.get('set-cookie') || '';
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

  console.log('Cookies:', cookieStr);

  const formData = new URLSearchParams({
    __EVENTTARGET: '',
    __EVENTARGUMENT: '',
    __LASTFOCUS: '',
    __VIEWSTATE: vs,
    __VIEWSTATEGENERATOR: vsg,
    __EVENTVALIDATION: ev,
    __RequestVerificationToken: rvtForm,
    rbSearchByList: 'refno',
    searchTextBox: refno,
    ruCodeTextBox: '',
    btnSearch: 'Search'
  });

  const res2 = await fetch(targetUrl, {
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

  console.log('Status:', res2.status);
  const html2 = await res2.text();
  console.log('Length:', html2.length);
  
  const fs = require('fs');
  fs.writeFileSync('scratch/bill.html', html2);
  console.log('Saved to scratch/bill.html');
}

testFetch();
