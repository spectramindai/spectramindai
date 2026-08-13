/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { canManageWorkspace, getOrganizationScopedStorageKey, getStoredSession } from "../auth/session";
import { getFrameworkLibrary, resolveFrameworkId } from "../core/engines/framework-engine/frameworkRegistry";
import { apiRequest, getApiSession, isApiEnabled } from "../api/client";
import { useOptionalUser } from "../auth/UserContext";

const STORAGE_KEY = "spectramind:framework-workspace";
const CART_STORAGE_KEY = "spectramind:framework-cart";

export const FRAMEWORK_CATALOG = [
  {
    id: "soc2-type-ii",
    slug: "soc-2",
    name: "SOC 2",
    shortName: "SOC 2",
    description: "SOC 2 controls, tests, risks, policies, and evidence readiness.",
  },
  {
    id: "iso27001-2022",
    slug: "iso-27001",
    name: "ISO 27001",
    shortName: "ISO 27001",
    description: "ISO 27001 ISMS controls, risks, policies, and mandatory documents.",
  },
  {
    id: "hipaa",
    slug: "hipaa",
    name: "HIPAA",
    shortName: "HIPAA",
    description: "Healthcare privacy and security compliance workspace.",
  },
  {
    id: "gdpr",
    slug: "gdpr",
    name: "GDPR",
    shortName: "GDPR",
    description: "Privacy program readiness and data protection operations.",
  },
  {
    id: "pci-dss",
    slug: "pci-dss",
    name: "PCI DSS",
    shortName: "PCI DSS",
    description: "Payment card security controls and evidence tracking.",
  },
  {
    id: "cmmc",
    slug: "cmmc",
    name: "CMMC",
    shortName: "CMMC",
    description: "Defense contractor cybersecurity maturity workspace.",
  },
];

const FrameworkWorkspaceContext = createContext(null);

