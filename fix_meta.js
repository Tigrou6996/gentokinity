const fs = require('fs');
const path = require('path');
const files = fs.readdirSync('public').filter(f => f.endsWith('.html')).map(f => path.join('public', f));
files.forEach(f => {
    let c = fs.readFileSync(f, 'utf8');
    if (!c.includes('no-referrer')) {
        c = c.replace('</head>', '    <meta name="referrer" content="no-referrer">\n</head>');
        fs.writeFileSync(f, c);
        console.log(`Updated ${f}`);
    }
});
console.log('Done');
