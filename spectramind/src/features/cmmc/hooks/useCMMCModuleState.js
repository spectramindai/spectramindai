import { useCallback, useEffect, useState } from "react";
import { getApiSession, isApiEnabled } from "../../../api/client";
import { loadApiWorkspace, saveApiWorkspaceItem } from "../../../api/workspace";
import { readScopedJson, writeScopedJson } from "../../../auth/session";
import { CMMC_FRAMEWORK_ID } from "../../../core/engines/framework-engine/frameworkRegistry";

const STORAGE_PREFIX = "spectramind:cmmc-module-state";
const MODULE_EVENT = "spectramind:cmmc-module-state-updated";

export function useCMMCModuleState(moduleId, initialState = {}) {
  const itemId = `__cmmc_module_${moduleId}`;
  const storageKey = `${STORAGE_PREFIX}:${moduleId}`;
  const hasApiSession = Boolean(isApiEnabled && getApiSession()?.token);
  const [state, setState] = useState(() =>
    hasApiSession ? initialState : normalizeState(readScopedJson(storageKey, initialState), initialState)
  );
  const [persistence, setPersistence] = useState({
    mode: hasApiSession ? "api" : "browser",
    status: hasApiSession ? "loading" : "saved",
    error: "",
  });

  useEffect(() => {
    let cancelled = false;

    if (!hasApiSession) return undefined;
    loadApiWorkspace(CMMC_FRAMEWORK_ID)
      .then((workspace) => {
        if (cancelled) return;
        setState(normalizeState(workspace?.[itemId], initialState));
        setPersistence({ mode: "api", status: "saved", error: "" });
      })
      .catch((error) => {
        if (cancelled) return;
        setPersistence({ mode: "api", status: "error", error: error.message || "Unable to load module state." });
      });

    return () => {
      cancelled = true;
    };
  }, [hasApiSession, initialState, itemId]);

  const updateState = useCallback((updater) => {
    setState((current) => {
      const next = normalizeState(typeof updater === "function" ? updater(current) : updater, initialState);
      setPersistence({ mode: hasApiSession ? "api" : "browser", status: "saving", error: "" });

      if (hasApiSession) {
        saveApiWorkspaceItem(CMMC_FRAMEWORK_ID, itemId, next, undefined, `cmmc_${moduleId}`)
          .then(() => {
            setPersistence({ mode: "api", status: "saved", error: "" });
            window.dispatchEvent(new Event(MODULE_EVENT));
          })
          .catch((error) => {
            setPersistence({ mode: "api", status: "error", error: error.message || "Unable to save module state." });
          });
      } else {
        writeScopedJson(storageKey, next, { scope: "organization", eventName: MODULE_EVENT });
        setPersistence({ mode: "browser", status: "saved", error: "" });
      }

      return next;
    });
  }, [hasApiSession, initialState, itemId, moduleId, storageKey]);

  return { state, updateState, persistence };
}

function normalizeState(value, fallback) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...(fallback || {}) };
  }

  const clean = { ...value };
  delete clean.apiVersion;
  delete clean.apiItemType;
  return { ...(fallback || {}), ...clean };
}
