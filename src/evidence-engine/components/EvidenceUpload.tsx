import { useCallback, useState } from "react";
import type { EvidenceUploadInput } from "../models";

export interface EvidenceUploadProps {
  organizationId: string;
  onUpload: (input: EvidenceUploadInput) => void;
}

/** Provides drag-and-drop and browse upload for evidence files. */
export function EvidenceUpload({ organizationId, onUpload }: EvidenceUploadProps) {
  const [dragging, setDragging] = useState(false);

  const uploadFiles = useCallback(
    (files: FileList | File[]) => {
      Array.from(files).forEach((file) => onUpload({ organizationId, file }));
    },
    [onUpload, organizationId],
  );

  return (
    <label
      className={`block rounded-lg border border-dashed p-6 text-center transition ${
        dragging ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-white"
      }`}
      onDragEnter={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        uploadFiles(event.dataTransfer.files);
      }}
    >
      <input className="sr-only" type="file" multiple onChange={(event) => event.target.files && uploadFiles(event.target.files)} />
      <span className="text-sm font-medium text-slate-900">Drop evidence files here</span>
      <span className="mt-1 block text-sm text-slate-500">or browse from your device</span>
    </label>
  );
}

