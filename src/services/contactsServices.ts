import api from "./api";

export type ContactUser = {
  id: string;
  username: string;
  status?: string;
};

type ContactsResponse = {
  success?: boolean;
  contacts?: ContactUser[];
  error?: string;
};

type SearchResponse = {
  success?: boolean;
  results?: ContactUser[];
  error?: string;
};

type AddContactResponse = {
  success?: boolean;
  error?: string;
};

const withAuth = (token: string | null) => ({
  headers: token ? { Authorization: `Bearer ${token}` } : undefined,
});

export const getContactsService = async (token: string | null) => {
  const response = await api.get<ContactsResponse>("/api/contacts", withAuth(token));
  return response.data.contacts || [];
};

export const searchUsersService = async (query: string, token: string | null) => {
  const response = await api.get<SearchResponse>(
    `/api/users/search?q=${encodeURIComponent(query)}`,
    withAuth(token)
  );
  return response.data.results || [];
};

export const addContactService = async (payload: { contactUserId: string }, token: string | null) => {
  const response = await api.post<AddContactResponse>("/api/contacts", payload, withAuth(token));
  return response.data;
};
