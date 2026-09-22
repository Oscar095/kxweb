/**
 * Applies the English name/description/images overlay (from dbo.product_translations,
 * joined server-side into name_en/description_en/images_en) on top of a product object,
 * falling back to the Spanish name/description/images when no translation exists yet.
 */
export function withEnglishCopy(p) {
  const images = (Array.isArray(p.images_en) && p.images_en.length) ? p.images_en : p.images;
  return {
    ...p,
    name: p.name_en || p.name,
    description: p.description_en || p.description,
    images,
    image: (Array.isArray(images) && images[0]) || p.image
  };
}

export function withEnglishCopyList(list) {
  return (list || []).map(withEnglishCopy);
}
