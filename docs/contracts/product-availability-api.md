# Product availability

POST /api/products/availability

Request:
```json
{"items":[{"productId":"<UUID>","sizeId":"<SIZE option UUID>","toppingIds":[],"quantity":2}]}
```

Response (201): canOrder and items, each containing index, productId, sizeId, requestedQuantity, availableQuantity, canOrder.

availableQuantity is the maximum quantity for that line after allocating ingredients to all OTHER lines. These maxima cannot be added together. Size and topping ingredient amounts are summed before dividing stock. Missing recipes and disabled products have capacity zero. Invalid options return 400. Up to 100 lines, 99 units per line.

The endpoint reads stock; it does not reserve or decrement it. Order creation must recheck and deduct ingredients atomically. Cart state uses Context and localStorage, with client totals and quantity badge. Prices must be recalculated server-side when placing an order.

Catalog canOrder is based on whether any size has ingredient capacity. The legacy inventory response fields are retained for compatibility: quantity and availableStock are the largest individual size capacity, reserved is zero. Use the POST endpoint for the chosen size/toppings and the full cart.
