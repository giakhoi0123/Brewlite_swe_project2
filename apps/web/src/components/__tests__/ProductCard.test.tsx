import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProductCard } from '../ProductCard';
import { Product } from '../../types/product';

describe('ProductCard Component', () => {
  const availableProduct: Product = {
    id: 'prod-001',
    name: 'Cà phê Sữa Đá',
    basePrice: 29000,
    imageUrl: 'https://example.com/suada.jpg',
    isAvailable: true,
  };

  const unavailableProduct: Product = {
    id: 'prod-002',
    name: 'Cold Brew Cam Sả',
    basePrice: 45000,
    imageUrl: 'https://example.com/coldbrew.jpg',
    isAvailable: false,
  };

  it('renders read-only product information accurately with NO action button when onClick handler is omitted', () => {
    render(<ProductCard product={availableProduct} />);

    expect(screen.getByText('Cà phê Sữa Đá')).toBeInTheDocument();
    expect(screen.getByText('29.000 đ')).toBeInTheDocument();
    expect(screen.getByText('Còn hàng')).toBeInTheDocument();

    // Verify FIX-04: Không tồn tại nút bấm vô tác dụng khi không có handler
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders action button and triggers callback when onClick handler is provided and product is available', () => {
    const handleClick = jest.fn();
    render(<ProductCard product={availableProduct} onClick={handleClick} />);

    const button = screen.getByRole('button', { name: /Chọn mua Cà phê Sữa Đá/i });
    expect(button).toBeInTheDocument();
    expect(button).toBeEnabled();
    expect(button).toHaveTextContent('Chọn món');

    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(handleClick).toHaveBeenCalledWith(availableProduct);
  });

  it('disables action button and prevents click invocation when product is unavailable', () => {
    const handleClick = jest.fn();
    render(<ProductCard product={unavailableProduct} onClick={handleClick} />);

    expect(screen.getByText('Cold Brew Cam Sả')).toBeInTheDocument();
    expect(screen.getByText('45.000 đ')).toBeInTheDocument();
    expect(screen.getByText('Hết hàng')).toBeInTheDocument();

    const button = screen.getByRole('button', { name: /Cold Brew Cam Sả hiện đã hết/i });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('Tạm hết');

    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('switches to fallback image when image load fails', () => {
    render(<ProductCard product={availableProduct} />);

    const img = screen.getByAltText('Cà phê Sữa Đá') as HTMLImageElement;
    expect(img.src).toBe('https://example.com/suada.jpg');

    // Trigger onError
    fireEvent.error(img);

    expect(img.src).toContain('images.unsplash.com');
  });
});
