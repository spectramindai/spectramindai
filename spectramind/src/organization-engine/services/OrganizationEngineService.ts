import type {
  AuditEvent,
  Comment,
  EvidenceStatus,
  FrameworkAssignmentStatus,
  ImplementationStatus,
  Note,
  Organization,
  OrganizationControl,
  OrganizationEvidence,
  OrganizationFramework,
  OrganizationOwner,
  OrganizationProgress,
  OrganizationRisk,
  OrganizationTask,
  OrganizationWorkspace,
  Priority,
  TaskStatus,
} from "../models";

const emptyWorkspace = (): OrganizationWorkspace => ({
  organizations: [],
  frameworks: [],
  owners: [],
  controls: [],
  evidence: [],
  tasks: [],
  risks: [],
});

export interface OnboardOrganizationInput {
  id?: string;
  name: string;
  metadata?: Record<string, unknown>;
}

export interface AssignFrameworkInput {
  organizationId: string;
  frameworkId: string;
  targetAuditDate?: string;
}

export interface TrackControlInput {
  organizationId: string;
  frameworkId: string;
  controlId: string;
  status?: ImplementationStatus;
}

export interface CreateTaskInput {
  organizationId: string;
  frameworkId: string;
  title: string;
  priority?: Priority;
  taskTemplateId?: string;
  relatedControlIds?: string[];
  ownerIds?: string[];
  dueDate?: string;
}

/** Manages organization-specific implementation data without mutating framework libraries. */
export class OrganizationEngineService {
  private workspace: OrganizationWorkspace;

  constructor(workspace: Partial<OrganizationWorkspace> = {}) {
    this.workspace = { ...emptyWorkspace(), ...workspace };
  }

  /** Returns a serializable snapshot of all organization implementation data. */
  toJSON(): OrganizationWorkspace {
    return structuredClone(this.workspace);
  }

  /** Creates a new organization onboarding record. */
  onboardOrganization(input: OnboardOrganizationInput): Organization {
    const now = new Date().toISOString();
    const organization: Organization = {
      id: input.id || this.createId("org"),
      name: input.name,
      status: "active",
      createdAt: now,
      updatedAt: now,
      metadata: input.metadata,
    };

    this.workspace.organizations.push(organization);
    return organization;
  }

  /** Assigns a compliance framework to an organization. */
  assignFramework(input: AssignFrameworkInput): OrganizationFramework {
    this.assertOrganization(input.organizationId);

    const existing = this.workspace.frameworks.find(
      (framework) => framework.organizationId === input.organizationId && framework.frameworkId === input.frameworkId,
    );

    if (existing) return existing;

    const now = new Date().toISOString();
    const framework: OrganizationFramework = {
      id: this.createId("org-fw"),
      organizationId: input.organizationId,
      frameworkId: input.frameworkId,
      status: "not_started",
      assignedAt: now,
      updatedAt: now,
      targetAuditDate: input.targetAuditDate,
      notes: [],
      auditHistory: [this.createAuditEvent("framework_assigned", "organizationFramework", input.frameworkId)],
    };

    this.workspace.frameworks.push(framework);
    return framework;
  }

  /** Updates the assignment status for an organization framework. */
  updateFrameworkStatus(organizationId: string, frameworkId: string, status: FrameworkAssignmentStatus): OrganizationFramework {
    const framework = this.requireOrganizationFramework(organizationId, frameworkId);
    framework.status = status;
    framework.updatedAt = new Date().toISOString();
    framework.auditHistory.push(this.createAuditEvent("framework_status_updated", "organizationFramework", framework.id, { status }));
    return framework;
  }

