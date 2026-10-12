const fs = require('fs');
const files = ['public/index.html', 'public/download.html', 'public/launcher.html', 'public/overlay_gallery.html', 'public/overlay_gifts.html', 'public/overlay_gift_legend.html', 'public/overlay_goals.html', 'public/overlay_last.html', 'public/overlay_top.html'];

for (const file of files) {
    if (!fs.existsSync(file)) continue;
    
    // Read the corrupted UTF-8 string
    const corruptedString = fs.readFileSync(file, 'utf8');
    
    // Convert the corrupted string to a buffer using latin1 (Windows-1252 approximation)
    // This gives us the original UTF-8 bytes back!
    const originalBytes = Buffer.from(corruptedString, 'latin1');
    
    // Write the bytes back to the file
    fs.writeFileSync(file, originalBytes);
    console.log(`Fixed encoding in ${file}`);
}
