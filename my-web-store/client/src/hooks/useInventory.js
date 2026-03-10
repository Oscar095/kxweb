import { useQuery } from '@tanstack/react-query';

export function useInventory(sku) {
  return useQuery({
    queryKey: ['inventory', sku],
    queryFn: async () => {
      if (!sku) return null;
      const r = await fetch(`/api/inventario/${encodeURIComponent(sku)}`, { cache: 'no-store' });
      if (!r.ok) return { estado: 'Error' };
      return r.json();
    },
    enabled: !!sku,
    staleTime: 1000 * 30,
  });
}

export async function checkInventory(sku) {
  if (!sku) return { estado: 'Sin SKU' };
  try {
    const r = await fetch(`/api/inventario/${encodeURIComponent(sku)}`, { cache: 'no-store' });
    if (!r.ok) return { estado: 'Error' };
    return await r.json();
  } catch {
    return { estado: 'Error' };
  }
}
