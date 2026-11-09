import { act, render, screen, fireEvent } from '@testing-library/react';
import { CartProvider, useCart } from '../CartProvider';
import { checkCartAvailability } from '../../../services/product-api';
import { DEFAULT_CUSTOMIZATION } from '../../../data/menu-options';
jest.mock('../../../services/product-api', () => ({ checkCartAvailability: jest.fn() }));
const check = checkCartAvailability as jest.Mock;
function Probe() {
  const cart = useCart();
  return <><span data-testid="quantity">{cart.totalQuantity}</span>
    <button onClick={() => void cart.addItem({ productId: 'coffee', name: 'Coffee', imageUrl: '', basePrice: 100, customization: DEFAULT_CUSTOMIZATION, quantity: 1 })}>Add</button>
    <button onClick={() => void cart.updateQuantity(cart.items[0].lineId, cart.items[0].quantity + 1)}>Increase</button>
    <button onClick={() => cart.clearCart()}>Clear</button></>;
}
describe('cart availability updates', () => {
  beforeEach(() => { jest.useFakeTimers(); localStorage.clear(); check.mockReset(); });
  afterEach(() => { jest.useRealTimers(); });
  it('updates immediately and batches rapid edits into one stock check', async () => {
    check.mockResolvedValue({ canOrder: true, items: [] });
    render(<CartProvider><Probe /></CartProvider>);
    fireEvent.click(screen.getByText('Add'));
    fireEvent.click(screen.getByText('Increase'));
    fireEvent.click(screen.getByText('Increase'));
    expect(screen.getByTestId('quantity')).toHaveTextContent('3');
    expect(check).not.toHaveBeenCalled();
    await act(async () => { jest.advanceTimersByTime(250); });
    expect(check).toHaveBeenCalledTimes(1);
    expect(check.mock.calls[0][0][0].quantity).toBe(3);
  });
  it('restores confirmed state on insufficient stock', async () => {
    check.mockResolvedValue({ canOrder: false, items: [{ index: 0, canOrder: false, availableQuantity: 0 }] });
    render(<CartProvider><Probe /></CartProvider>);
    fireEvent.click(screen.getByText('Add'));
    await act(async () => { jest.advanceTimersByTime(250); });
    expect(screen.getByTestId('quantity')).toHaveTextContent('0');
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
  it('ignores a late request after clearing the cart', async () => {
    let finish!: (value: unknown) => void;
    check.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    render(<CartProvider><Probe /></CartProvider>);
    fireEvent.click(screen.getByText('Add'));
    await act(async () => { jest.advanceTimersByTime(250); });
    fireEvent.click(screen.getByText('Clear'));
    await act(async () => { finish({ canOrder: true, items: [] }); });
    expect(screen.getByTestId('quantity')).toHaveTextContent('0');
  });
});
