/**
 * KosXpress — ES/EN language-switcher path mapping.
 * Shared by both header components so the ES<->EN route table lives in one place.
 */
function normalize(path) {
  let p = (path || '/').replace(/\.html$/i, '');
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p || '/';
}

const ES_TO_EN = {
  '/': '/en/',
  '/nosotros': '/en/company',
  '/about': '/en/about',
  '/products': '/en/products',
  '/personalizados': '/en/custom',
  '/canal-etico': '/en/ethics',
  '/contact': '/en/contact',
  '/cart': '/en/cart',
  '/checkout': '/en/checkout',
  '/confirmacion': '/en/confirmation',
  '/catalogo': '/en/catalogo',
  '/portafolio': '/en/portfolio',
  '/product': '/en/product',
  '/search': '/en/search',
};

const EN_TO_ES = Object.fromEntries(
  Object.entries(ES_TO_EN).map(([es, en]) => [normalize(en), es])
);

/**
 * Given the current pathname + search string, returns the equivalent URL
 * in the other language (preserving query params like ?id=/?q=).
 */
export function getLangSwitchUrl(pathname, search) {
  const norm = normalize(pathname);
  let target;
  if (Object.prototype.hasOwnProperty.call(EN_TO_ES, norm)) {
    target = EN_TO_ES[norm];
  } else if (Object.prototype.hasOwnProperty.call(ES_TO_EN, norm)) {
    target = ES_TO_EN[norm];
  } else {
    // Unmapped page (e.g. admin) — fall back to the other language's home.
    target = norm.startsWith('/en') ? '/' : '/en/';
  }
  return target + (search || '');
}
