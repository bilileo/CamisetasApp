export const KIDS_SIZES = [
  '2-4', '4-6', '6-8', '8-10', '10-12', '12-14', '14-16', '16-18'
] as const;

export const ADULT_SIZES = [
  'S', 'M', 'L', 'XL', '2XL', '3XL'
] as const;

export const SHIRT_SIZES = [...KIDS_SIZES, ...ADULT_SIZES] as const;
export type ShirtSize = typeof SHIRT_SIZES[number];

// Matriz de precios inmutable en el servidor
export const SHIRT_PRICES: Record<ShirtSize, number> = {
  '2-4': 150, '4-6': 150, '6-8': 150, '8-10': 150,
  '10-12': 150, '12-14': 150, '14-16': 150, '16-18': 150,
  'S': 150, 'M': 150, 'L': 150, 'XL': 150,
  '2XL': 170,
  '3XL': 250
};

export interface OrderItemInput {
  size: ShirtSize;
  quantity: number;
}