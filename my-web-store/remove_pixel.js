const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src');

fs.readdirSync(dir).forEach(file => {
  if (file.endsWith('.html') && file !== 'index.html') {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if it contains the pixel code
    if (content.includes('<!-- Meta Pixel Code -->')) {
      // Regex to remove the whole block including the trailing newlines/spaces
      content = content.replace(/[\s]*<!-- Meta Pixel Code -->[\s\S]*?<!-- End Meta Pixel Code -->/g, '');
      fs.writeFileSync(filePath, content);
      console.log(`Removed Pixel from ${file}`);
    }
  }
});
