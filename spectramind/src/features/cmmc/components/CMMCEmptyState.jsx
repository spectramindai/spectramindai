import { FileText } from "lucide-react";

export default function CMMCEmptyState({
  icon: Icon = FileText,
  title = "Nothing to show yet",
  description = "This workspace section is ready for its next implementation pass.",
  actions,
}) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-[#fffdf8]/62 px-6 py-10 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg border border-blue-600/20 bg-blue-50 text-blue-700">
        <Icon size={23} />
      </div>
      <h3 className="mt-4 text-lg font-black text-slate-900">
        {title}
      </h3>
      <p className="mx-auto mt-2 max-w-xl text-sm font-semibold leading-6 text-slate-500">
        {description}
      </p>

      {actions && (
        <div className="mt-5 flex justify-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
