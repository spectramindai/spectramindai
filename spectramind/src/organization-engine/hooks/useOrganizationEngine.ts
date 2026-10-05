import { useCallback, useMemo, useState } from "react";
import type { OrganizationWorkspace } from "../models";
import type { AssignFrameworkInput, CreateTaskInput, OnboardOrganizationInput, TrackControlInput } from "../services";
import { OrganizationEngineService } from "../services";

export interface UseOrganizationEngineOptions {
  workspace?: Partial<OrganizationWorkspace>;
}

/** Provides a React state wrapper around the organization implementation engine. */
export function useOrganizationEngine(options: UseOrganizationEngineOptions = {}) {
  const [workspace, setWorkspace] = useState<Partial<OrganizationWorkspace>>(options.workspace || {});
  const engine = useMemo(() => new OrganizationEngineService(workspace), [workspace]);

  const sync = useCallback(() => setWorkspace(engine.toJSON()), [engine]);

  /** Onboards an organization and refreshes the workspace snapshot. */
  const onboardOrganization = useCallback(
    (input: OnboardOrganizationInput) => {
      const organization = engine.onboardOrganization(input);
      sync();
      return organization;
    },
    [engine, sync],
  );

  /** Assigns a framework to an organization and refreshes the workspace snapshot. */
  const assignFramework = useCallback(
    (input: AssignFrameworkInput) => {
      const framework = engine.assignFramework(input);
      sync();
      return framework;
    },
    [engine, sync],
  );

  /** Tracks organization-specific control implementation status. */
  const trackControlStatus = useCallback(
    (input: TrackControlInput) => {
      const control = engine.trackControlStatus(input);
      sync();
      return control;
    },
    [engine, sync],
  );

  /** Creates an implementation task and refreshes the workspace snapshot. */
  const createTask = useCallback(
    (input: CreateTaskInput) => {
      const task = engine.createTask(input);
      sync();
      return task;
    },
    [engine, sync],
  );

  return {
    engine,
    workspace,
    onboardOrganization,
    assignFramework,
    trackControlStatus,
    createTask,
  };
}

