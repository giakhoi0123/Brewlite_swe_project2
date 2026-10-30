import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MenuCatalog } from '../MenuCatalog';
import { Product } from '../../types/product';

describe('MenuCatalog Component', () => {
  const mockProducts: Product[] = [
    {
      id: 'prod-001',
      name: 'Cà phê Đen Đá',
      basePrice: 25000,
      imageUrl: 'https://example.com/den.jpg',
      isAvailable: true,
    },
    {
      id: 'prod-002',
      name: 'Trà Đào Cam Sả',
      basePrice: 42000,
      imageUrl: 'https://example.com/tradao.jpg',
      isAvailable: true,
    },
  ];

  it('renders loading state initially while fetching products', async () => {
    const slowFetch = () => new Promise<Product[]>(() => {}); // Never resolves during this assertion

    render(<MenuCatalog fetchProducts={slowFetch} />);

    expect(screen.getByTestId('loading-state')).toBeInTheDocument();
  });

  it('renders products grid when fetching succeeds', async () => {
    const successFetch = jest.fn().mockResolvedValue(mockProducts);

    render(<MenuCatalog fetchProducts={successFetch} />);

    await waitFor(() => {
      expect(screen.queryByTestId('loading-state')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('product-grid')).toBeInTheDocument();
    expect(screen.getByText('Cà phê Đen Đá')).toBeInTheDocument();
    expect(screen.getByText('Trà Đào Cam Sả')).toBeInTheDocument();
  });

  it('renders empty state when products array is empty', async () => {
    const emptyFetch = jest.fn().mockResolvedValue([]);

    render(<MenuCatalog fetchProducts={emptyFetch} />);

    await waitFor(() => {
      expect(screen.queryByTestId('loading-state')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText(/Không tìm thấy món phù hợp/i)).toBeInTheDocument();
  });

  it('renders error state when fetch fails and recovers upon clicking retry', async () => {
    let callCount = 0;
    const failingThenSucceedingFetch = jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(new Error('Mất kết nối với cơ sở dữ liệu'));
      }
      return Promise.resolve(mockProducts);
    });

    render(<MenuCatalog fetchProducts={failingThenSucceedingFetch} />);

    // Step 1: Wait for error state
    await waitFor(() => {
      expect(screen.getByTestId('error-state')).toBeInTheDocument();
    });
    expect(screen.getByText('Mất kết nối với cơ sở dữ liệu')).toBeInTheDocument();

    // Step 2: Click Retry button
    const retryButton = screen.getByRole('button', { name: /Thử lại ngay/i });
    fireEvent.click(retryButton);

    // Step 3: Wait for successful recovery
    await waitFor(() => {
      expect(screen.getByTestId('product-grid')).toBeInTheDocument();
    });
    expect(screen.getByText('Cà phê Đen Đá')).toBeInTheDocument();
  });

  it('performs search filtering when user types in search input', async () => {
    const mockFilterFetch = jest.fn().mockImplementation((search: string) => {
      if (search.toLowerCase().includes('đào')) {
        return Promise.resolve([mockProducts[1]]);
      }
      return Promise.resolve(mockProducts);
    });

    render(<MenuCatalog fetchProducts={mockFilterFetch} />);

    await waitFor(() => {
      expect(screen.getByText('Cà phê Đen Đá')).toBeInTheDocument();
    });

    const searchInput = screen.getByLabelText(/Tìm kiếm sản phẩm/i);
    fireEvent.change(searchInput, { target: { value: 'đào' } });

    await waitFor(() => {
      expect(mockFilterFetch).toHaveBeenCalledWith('đào', expect.any(Object));
    });
  });
});

