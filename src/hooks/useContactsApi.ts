import { useCallback, useEffect, useState } from "react";
import { addContactService, getContactsService, searchUsersService, type ContactUser } from "../services";
import { useAppSelector } from "../store/store";

const getErrorMessage = (error: unknown) => {
  const data = (error as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
  if (data?.error) return data.error;
  if (data?.message) return data.message;
  if (error instanceof Error) return error.message;
  return "Request failed";
};

export const useContactsApi = () => {
  const token = useAppSelector((state) => state.auth.token);
  const [contacts, setContacts] = useState<ContactUser[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);

  const fetchContacts = useCallback(async () => {
    setLoadingContacts(true);
    try {
      const data = await getContactsService(token);
      setContacts(data);
      return data;
    } finally {
      setLoadingContacts(false);
    }
  }, [token]);

  const searchUsers = useCallback(
    async (query: string) => {
      setLoadingSearch(true);
      try {
        return await searchUsersService(query, token);
      } finally {
        setLoadingSearch(false);
      }
    },
    [token]
  );

  const addContact = useCallback(
    async (payload: { contactUserId: string }) => {
      const response = await addContactService(payload, token);
      if (response.success) {
        await fetchContacts();
      }
      return response;
    },
    [fetchContacts, token]
  );

  useEffect(() => {
    if (!token) {
      setContacts([]);
      return;
    }

    fetchContacts().catch((error: unknown) => {
      console.warn("[Contacts] initial fetch failed:", getErrorMessage(error));
    });

    const interval = setInterval(() => {
      fetchContacts().catch(() => {
        // No-op: avoid noisy polling errors.
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchContacts, token]);

  return {
    contacts,
    loadingContacts,
    loadingSearch,
    fetchContacts,
    searchUsers,
    addContact,
  };
};
