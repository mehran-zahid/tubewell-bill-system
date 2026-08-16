const fs = require('fs');
let html = fs.readFileSync('scratch/bill.html', 'utf8');

const imagesHtml = '<div class="meter-snap-cell"><img src="data:image/png;base64,ABC" /></div><div class="meter-snap-cell"><img src="data:image/png;base64,XYZ" /></div>';

// Use dotAll/multiline regex to match opening tag spanning multiple lines
html = html.replace(/(<div class="meter-snaps-grid[\s\S]*?>)/, `$1${imagesHtml}`);

// Remove scripts
html = html.replace(/<script[^>]*src="[^"]*meter-snaps-loader\.js[^"]*"[^>]*><\/script>/gi, '');
html = html.replace(/<script[^>]*src="[^"]*meter-snap-zoom\.js[^"]*"[^>]*><\/script>/gi, '');

console.log('Images injected?', html.includes('data:image/png;base64,ABC'));
console.log('meter-snaps-loader removed?', !html.includes('meter-snaps-loader'));
console.log('meter-snap-zoom removed?', !html.includes('meter-snap-zoom'));
