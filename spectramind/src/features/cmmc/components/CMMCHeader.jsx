export default function CMMCHeader({
  eyebrow = "CMMC Workspace",
  title,
  description,
  actions,
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        {eyebrow && (
          <p className="text-sm font-black uppercase tracking-widest text-blue-700">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-2 text-4xl font-black tracking-normal text-slate-900">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-slate-600">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
