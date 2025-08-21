const productList = require('./components/product-list');

document.addEventListener('DOMContentLoaded', () => {
    const appContainer = document.getElementById('app');
    appContainer.innerHTML = '<h1>Welcome to My Web Store</h1>';
    
    // Initialize the product list
    productList.renderProducts(appContainer);
});