import CMMCHeader from "./CMMCHeader";
import CMMCImplementationLayout from "./CMMCImplementationLayout";

export default function CMMCPageLayout({
  eyebrow,
  title,
  description,
  actions,
  children,
}) {
  return (
    <CMMCImplementationLayout>
      <div className="space-y-6">
        <CMMCHeader
          eyebrow={eyebrow}
          title={title}
          description={description}
          actions={actions}
        />
        {children}
      </div>
    </CMMCImplementationLayout>
  );
}
