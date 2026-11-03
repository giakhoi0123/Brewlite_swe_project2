import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BaristaDashboardPage from '../page';
import { useAuth } from '../../../components/auth/AuthProvider';
import * as baristaApi from '../../../services/barista-api';

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/barista',
}));
jest.mock('../../../services/barista-api', () => {
  const actual = jest.requireActual('../../../services/barista-api');
  return {
    ...actual,
    fetchBaristaOrdersApi: jest.fn(),
    transitionOrderStatusApi: jest.fn(),
  };
});
jest.mock('../../../components/auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

const mockBaristaUser = {
  id: 'barista-1',
  email: 'barista@brewlite.test',
  fullName: 'Barista Quầy Pha Chế',
  role: 'BARISTA' as const,
};

const mockCustomerUser = {
  id: 'customer-1',
  email: 'customer@brewlite.test',
  fullName: 'Khách hàng',
  role: 'CUSTOMER' as const,
};

const mockOrders: baristaApi.BaristaOrder[] = [
  {
    id: 'ord-1',
    orderNumber: '#ORD-001',
    status: 'PAID',
    total: 35000,
    createdAt: new Date().toISOString(),
    customerName: 'Nguyễn Văn A',
    items: [
      {
        productName: 'Cà phê đen đá',
        quantity: 1,
        size: 'L',
      },
    ],
  },
  {
    id: 'ord-2',
    orderNumber: '#ORD-002',
    status: 'PREPARING',
    total: 45000,
    createdAt: new Date().toISOString(),
    customerName: 'Trần Thị B',
    items: [
      {
        productName: 'Bạc xỉu Sài Gòn',
        quantity: 1,
        size: 'M',
        notes: 'Ít ngọt',
      },
    ],
  },
];

describe('BaristaDashboardPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders login prompt when not logged in', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      token: null,
      loading: false,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      refresh: jest.fn(),
    });

    render(<BaristaDashboardPage />);

    expect(screen.getByText('Yêu cầu đăng nhập Barista')).toBeInTheDocument();
  });

  it('blocks access with 403 Forbidden when user is CUSTOMER', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockCustomerUser,
      token: 'token',
      loading: false,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      refresh: jest.fn(),
    });

    render(<BaristaDashboardPage />);

    expect(screen.getByText('403 — Không có quyền truy cập')).toBeInTheDocument();
    expect(screen.getByText(/CUSTOMER/)).toBeInTheDocument();
  });

  it('renders queue and order cards for BARISTA user', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockBaristaUser,
      token: 'token',
      loading: false,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      refresh: jest.fn(),
    });

    (baristaApi.fetchBaristaOrdersApi as jest.Mock).mockResolvedValue(mockOrders);

    render(<BaristaDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Bảng Điều Phối Pha Chế (Barista)')).toBeInTheDocument();
      expect(screen.getByText('#ORD-001')).toBeInTheDocument();
      expect(screen.getByText('Cà phê đen đá')).toBeInTheDocument();
      expect(screen.getByText('#ORD-002')).toBeInTheDocument();
      expect(screen.getByText('Bạc xỉu Sài Gòn')).toBeInTheDocument();
    });
  });

  it('transitions order from PAID to PREPARING', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockBaristaUser,
      token: 'token',
      loading: false,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      refresh: jest.fn(),
    });

    (baristaApi.fetchBaristaOrdersApi as jest.Mock).mockResolvedValue(mockOrders);
    (baristaApi.transitionOrderStatusApi as jest.Mock).mockResolvedValue({
      ...mockOrders[0],
      status: 'PREPARING',
    });

    render(<BaristaDashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /NHẬN ĐƠN & PHA CHẾ/i })).toBeInTheDocument();
    });

    const actionBtn = screen.getByRole('button', { name: /NHẬN ĐƠN & PHA CHẾ/i });
    await userEvent.click(actionBtn);

    await waitFor(() => {
      expect(baristaApi.transitionOrderStatusApi).toHaveBeenCalledWith(
        'ord-1',
        'PREPARING',
        'token',
      );
    });
  });

  it('displays pending handoff notice when API is not ready', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockBaristaUser,
      token: 'token',
      loading: false,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      refresh: jest.fn(),
    });

    (baristaApi.fetchBaristaOrdersApi as jest.Mock).mockRejectedValue(
      new baristaApi.BaristaApiError('Not Implemented', 501, 'MODULE_PENDING_HANDOFF'),
    );

    render(<BaristaDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Thông báo trạng thái tích hợp')).toBeInTheDocument();
      expect(screen.getByText(/Barista API đang trong quá trình bàn giao/)).toBeInTheDocument();
    });
  });
});
