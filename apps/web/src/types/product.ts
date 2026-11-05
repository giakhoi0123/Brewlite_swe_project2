export interface Product {
  id: string;
  name: string;
  basePrice: number;
  imageUrl: string;
  isAvailable: boolean;
  canOrder?: boolean;
  createdAt?: string;
}

export interface ProductOption {
  id: string;
  type: 'SIZE' | 'TOPPING';
  name: string;
  extraPrice: number;
}

export interface ProductInventory {
  quantity: number;
  reserved: number;
  availableStock: number;
}

export interface ProductDetail extends Product {
  options: ProductOption[];
  inventory: ProductInventory | null;
}

