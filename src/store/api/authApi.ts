import { baseApi } from "./baseApi";

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

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<AuthResponse, AuthRequestLogin>({
      query: (body) => ({
        url: "/api/auth/login",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Auth"],
    }),
    register: builder.mutation<AuthResponse, AuthRequestRegister>({
      query: (body) => ({
        url: "/api/auth/register",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Auth"],
    }),
  }),
});

export const { useLoginMutation, useRegisterMutation } = authApi;