export function FrameworkWorkspaceProvider({ children }) {
  const { session } = useOptionalUser() || {};
  const [workspace, setWorkspace] = useState(() => loadFrameworkWorkspace());
  const [cartFrameworkIds, setCartFrameworkIds] = useState(() => loadFrameworkCart());
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isLoadingFrameworks, setIsLoadingFrameworks] = useState(() => Boolean(isApiEnabled && getApiSession()?.organizationId));
  const [frameworkLoadError, setFrameworkLoadError] = useState("");
  const [loadedOrganizationId, setLoadedOrganizationId] = useState("");

  useEffect(() => {
    const refresh = () => {
      if (!isApiEnabled) setWorkspace(loadFrameworkWorkspace());
      setCartFrameworkIds(loadFrameworkCart());
    };

    window.addEventListener("spectramind:framework-workspace-updated", refresh);
    window.addEventListener("spectramind:session-updated", refresh);
    window.addEventListener("storage", refresh);

    return () => {
      window.removeEventListener("spectramind:framework-workspace-updated", refresh);
      window.removeEventListener("spectramind:session-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const persistWorkspace = useCallback((nextWorkspace) => {
    persistFrameworkWorkspace(nextWorkspace);
    setWorkspace(nextWorkspace);
  }, []);

  useEffect(() => {
    const apiSession = getApiSession();
    if (!isApiEnabled) return undefined;
    if (!apiSession?.token || !apiSession?.organizationId) {
      // Reset organization-scoped state when the API session is removed.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWorkspace(emptyWorkspace());
      setIsLoadingFrameworks(false);
      setFrameworkLoadError("");
      setLoadedOrganizationId("");
      return undefined;
    }
    let cancelled = false;
    setIsLoadingFrameworks(true);
    setFrameworkLoadError("");
    apiRequest("/api/v1/organization-frameworks")
      .then(async (records) => {
        if (cancelled) return;
        let selectedFrameworkIds = records
          .filter((record) => record.active)
          .map((record) => getFrameworkByIdOrSlug(record.framework?.slug || record.frameworkId)?.id)
          .filter(Boolean);
        const current = loadFrameworkWorkspace();

        // Older frontend releases kept framework selection only in browser
        // storage. Reconcile those organization-scoped selections once from
        // the original browser so PostgreSQL becomes authoritative for every
        // subsequent device.
        const recoverableLocalIds = current.selectedFrameworkIds.filter((id) => {
          const framework = getFrameworkByIdOrSlug(id);
          return framework && resolveFrameworkId(framework.slug) && !selectedFrameworkIds.includes(framework.id);
        });
        if (recoverableLocalIds.length && canManageWorkspace(session?.role)) {
          try {
            const recovered = await apiRequest("/api/v1/organization-frameworks/checkout", {
              method: "POST",
              body: JSON.stringify({
                frameworkIds: recoverableLocalIds.map((id) => {
                  const framework = getFrameworkByIdOrSlug(id);
                  return resolveFrameworkId(framework.slug) || framework.id;
                }),
              }),
            });
            const recoveredIds = recovered
              .filter((record) => record.active)
              .map((record) => getFrameworkByIdOrSlug(record.framework?.slug || record.frameworkId)?.id)
              .filter(Boolean);
            selectedFrameworkIds = [...new Set([...selectedFrameworkIds, ...recoveredIds])];
          } catch {
            // Keep the confirmed server selection visible. The local recovery
            // will retry the next time this organization loads.
          }
        }

        persistWorkspace({
          selectedFrameworkIds,
          activeFrameworkId: selectedFrameworkIds.includes(current.activeFrameworkId)
            ? current.activeFrameworkId
            : selectedFrameworkIds[0] || "",
        });
      })
      .catch((error) => {
        if (!cancelled) {
          setWorkspace(emptyWorkspace());
          setFrameworkLoadError(error.message || "Could not load organization frameworks");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadedOrganizationId(apiSession.organizationId);
          setIsLoadingFrameworks(false);
        }
      });
    return () => { cancelled = true; };
  }, [persistWorkspace, session?.organizationId, session?.role, session?.userId]);

  const selectFramework = useCallback(
    async (frameworkIdOrSlug) => {
      const framework = getFrameworkByIdOrSlug(frameworkIdOrSlug);
      if (!framework) return null;
      if (!hasOrganizationWorkspace()) return null;

      if (isApiEnabled && getApiSession()?.token) {
        await apiRequest("/api/v1/organization-frameworks", {
          method: "POST",
          body: JSON.stringify({ frameworkId: resolveFrameworkId(framework.slug) || framework.id }),
        });
      }

      const selectedFrameworkIds = workspace.selectedFrameworkIds.includes(framework.id)
        ? workspace.selectedFrameworkIds
        : [...workspace.selectedFrameworkIds, framework.id];

      const nextWorkspace = {
        selectedFrameworkIds,
        activeFrameworkId: framework.id,
      };

      persistWorkspace(nextWorkspace);
      return framework;
    },
    [persistWorkspace, workspace.selectedFrameworkIds]
  );

  const setActiveFramework = useCallback(
    (frameworkIdOrSlug) => {
      const framework = getFrameworkByIdOrSlug(frameworkIdOrSlug);
      if (!hasOrganizationWorkspace()) return null;
      if (!framework || !workspace.selectedFrameworkIds.includes(framework.id)) return null;

      const nextWorkspace = {
        ...workspace,
        activeFrameworkId: framework.id,
      };

      persistWorkspace(nextWorkspace);
      return framework;
    },
    [persistWorkspace, workspace]
  );

  const addToCart = useCallback((frameworkIdOrSlug) => {
    const framework = getFrameworkByIdOrSlug(frameworkIdOrSlug);
    if (!hasOrganizationWorkspace()) return null;
    if (!framework || workspace.selectedFrameworkIds.includes(framework.id)) return null;
    const next = cartFrameworkIds.includes(framework.id) ? cartFrameworkIds : [...cartFrameworkIds, framework.id];
    persistFrameworkCart(next);
    setCartFrameworkIds(next);
    setIsCartOpen(true);
    return framework;
  }, [cartFrameworkIds, workspace.selectedFrameworkIds]);

  const removeFromCart = useCallback((frameworkIdOrSlug) => {
    const framework = getFrameworkByIdOrSlug(frameworkIdOrSlug);
    if (!framework) return;
    const next = cartFrameworkIds.filter(id => id !== framework.id);
    persistFrameworkCart(next);
    setCartFrameworkIds(next);
  }, [cartFrameworkIds]);

  const clearCart = useCallback(() => {
    persistFrameworkCart([]);
    setCartFrameworkIds([]);
  }, []);

  const checkoutCart = useCallback(async () => {
    if (!hasOrganizationWorkspace()) return [];
    const validIds = cartFrameworkIds.filter(id => !workspace.selectedFrameworkIds.includes(id));
    if (!validIds.length) return [];
    if (isApiEnabled && getApiSession()?.token) {
      await apiRequest("/api/v1/organization-frameworks/checkout", {
        method: "POST",
        body: JSON.stringify({ frameworkIds: validIds.map(id => {
          const framework = getFrameworkByIdOrSlug(id);
          return resolveFrameworkId(framework?.slug) || framework?.id;
        }) }),
      });
    }
    const selectedFrameworkIds = [...workspace.selectedFrameworkIds, ...validIds];
    persistWorkspace({ selectedFrameworkIds, activeFrameworkId: workspace.activeFrameworkId || validIds[0] });
    persistFrameworkCart([]);
    setCartFrameworkIds([]);
    setIsCartOpen(false);
    return validIds.map(getFrameworkByIdOrSlug).filter(Boolean);
  }, [cartFrameworkIds, persistWorkspace, workspace]);

  const selectedFrameworks = useMemo(
    () => workspace.selectedFrameworkIds.map(getFrameworkByIdOrSlug).filter(Boolean),
    [workspace.selectedFrameworkIds]
  );

  const availableFrameworks = useMemo(
    () => FRAMEWORK_CATALOG.filter((framework) => !workspace.selectedFrameworkIds.includes(framework.id)),
    [workspace.selectedFrameworkIds]
  );

  const activeFramework = useMemo(
    () => getFrameworkByIdOrSlug(workspace.activeFrameworkId),
    [workspace.activeFrameworkId]
  );
  const cartFrameworks = useMemo(
    () => cartFrameworkIds.map(getFrameworkByIdOrSlug).filter(Boolean),
    [cartFrameworkIds]
  );
  const workspaceIsHydrating = Boolean(
    isApiEnabled &&
    session?.organizationId &&
    (isLoadingFrameworks || loadedOrganizationId !== session.organizationId)
  );

  const value = useMemo(
    () => ({
      frameworks: FRAMEWORK_CATALOG,
      selectedFrameworkIds: workspace.selectedFrameworkIds,
      selectedFrameworks,
      availableFrameworks,
      activeFrameworkId: activeFramework?.id || "",
      activeFramework,
      cartFrameworks,
      cartCount: cartFrameworks.length,
      isCartOpen,
      isLoadingFrameworks: workspaceIsHydrating,
      frameworkLoadError,
      setIsCartOpen,
      addToCart,
      removeFromCart,
      clearCart,
      checkoutCart,
      selectFramework,
      setActiveFramework,
      isFrameworkSelected: (frameworkIdOrSlug) => {
        const framework = getFrameworkByIdOrSlug(frameworkIdOrSlug);
        return Boolean(framework && workspace.selectedFrameworkIds.includes(framework.id));
      },
    }),
    [activeFramework, addToCart, availableFrameworks, cartFrameworks, checkoutCart, clearCart, frameworkLoadError, isCartOpen, removeFromCart, selectFramework, selectedFrameworks, setActiveFramework, workspace.selectedFrameworkIds, workspaceIsHydrating]
  );

  return (
    <FrameworkWorkspaceContext.Provider value={value}>
      {children}
    </FrameworkWorkspaceContext.Provider>
  );
}

export function useFrameworkWorkspace() {
  const context = useContext(FrameworkWorkspaceContext);
  if (!context) {
    throw new Error("useFrameworkWorkspace must be used within FrameworkWorkspaceProvider");
  }

  return context;
}

export function getFrameworkByIdOrSlug(value) {
  if (!value) return null;
  const resolvedId = resolveFrameworkId(value);
  return FRAMEWORK_CATALOG.find(
    (framework) => framework.id === value || framework.slug === value || framework.id === resolvedId
  ) || null;
}

export function frameworkHasLibrary(frameworkIdOrSlug) {
  const framework = getFrameworkByIdOrSlug(frameworkIdOrSlug);
  return Boolean(framework && getFrameworkLibrary(framework.id));
}

function loadFrameworkWorkspace() {
  if (typeof window === "undefined") {
    return emptyWorkspace();
  }

  try {
    const session = getStoredSession();
    if (!session?.organizationId) return emptyWorkspace();
    const raw = window.localStorage.getItem(getOrganizationScopedStorageKey(STORAGE_KEY, session));
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") return emptyWorkspace();

    const selectedFrameworkIds = Array.isArray(parsed.selectedFrameworkIds)
      ? parsed.selectedFrameworkIds.filter((id) => getFrameworkByIdOrSlug(id))
      : [];

    const activeFramework = getFrameworkByIdOrSlug(parsed.activeFrameworkId);
    const activeFrameworkId = activeFramework && selectedFrameworkIds.includes(activeFramework.id)
      ? activeFramework.id
      : "";

    return { selectedFrameworkIds, activeFrameworkId };
  } catch {
    return emptyWorkspace();
  }
}

function persistFrameworkWorkspace(workspace) {
  if (typeof window === "undefined") return;

  const session = getStoredSession();
  if (!session?.organizationId) return;

  window.localStorage.setItem(getOrganizationScopedStorageKey(STORAGE_KEY, session), JSON.stringify(workspace));
  window.dispatchEvent(new Event("spectramind:framework-workspace-updated"));
  window.dispatchEvent(new Event("spectramind:active-framework-updated"));
  window.dispatchEvent(new Event("spectramind:workspace-updated"));
  window.dispatchEvent(new Event("spectramind:questionnaire-updated"));
}

function loadFrameworkCart() {
  if (typeof window === "undefined") return [];
  try {
    const session = getStoredSession();
    if (!session?.organizationId) return [];
    const raw = window.localStorage.getItem(getOrganizationScopedStorageKey(CART_STORAGE_KEY, session));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? [...new Set(parsed.filter(id => getFrameworkByIdOrSlug(id)))] : [];
  } catch { return []; }
}

function persistFrameworkCart(ids) {
  if (typeof window === "undefined") return;
  const session = getStoredSession();
  if (!session?.organizationId) return;
  window.localStorage.setItem(getOrganizationScopedStorageKey(CART_STORAGE_KEY, session), JSON.stringify(ids));
  window.dispatchEvent(new Event("spectramind:framework-workspace-updated"));
}

function emptyWorkspace() {
  return {
    selectedFrameworkIds: [],
    activeFrameworkId: "",
  };
}

function hasOrganizationWorkspace() {
  const session = getStoredSession();
  return Boolean(session?.organizationId && session?.onboardingComplete);
}
