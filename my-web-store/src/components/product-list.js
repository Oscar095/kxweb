import React from 'react';

const ProductList = ({ products }) => {
    return (
        <div className="product-list">
            {products.map(product => (
                <div key={product.id} className="product-item">
                    <h2>{product.name}</h2>
                    <p>{product.description}</p>
                    <span>${product.price}</span>
                    <button>Add to Cart</button>
                </div>
            ))}
        </div>
    );
};

export default ProductList;