import { create } from 'zustand';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';
import type { UserWithId } from '@/types/user';

interface AuthState {
  firebaseUser: FirebaseAuthTypes.User | null;
  profile: UserWithId | null;
  isResolving: boolean; // true until auth state + profile are both known — gates splash → screen
  setFirebaseUser: (u: FirebaseAuthTypes.User | null) => void;
  setProfile: (p: UserWithId | null) => void;
  setResolving: (r: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  firebaseUser: null,
  profile: null,
  isResolving: true,
  setFirebaseUser: (u) => set({ firebaseUser: u }),
  setProfile: (p) => set({ profile: p }),
  setResolving: (r) => set({ isResolving: r }),
  reset: () => set({ firebaseUser: null, profile: null, isResolving: false }),
}));
