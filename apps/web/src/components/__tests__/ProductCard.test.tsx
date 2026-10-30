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

  it('renders product information accurately with formatted VND currency', () => {
    render(<ProductCard product={availableProduct} />);

    expect(screen.getByText('Cà phê Sữa Đá')).toBeInTheDocument();
    expect(screen.getByText('29.000 đ')).toBeInTheDocument();
    expect(screen.getByText('Còn hàng')).toBeInTheDocument();

    const button = screen.getByRole('button', { name: /Chọn mua Cà phê Sữa Đá/i });
    expect(button).toBeEnabled();
    expect(button).toHaveTextContent('Chọn món');
  });

  it('renders unavailable state with disabled button and correct badge', () => {
    render(<ProductCard product={unavailableProduct} />);

    expect(screen.getByText('Cold Brew Cam Sả')).toBeInTheDocument();
    expect(screen.getByText('45.000 đ')).toBeInTheDocument();
    expect(screen.getByText('Hết hàng')).toBeInTheDocument();

    const button = screen.getByRole('button', { name: /Cold Brew Cam Sả hiện đã hết/i });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('Tạm hết');
  });

  it('switches to fallback image when image load fails', () => {
    render(<ProductCard product={availableProduct} />);

    const img = screen.getByAltText('Cà phê Sữa Đá') as HTMLImageElement;
    expect(img.src).toBe('https://example.com/suada.jpg');

    // Trigger onError
    fireEvent.error(img);

    expect(img.src).toContain('images.unsplash.com');
  });

  it('fires onClick callback when button is clicked on available item', () => {
    const handleClick = jest.fn();
    render(<ProductCard product={availableProduct} onClick={handleClick} />);

    const button = screen.getByRole('button', { name: /Chọn mua Cà phê Sữa Đá/i });
    fireEvent.click(button);

    expect(handleClick).toHaveBeenCalledWith(availableProduct);
  });
});

