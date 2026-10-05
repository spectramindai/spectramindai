/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  clearStoredSession,
  createUserSession,
  getStoredSession,
  persistSession,
} from "./session";
import { clearApiSession, isApiEnabled, loginWithApi } from "../api/client";
import { authenticateLocalAccount } from "../data/localAccounts";

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [session, setSession] = useState(() => getStoredSession());

  useEffect(() => {
    const syncSession = () => setSession(getStoredSession());

    window.addEventListener("spectramind:session-updated", syncSession);
    window.addEventListener("storage", syncSession);

    return () => {
      window.removeEventListener("spectramind:session-updated", syncSession);
      window.removeEventListener("storage", syncSession);
    };
  }, []);

  const login = useCallback((profile, options) => {
    const nextSession = createUserSession(profile);
    persistSession(nextSession, options);
    setSession(nextSession);
    return nextSession;
  }, []);

  const loginWithPassword = useCallback(async (email, password, options) => {
    if (!isApiEnabled) {
      const authentication = await authenticateLocalAccount(email, password);
      if (authentication.reason === "USER_NOT_FOUND") {
        const error = new Error("No account exists for this email. Please create an account first.");
        error.code = "USER_NOT_FOUND";
        throw error;
      }
      if (authentication.reason === "PASSWORD_NOT_CONFIGURED") {
        const error = new Error("This local account was created before password security was enabled. Clear local storage and create the account again.");
        error.code = "PASSWORD_NOT_CONFIGURED";
        throw error;
      }
      if (!authentication.valid) {
        const error = new Error("Incorrect password.");
        error.code = "INVALID_PASSWORD";
        throw error;
      }
      return login(authentication.account, options);
    }
    const nextSession = await loginWithApi(email, password, options);
    persistSession(nextSession, options);
    setSession(nextSession);
    return nextSession;
  }, [login]);

  const logout = useCallback(() => {
    clearApiSession();
    clearStoredSession();
    setSession(null);
  }, []);

  const updateUser = useCallback((updates) => {
    setSession((current) => {
      if (!current) return current;
      const next = { ...current, ...updates };
      persistSession(next, { remember: true });
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      user: session,
      session,
      isAuthenticated: Boolean(session),
      login,
      loginWithPassword,
      updateUser,
      logout,
    }),
    [login, loginWithPassword, logout, session, updateUser]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within UserProvider");
  }

  return context;
}

export function useOptionalUser() {
  return useContext(UserContext);
}
