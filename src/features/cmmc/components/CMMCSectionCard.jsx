export default function CMMCSectionCard({
  as: Element = "section",
  title,
  description,
  actions,
  children,
  className = "",
}) {
  return (
    <Element className={`rounded-lg border border-white/75 bg-white/62 p-6 shadow-xl shadow-slate-900/5 backdrop-blur ${className}`}>
      {(title || description || actions) && (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {title && (
              <h2 className="text-xl font-black text-slate-900">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-1 text-sm font-semibold text-slate-500">
                {description}
              </p>
            )}
          </div>

          {actions && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {actions}
            </div>
          )}
        </div>
      )}

      {children}
    </Element>
  );
}
