# Products API contract — Task 5.1

Applies to FR-01 (menu/search), FR-02 (detail) and the read side of FR-07 (inventory).

## Endpoints

| Request | Success | Behavior |
|---|---|---|
| `GET /api/products` | `200 ProductResponse[]` | All products, including disabled/out-of-stock products, ordered by name ascending. |
| `GET /api/products?search=coffee` | `200 ProductResponse[]` | Case-insensitive name substring search. Whitespace is trimmed; omitted/empty search returns the full list. No match returns `[]`. |
| `GET /api/products/:id` | `200 ProductDetailResponse` | Existing product, including unavailable products; preserves options and inventory. |

The `search` query is an optional string. Invalid query values fail validation with `400`.
An invalid UUID path parameter returns `400`; a valid UUID with no product returns `404`.
Out-of-stock, fully reserved, disabled and missing-inventory products still return `200`.

## Common response fields

| Field | JSON type | Meaning |
|---|---|---|
| `id` | string | Product UUID. |
| `name` | string | Product name. |
| `basePrice` | number | Base price, converted from Prisma Decimal. |
| `imageUrl` | string | Product image URL. |
| `isAvailable` | boolean | Existing catalog sale flag from `Product.isAvailable`; preserved for compatibility. It does not indicate unreserved stock. |
| `canOrder` | boolean | New field: the sale flag is enabled AND at least one unit of available stock exists at read time. |
| `createdAt` | string | ISO-8601 timestamp. |

`availableStock = max(0, quantity - reserved)` when Inventory exists.
`canOrder = isAvailable && availableStock > 0`.
Missing Inventory is treated conservatively as no orderable stock: `canOrder: false`.
The same rules apply to list, search and detail. There is no second alias for `canOrder`.

| isAvailable | quantity | reserved | availableStock | canOrder |
|---|---:|---:|---:|---|
| true | 8 | 3 | 5 | true |
| true | 0 | 0 | 0 | false |
| true | 8 | 8 | 0 | false |
| false | 8 | 0 | 8 | false |
| true | missing Inventory | — | — | false |
| true | 3 | 8 | 0 | false |

The database enforces `0 <= reserved <= quantity`. The last row documents defensive
clamping for mocked/legacy invalid input and is covered by unit tests only.

These are snapshots, not a reservation or a guarantee for a requested quantity. GET requests
never write, reserve, deduct or release inventory. Checkout must revalidate sale status,
price and stock transactionally when creating an order. Changes to reservations are reflected
by subsequent requests; separate requests may observe different states if stock changes between them.

## Detail-only fields

`options` is an array (possibly empty), ordered by `type` ascending (`SIZE` before `TOPPING`),
then `extraPrice` ascending. Ordering between options tied on both fields is unspecified.
Each option contains `id: string`, `type: "SIZE" | "TOPPING"`, `name: string`, and
`extraPrice: number`. No option metadata is removed.

`inventory` is either `null` or an object containing `quantity: number`, `reserved: number`
and `availableStock: number` (integer counts). A missing Inventory row remains `null`, not
a fabricated object of zeros. List/search do not include `inventory` or `options`.

## Example: enabled but all physical stock is reserved

List/search response:

```json
[
  {
    "id": "d5100000-0000-4000-8000-000000000001",
    "name": "Task 5.1 Coffee",
    "basePrice": 25000,
    "imageUrl": "https://example.com/coffee.jpg",
    "isAvailable": true,
    "canOrder": false,
    "createdAt": "2026-11-03T00:00:00.000Z"
  }
]
```

Detail response for the same product:

```json
{
  "id": "d5100000-0000-4000-8000-000000000001",
  "name": "Task 5.1 Coffee",
  "basePrice": 25000,
  "imageUrl": "https://example.com/coffee.jpg",
  "isAvailable": true,
  "canOrder": false,
  "createdAt": "2026-11-03T00:00:00.000Z",
  "options": [
    {
      "id": "d5100000-0000-4000-8000-000000000002",
      "type": "SIZE",
      "name": "Regular",
      "extraPrice": 0
    }
  ],
  "inventory": { "quantity": 8, "reserved": 8, "availableStock": 0 }
}
```

Releasing one reservation (`reserved = 7`) makes `canOrder: true` on all endpoints and
`inventory.availableStock: 1` on detail. With no Inventory row, detail instead returns
`inventory: null` and `canOrder: false` while retaining the other fields.

## Compatibility and verification

This is an additive API change. Existing `isAvailable`, price, image, options and inventory
fields retain their behavior. Consumers should use `canOrder` for order eligibility and
stock messaging, rather than treating `isAvailable` as current stock. The current frontend
still consumes `isAvailable`; adopting `canOrder` in detail/cart UI belongs to its owner.
Order reservation/transaction logic belongs to the checkout owner and is outside this module.
No schema migration or shared seed modification is required.

Unit coverage: `apps/api/src/products/products.service.spec.ts` (all rows above across
list, search and detail; existing mapping/search/not-found tests retained).
PostgreSQL/HTTP coverage: `apps/api/test/products-availability-integration.e2e-spec.ts`
(unique per-test fixtures, five valid states, option order, reservation release, scoped cleanup),
plus the existing Products and menu-contract suites for response shapes, search, ordering,
UUID validation and not-found behavior.

Run using the dedicated database workflow in `apps/api/test/README.md` and
`docker-compose.test.yml`. Before migration or seed, verify the process `DATABASE_URL`
selects `brewlite_test` on `localhost:55432` (or an explicitly verified isolated test port
if that port is occupied); never use the development database or another project's service.
The integration guard remains enabled. At `apps/api`, run:

```powershell
npm.cmd run lint
npm.cmd test -- --runInBand
npm.cmd run test:integration
npm.cmd run build
```
