export interface UploadIntent {
  objectKey: string;
  uploadUrl: string;
  expiresAt: Date;
}

export interface FileStorage {
  createUploadIntent(input: { organizationId: string; evidenceId: string; versionId: string; fileName: string; contentType: string }): Promise<UploadIntent>;
  createDownloadUrl(objectKey: string): Promise<string>;
  delete(objectKey: string): Promise<void>;
}

export interface JobQueue {
  publish<T>(type: string, payload: T): Promise<void>;
}

export interface EmailSender {
  send(input: { to: string; subject: string; text: string }): Promise<void>;
}

// Cloud adapters can implement these ports with Azure Storage, Service Bus,
// and a transactional email provider. The demo uses a mounted Azure Files
// share through the existing local-filesystem evidence implementation.
