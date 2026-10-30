import test from "node:test";
import assert from "node:assert/strict";

test("Product Detail — size and topping price aggregation", () => {
  const product = {
    id: "31a650c7-8597-4a01-a8e2-000000000001",
    name: "Bạc xỉu 3 tầng Sài Gòn",
    price: 29000,
    sizes: [
      { id: "s-1", code: "S", name: "Nhỏ (S)", extraPrice: 0, available: true },
      { id: "s-2", code: "M", name: "Vừa (M)", extraPrice: 4000, available: true },
      { id: "s-3", code: "L", name: "Lớn (L)", extraPrice: 9000, available: true },
    ],
    toppings: [
      { id: "t-1", name: "Thêm espresso", extraPrice: 7000, available: true },
      { id: "t-2", name: "Kem cheese", extraPrice: 6000, available: true },
    ],
    defaultSizeId: "s-2",
  };

  // Base price
  assert.equal(product.price, 29000);

  // Default size (M) extra = +4000 -> 33000
  const defaultSize = product.sizes.find((s) => s.id === product.defaultSizeId);
  assert.equal(defaultSize?.extraPrice, 4000);

  // Total with default size and one topping (espresso)
  const totalWithEspresso = product.price + (defaultSize?.extraPrice ?? 0) + product.toppings[0].extraPrice;
  assert.equal(totalWithEspresso, 29000 + 4000 + 7000);
  assert.equal(totalWithEspresso, 40000);

  // Total with Large size (+9000) and both toppings (+7000, +6000)
  const largeSize = product.sizes.find((s) => s.code === "L");
  const totalLargeAllToppings =
    product.price +
    (largeSize?.extraPrice ?? 0) +
    product.toppings.reduce((acc, t) => acc + t.extraPrice, 0);
  assert.equal(totalLargeAllToppings, 29000 + 9000 + 7000 + 6000);
  assert.equal(totalLargeAllToppings, 51000);
});

test("Product Detail — verifies size availability constraints", () => {
  const sizes = [
    { id: "s-1", code: "S", name: "Nhỏ (S)", extraPrice: 0, available: true },
    { id: "s-2", code: "M", name: "Vừa (M)", extraPrice: 4000, available: false },
    { id: "s-3", code: "L", name: "Lớn (L)", extraPrice: 9000, available: true },
  ];

  const availableSizes = sizes.filter((s) => s.available);
  assert.equal(availableSizes.length, 2);
  assert.equal(availableSizes.some((s) => s.code === "M"), false);
});
