import { create } from 'zustand';

const UsernameState = create((set, get) => ({
  User: {},
  setUser: (User) => set({ User }),
  getUser: () => get().User,
}))

export { UsernameState };


