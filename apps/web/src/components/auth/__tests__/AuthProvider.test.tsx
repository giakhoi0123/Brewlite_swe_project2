import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../AuthProvider';
import * as authApi from '../../../services/auth-api';
import { User } from '../../../types/auth';

jest.mock('../../../services/auth-api');

const mockUser: User = {
  id: 'user-uuid-1',
  email: 'customer@brewlite.test',
  fullName: 'Khách hàng thử nghiệm',
  role: 'CUSTOMER',
};

function TestConsumer() {
  const { user, loading, login, logout, register } = useAuth();

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <div data-testid="user-info">{user ? `${user.fullName} (${user.role})` : 'Anonymous'}</div>
      <button
        onClick={() => login('customer@brewlite.test', 'Password123!')}
      >
        Login Button
      </button>
      <button
        onClick={() => register('Khách hàng mới', 'new@brewlite.test', 'Password123!')}
      >
        Register Button
      </button>
      <button onClick={() => logout()}>Logout Button</button>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('initializes with null user when no session exists', async () => {
    (authApi.getMeApi as jest.Mock).mockRejectedValue(new Error('Unauthorized'));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('user-info')).toHaveTextContent('Anonymous');
  });

  it('restores session when getMeApi succeeds', async () => {
    (authApi.getMeApi as jest.Mock).mockResolvedValue({ user: mockUser });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-info')).toHaveTextContent(
        'Khách hàng thử nghiệm (CUSTOMER)',
      );
    });
  });

  it('logs in successfully and updates user state', async () => {
    (authApi.getMeApi as jest.Mock).mockRejectedValue(new Error('Unauthorized'));
    (authApi.loginApi as jest.Mock).mockResolvedValue({
      user: mockUser,
      accessToken: 'access-token-123',
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-info')).toHaveTextContent('Anonymous');
    });

    await userEvent.click(screen.getByText('Login Button'));

    await waitFor(() => {
      expect(screen.getByTestId('user-info')).toHaveTextContent(
        'Khách hàng thử nghiệm (CUSTOMER)',
      );
    });

    expect(localStorage.getItem('brewlite_access_token')).toBe('access-token-123');
  });

  it('registers successfully and updates user state', async () => {
    const newUser: User = {
      id: 'new-user-id',
      email: 'new@brewlite.test',
      fullName: 'Khách hàng mới',
      role: 'CUSTOMER',
    };
    (authApi.getMeApi as jest.Mock).mockRejectedValue(new Error('Unauthorized'));
    (authApi.registerApi as jest.Mock).mockResolvedValue({
      user: newUser,
      accessToken: 'new-access-token',
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-info')).toHaveTextContent('Anonymous');
    });

    await userEvent.click(screen.getByText('Register Button'));

    await waitFor(() => {
      expect(screen.getByTestId('user-info')).toHaveTextContent(
        'Khách hàng mới (CUSTOMER)',
      );
    });
  });

  it('clears user state and storage on logout', async () => {
    (authApi.getMeApi as jest.Mock).mockResolvedValue({ user: mockUser });
    (authApi.logoutApi as jest.Mock).mockResolvedValue({ message: 'Success' });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-info')).toHaveTextContent(
        'Khách hàng thử nghiệm (CUSTOMER)',
      );
    });

    await userEvent.click(screen.getByText('Logout Button'));

    await waitFor(() => {
      expect(screen.getByTestId('user-info')).toHaveTextContent('Anonymous');
    });

    expect(localStorage.getItem('brewlite_access_token')).toBeNull();
  });
});