  /** Creates or updates organization-specific status for a framework control. */
  trackControlStatus(input: TrackControlInput): OrganizationControl {
    this.requireOrganizationFramework(input.organizationId, input.frameworkId);
    const now = new Date().toISOString();
    const existing = this.workspace.controls.find(
      (control) =>
        control.organizationId === input.organizationId &&
        control.frameworkId === input.frameworkId &&
        control.controlId === input.controlId,
    );

    if (existing) {
      existing.status = input.status || existing.status;
      existing.updatedAt = now;
      existing.auditHistory.push(this.createAuditEvent("control_status_updated", "organizationControl", existing.id, { status: existing.status }));
      return existing;
    }

    const control: OrganizationControl = {
      id: this.createId("org-control"),
      organizationId: input.organizationId,
      frameworkId: input.frameworkId,
      controlId: input.controlId,
      status: input.status || "not_started",
      ownerIds: [],
      notes: [],
      comments: [],
      auditHistory: [this.createAuditEvent("control_tracking_started", "organizationControl", input.controlId)],
      createdAt: now,
      updatedAt: now,
    };

    this.workspace.controls.push(control);
    return control;
  }

  /** Assigns an owner to an organization control. */
  assignOwnerToControl(organizationId: string, frameworkId: string, controlId: string, ownerId: string): OrganizationControl {
    this.assertOwner(organizationId, ownerId);
    const control = this.trackControlStatus({ organizationId, frameworkId, controlId });

    if (!control.ownerIds.includes(ownerId)) {
      control.ownerIds.push(ownerId);
      control.updatedAt = new Date().toISOString();
      control.auditHistory.push(this.createAuditEvent("owner_assigned", "organizationControl", control.id, { ownerId }));
    }

    return control;
  }

  /** Creates an owner record scoped to one organization. */
  createOwner(input: Omit<OrganizationOwner, "id" | "createdAt" | "updatedAt"> & { id?: string }): OrganizationOwner {
    this.assertOrganization(input.organizationId);
    const now = new Date().toISOString();
    const owner: OrganizationOwner = {
      ...input,
      id: input.id || this.createId("owner"),
      createdAt: now,
      updatedAt: now,
    };
    this.workspace.owners.push(owner);
    return owner;
  }

  /** Records organization evidence against a framework evidence requirement. */
  recordEvidence(input: {
    organizationId: string;
    frameworkId: string;
    evidenceRequirementId: string;
    relatedControlIds?: string[];
    fileName?: string;
    fileUrl?: string;
    uploadedBy?: string;
    status?: EvidenceStatus;
  }): OrganizationEvidence {
    this.requireOrganizationFramework(input.organizationId, input.frameworkId);
    const now = new Date().toISOString();
    const evidence: OrganizationEvidence = {
      id: this.createId("org-evidence"),
      organizationId: input.organizationId,
      frameworkId: input.frameworkId,
      evidenceRequirementId: input.evidenceRequirementId,
      relatedControlIds: input.relatedControlIds || [],
      fileName: input.fileName,
      fileUrl: input.fileUrl,
      status: input.status || "uploaded",
      uploadedBy: input.uploadedBy,
      uploadedAt: input.fileName || input.fileUrl ? now : undefined,
      notes: [],
      comments: [],
      auditHistory: [this.createAuditEvent("evidence_recorded", "organizationEvidence", input.evidenceRequirementId)],
      createdAt: now,
      updatedAt: now,
    };
    this.workspace.evidence.push(evidence);
    return evidence;
  }

  /** Updates evidence review status. */
  updateEvidenceStatus(evidenceId: string, status: EvidenceStatus): OrganizationEvidence {
    const evidence = this.requireEvidence(evidenceId);
    evidence.status = status;
    evidence.updatedAt = new Date().toISOString();
    evidence.auditHistory.push(this.createAuditEvent("evidence_status_updated", "organizationEvidence", evidenceId, { status }));
    return evidence;
  }

