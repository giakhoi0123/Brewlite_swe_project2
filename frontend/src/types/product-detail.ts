export type ProductSizeOption = {
  id: string;
  code: "S" | "M" | "L";
  name: string;
  extraPrice: number;
  available: boolean;
};

export type ProductToppingOption = {
  id: string;
  name: string;
  extraPrice: number;
  available: boolean;
};

export type ProductDetail = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  price: number;
  sizes: ProductSizeOption[];
  toppings: ProductToppingOption[];
  defaultSizeId: string;
};
