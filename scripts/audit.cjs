const fs = require('node:fs');
const path = require('node:path');
for (const d of fs.readdirSync('stitch_javafx_payment_tracker_dashboard')) {
 const f=path.join('stitch_javafx_payment_tracker_dashboard',d,'code.html');
 if(!fs.existsSync(f)) continue;
 const s=fs.readFileSync(f,'utf8');
 console.log('\nSCREEN',d,'bytes',s.length);
 console.log('TEXT',s.replace(/<script[\s\S]*?<\/script>/g,'').replace(/<style[\s\S]*?<\/style>/g,'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' '));
 console.log('SCRIPTS',[...s.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].filter(x=>!x[0].includes('tailwind-config')).map(x=>x[1]).join('\n'));
 console.log('LINKS',[...s.matchAll(/(?:src|href)="([^"]*)"/g)].map(x=>x[1]));
}