  /** Creates an organization task from a framework task template or manual implementation need. */
  createTask(input: CreateTaskInput): OrganizationTask {
    this.requireOrganizationFramework(input.organizationId, input.frameworkId);
    const now = new Date().toISOString();
    const task: OrganizationTask = {
      id: this.createId("org-task"),
      organizationId: input.organizationId,
      frameworkId: input.frameworkId,
      taskTemplateId: input.taskTemplateId,
      title: input.title,
      status: "open",
      priority: input.priority || "medium",
      ownerIds: input.ownerIds || [],
      relatedControlIds: input.relatedControlIds || [],
      dueDate: input.dueDate,
      notes: [],
      comments: [],
      auditHistory: [this.createAuditEvent("task_created", "organizationTask", input.title)],
      createdAt: now,
      updatedAt: now,
    };
    this.workspace.tasks.push(task);
    return task;
  }

  /** Updates organization task status. */
  updateTaskStatus(taskId: string, status: TaskStatus): OrganizationTask {
    const task = this.requireTask(taskId);
    task.status = status;
    task.updatedAt = new Date().toISOString();
    task.auditHistory.push(this.createAuditEvent("task_status_updated", "organizationTask", taskId, { status }));
    return task;
  }

  /** Creates or updates organization-specific risk tracking for a framework risk. */
  trackRiskStatus(organizationId: string, frameworkId: string, riskId: string, status: ImplementationStatus): OrganizationRisk {
    this.requireOrganizationFramework(organizationId, frameworkId);
    const now = new Date().toISOString();
    const existing = this.workspace.risks.find(
      (risk) => risk.organizationId === organizationId && risk.frameworkId === frameworkId && risk.riskId === riskId,
    );

    if (existing) {
      existing.status = status;
      existing.updatedAt = now;
      existing.auditHistory.push(this.createAuditEvent("risk_status_updated", "organizationRisk", existing.id, { status }));
      return existing;
    }

    const risk: OrganizationRisk = {
      id: this.createId("org-risk"),
      organizationId,
      frameworkId,
      riskId,
      status,
      ownerIds: [],
      notes: [],
      comments: [],
      auditHistory: [this.createAuditEvent("risk_tracking_started", "organizationRisk", riskId)],
      createdAt: now,
      updatedAt: now,
    };
    this.workspace.risks.push(risk);
    return risk;
  }

  /** Adds a note to any supported organization entity. */
  addNote(entityType: "framework" | "control" | "evidence" | "task" | "risk", entityId: string, body: string, authorId?: string): Note {
    const entity = this.requireEntityWithNotes(entityType, entityId);
    const now = new Date().toISOString();
    const note: Note = { id: this.createId("note"), body, authorId, createdAt: now, updatedAt: now };
    entity.notes.push(note);
    entity.auditHistory.push(this.createAuditEvent("note_added", entityType, entityId));
    entity.updatedAt = now;
    return note;
  }

  /** Adds a comment to any supported implementation entity with comments. */
  addComment(entityType: "control" | "evidence" | "task" | "risk", entityId: string, body: string, authorId?: string): Comment {
    const entity = this.requireEntityWithComments(entityType, entityId);
    const now = new Date().toISOString();
    const comment: Comment = { id: this.createId("comment"), body, authorId, createdAt: now, updatedAt: now };
    entity.comments.push(comment);
    entity.auditHistory.push(this.createAuditEvent("comment_added", entityType, entityId));
    entity.updatedAt = now;
    return comment;
  }

