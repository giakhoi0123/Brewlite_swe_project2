import { AuthResponse, User } from '../types/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005/api';

export class AuthApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = 'AuthApiError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  const isJson = response.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await response.json() : null;

  if (!response.ok) {
    const errorMsg =
      (data && (data.message || data.error)) ||
      `Yêu cầu thất bại với mã lỗi HTTP ${response.status}`;
    const formattedMsg = Array.isArray(errorMsg) ? errorMsg.join(', ') : errorMsg;
    throw new AuthApiError(formattedMsg, response.status);
  }

  return data as T;
}

export async function loginApi(email: string, password: string): Promise<AuthResponse> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    return await handleResponse<AuthResponse>(res);
  } catch (err: any) {
    if (err instanceof AuthApiError) throw err;
    throw new AuthApiError('Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại mạng.');
  }
}

export async function registerApi(
  fullName: string,
  email: string,
  password: string,
): Promise<AuthResponse> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ fullName, email, password }),
    });
    return await handleResponse<AuthResponse>(res);
  } catch (err: any) {
    if (err instanceof AuthApiError) throw err;
    throw new AuthApiError('Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại mạng.');
  }
}

export async function logoutApi(): Promise<{ message: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
      },
      credentials: 'include',
    });
    return await handleResponse<{ message: string }>(res);
  } catch (err: any) {
    if (err instanceof AuthApiError) throw err;
    return { message: 'Đăng xuất cục bộ' };
  }
}

export async function getMeApi(token?: string | null): Promise<{ user: User }> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    return await handleResponse<{ user: User }>(res);
  } catch (err: any) {
    if (err instanceof AuthApiError) throw err;
    throw new AuthApiError('Không thể xác thực phiên đăng nhập.');
  }
}

export async function forgotPasswordApi(email: string): Promise<{ message: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ email }),
    });
    return await handleResponse<{ message: string }>(res);
  } catch (err: any) {
    if (err instanceof AuthApiError) throw err;
    throw new AuthApiError('Không thể kết nối đến máy chủ.');
  }
}

export async function resetPasswordApi(
  token: string,
  newPassword: string,
): Promise<{ message: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ token, newPassword }),
    });
    return await handleResponse<{ message: string }>(res);
  } catch (err: any) {
    if (err instanceof AuthApiError) throw err;
    throw new AuthApiError('Không thể kết nối đến máy chủ.');
  }
}
