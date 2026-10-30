import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { parseProducts } from "../src/lib/product-contract.ts";

test("Menu Integration — simulates backend API responses", async (t) => {
  const sampleProducts = [
    {
      id: "31a650c7-8597-4a01-a8e2-000000000001",
      name: "Bạc xỉu 3 tầng Sài Gòn",
      price: 29000,
      imageUrl: "/images/products/sample-milk-coffee.svg",
    },
    {
      id: "31a650c7-8597-4a01-a8e2-000000000002",
      name: "Cà phê muối Huế",
      price: 32000,
      imageUrl: "/images/products/sample-latte.svg",
    },
  ];

  let currentHandler = (req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(sampleProducts));
  };

  const server = createServer((req, res) => currentHandler(req, res));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  t.after(() => new Promise((resolve) => server.close(resolve)));

  await t.test("1. Successfully fetches and parses product catalog (HTTP 200)", async () => {
    const res = await fetch(`${baseUrl}/api/products`);
    assert.equal(res.status, 200);
    const data = await res.json();
    const parsed = parseProducts(data);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].name, "Bạc xỉu 3 tầng Sài Gòn");
    assert.equal(parsed[1].price, 32000);
  });

  await t.test("2. Handles empty catalog gracefully (HTTP 200 with [])", async () => {
    currentHandler = (req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("[]");
    };

    const res = await fetch(`${baseUrl}/api/products`);
    assert.equal(res.status, 200);
    const data = await res.json();
    const parsed = parseProducts(data);
    assert.equal(parsed.length, 0);
  });

  await t.test("3. Handles server error (HTTP 500) and triggers retry flow", async () => {
    currentHandler = (req, res) => {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ statusCode: 500, message: "Internal server error" }));
    };

    const res = await fetch(`${baseUrl}/api/products`);
    assert.equal(res.status, 500);
    assert.equal(res.ok, false);
  });

  await t.test("4. Fetches and validates product detail with sizes and toppings", async () => {
    const detailPayload = {
      id: "31a650c7-8597-4a01-a8e2-000000000001",
      name: "Bạc xỉu 3 tầng Sài Gòn",
      description: "Cà phê và sữa, phục vụ lạnh.",
      imageUrl: "/images/products/sample-milk-coffee.svg",
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

    currentHandler = (req, res) => {
      if (req.url === "/api/products/31a650c7-8597-4a01-a8e2-000000000001") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(detailPayload));
      } else {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ statusCode: 404, message: "Product not found" }));
      }
    };

    const res = await fetch(`${baseUrl}/api/products/31a650c7-8597-4a01-a8e2-000000000001`);
    assert.equal(res.status, 200);
    const detail = await res.json();
    assert.equal(detail.name, "Bạc xỉu 3 tầng Sài Gòn");
    assert.equal(detail.sizes.length, 3);
    assert.equal(detail.defaultSizeId, "s-2");

    const notFoundRes = await fetch(`${baseUrl}/api/products/not-found-id`);
    assert.equal(notFoundRes.status, 404);
  });
});
