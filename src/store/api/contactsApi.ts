import { baseApi } from "./baseApi";

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

type AddContactRequest = {
  contactUserId: string;
};

export const contactsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getContacts: builder.query<ContactUser[], void>({
      query: () => ({
        url: "/api/contacts",
        method: "GET",
      }),
      transformResponse: (response: ContactsResponse) => response.contacts || [],
      providesTags: ["Contacts"],
    }),
    searchUsers: builder.query<ContactUser[], string>({
      query: (q) => ({
        url: `/api/users/search?q=${encodeURIComponent(q)}`,
        method: "GET",
      }),
      transformResponse: (response: SearchResponse) => response.results || [],
    }),
    addContact: builder.mutation<{ success?: boolean; error?: string }, AddContactRequest>({
      query: (body) => ({
        url: "/api/contacts",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Contacts"],
    }),
  }),
});

export const { useGetContactsQuery, useLazySearchUsersQuery, useAddContactMutation } = contactsApi;
