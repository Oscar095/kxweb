import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../lib/api';

export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: () => apiGet('/api/products'),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => apiGet('/api/categories'),
  });
}
