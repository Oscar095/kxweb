const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src');
const oldId = '554057515152837';
const newId = '385489602659855';

fs.readdirSync(dir).forEach(file => {
  if (file.endsWith('.html') && file !== 'admin.html') {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    if (content.includes(oldId)) {
      content = content.replaceAll(oldId, newId);
      fs.writeFileSync(filePath, content);
      console.log(`Updated Pixel ID in ${file}`);
    } else {
      console.log(`Pixel ID not found in ${file}`);
    }
  }
});
