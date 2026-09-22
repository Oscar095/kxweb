const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src');

const gtmHead = `<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-PP4MF2XC');</script>
<!-- End Google Tag Manager -->`;

const gtmBody = `<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-PP4MF2XC"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->`;

fs.readdirSync(dir).forEach(file => {
  if (file.endsWith('.html') && file !== 'admin.html') {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    let changed = false;

    // Add to <head> if not exists
    if (!content.includes('GTM-PP4MF2XC')) {
      // Find the position right after <head>
      const headRegex = /(<head[^>]*>)/i;
      if (headRegex.test(content)) {
        content = content.replace(headRegex, `$1\n${gtmHead}\n`);
        changed = true;
      }
      
      // Find the position right after <body>
      const bodyRegex = /(<body[^>]*>)/i;
      if (bodyRegex.test(content)) {
        content = content.replace(bodyRegex, `$1\n${gtmBody}\n`);
        changed = true;
      }

      if (changed) {
        fs.writeFileSync(filePath, content);
        console.log(`Added GTM to ${file}`);
      }
    } else {
      console.log(`GTM already exists in ${file}`);
    }
  }
});
