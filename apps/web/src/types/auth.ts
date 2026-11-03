export type UserRole = 'CUSTOMER' | 'BARISTA' | 'MANAGER';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}
