import api from "./api";

export type AuthRequestLogin = {
  phone: string;
  password: string;
};

export type AuthRequestRegister = {
  phone: string;
  username: string;
  password: string;
};

export type AuthResponse = {
  success: boolean;
  message?: string;
  token: string;
  user: {
    id: string;
    username: string;
    phone: string;
  };
  error?: string;
};

export const loginUserService = async (payload: AuthRequestLogin) => {
  const response = await api.post<AuthResponse>("/api/auth/login", payload);
  return response.data;
};

export const registerUserService = async (payload: AuthRequestRegister) => {
  const response = await api.post<AuthResponse>("/api/auth/register", payload);
  return response.data;
};
