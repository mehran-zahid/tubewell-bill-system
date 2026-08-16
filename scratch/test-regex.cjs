const html = require('fs').readFileSync('scratch/bill.html','utf8'); 
const match = html.match(/data-bill-month="([^"]+)"/); 
console.log('bill-month:', match ? match[1] : 'not found');
const ym = html.match(/data-bill-ym="([^"]+)"/); 
console.log('bill-ym:', ym ? ym[1] : 'not found');