  /** Calculates implementation progress for an organization and assigned framework. */
  calculateProgress(organizationId: string, frameworkId: string): OrganizationProgress {
    this.requireOrganizationFramework(organizationId, frameworkId);
    const controls = this.workspace.controls.filter((control) => control.organizationId === organizationId && control.frameworkId === frameworkId);
    const evidence = this.workspace.evidence.filter((item) => item.organizationId === organizationId && item.frameworkId === frameworkId);
    const tasks = this.workspace.tasks.filter((task) => task.organizationId === organizationId && task.frameworkId === frameworkId);
    const completedControls = controls.filter((control) => control.status === "implemented" || control.status === "not_applicable").length;
    const approvedEvidence = evidence.filter((item) => item.status === "approved").length;
    const completedTasks = tasks.filter((task) => task.status === "done" || task.status === "archived").length;

    const controlCompletionPercent = this.percent(completedControls, controls.length);
    const evidenceCompletionPercent = this.percent(approvedEvidence, evidence.length);
    const taskCompletionPercent = this.percent(completedTasks, tasks.length);

    return {
      organizationId,
      frameworkId,
      totalControls: controls.length,
      completedControls,
      controlCompletionPercent,
      totalEvidence: evidence.length,
      approvedEvidence,
      evidenceCompletionPercent,
      totalTasks: tasks.length,
      completedTasks,
      taskCompletionPercent,
      overallCompletionPercent: Math.round((controlCompletionPercent + evidenceCompletionPercent + taskCompletionPercent) / 3),
    };
  }

  /** Returns dashboard-ready records for all frameworks assigned to an organization. */
  getOrganizationDashboard(organizationId: string): OrganizationProgress[] {
    this.assertOrganization(organizationId);
    return this.workspace.frameworks
      .filter((framework) => framework.organizationId === organizationId)
      .map((framework) => this.calculateProgress(organizationId, framework.frameworkId));
  }

  private percent(done: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((done / total) * 100);
  }

  private assertOrganization(organizationId: string): void {
    if (!this.workspace.organizations.some((organization) => organization.id === organizationId)) {
      throw new Error(`Organization not found: ${organizationId}`);
    }
  }

  private assertOwner(organizationId: string, ownerId: string): void {
    if (!this.workspace.owners.some((owner) => owner.organizationId === organizationId && owner.id === ownerId)) {
      throw new Error(`Owner not found: ${ownerId}`);
    }
  }

  private requireOrganizationFramework(organizationId: string, frameworkId: string): OrganizationFramework {
    this.assertOrganization(organizationId);
    const framework = this.workspace.frameworks.find(
      (item) => item.organizationId === organizationId && item.frameworkId === frameworkId,
    );
    if (!framework) throw new Error(`Framework is not assigned to organization: ${frameworkId}`);
    return framework;
  }

  private requireEvidence(evidenceId: string): OrganizationEvidence {
    const evidence = this.workspace.evidence.find((item) => item.id === evidenceId);
    if (!evidence) throw new Error(`Evidence not found: ${evidenceId}`);
    return evidence;
  }

  private requireTask(taskId: string): OrganizationTask {
    const task = this.workspace.tasks.find((item) => item.id === taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    return task;
  }

  private requireEntityWithNotes(entityType: "framework" | "control" | "evidence" | "task" | "risk", entityId: string) {
    const entity = this.findEntity(entityType, entityId);
    if (!entity) throw new Error(`Entity not found: ${entityType}:${entityId}`);
    return entity;
  }

  private requireEntityWithComments(entityType: "control" | "evidence" | "task" | "risk", entityId: string) {
    const entity = this.findEntity(entityType, entityId);
    if (!entity || !("comments" in entity)) throw new Error(`Entity not found: ${entityType}:${entityId}`);
    return entity;
  }

  private findEntity(entityType: "framework" | "control" | "evidence" | "task" | "risk", entityId: string) {
    const collections = {
      framework: this.workspace.frameworks,
      control: this.workspace.controls,
      evidence: this.workspace.evidence,
      task: this.workspace.tasks,
      risk: this.workspace.risks,
    };
    return collections[entityType].find((entity) => entity.id === entityId);
  }

  private createAuditEvent(action: string, entityType: string, entityId: string, metadata?: Record<string, unknown>): AuditEvent {
    return {
      id: this.createId("audit"),
      action,
      entityType,
      entityId,
      metadata,
      createdAt: new Date().toISOString(),
    };
  }

  private createId(prefix: string): string {
    return `${prefix}-${crypto.randomUUID()}`;
  }
}

