"use client";

import { useState } from "react";
import { ProductCatalog } from "./product-catalog";
import { ProductDetailModal } from "./product-detail-modal";
import type { ProductDetailsAdapter } from "@/types/product-details-adapter";

/**
 * Client Container integrating Trí's Products API with Đông's Menu UI
 * Implements the ProductDetailsAdapter pattern documented in docs/tri-menu-details-handoff.md
 * Integrator: Phạm Gia Khôi (Task 4)
 */
export function MenuCatalogContainer() {
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const adapter: ProductDetailsAdapter = {
    status: "ready",
    openProductDetails: (productId: string) => {
      setSelectedProductId(productId);
    },
  };

  return (
    <>
      <ProductCatalog detailsAdapter={adapter} />
      {selectedProductId && (
        <ProductDetailModal
          productId={selectedProductId}
          onClose={() => setSelectedProductId(null)}
        />
      )}
    </>
  );
}
