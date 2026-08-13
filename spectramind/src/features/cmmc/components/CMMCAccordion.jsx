import { ChevronDown } from "lucide-react";
import { useState } from "react";

export default function CMMCAccordion({
  items = [],
  defaultOpenItems = [],
  allowMultiple = true,
}) {
  const [openItemIds, setOpenItemIds] = useState(defaultOpenItems);

  const toggleItem = (itemId) => {
    setOpenItemIds((currentItems) => {
      if (currentItems.includes(itemId)) {
        return currentItems.filter((currentItemId) => currentItemId !== itemId);
      }

      return allowMultiple ? [...currentItems, itemId] : [itemId];
    });
  };

  return (
    <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
      {items.map((item) => {
        const isOpen = openItemIds.includes(item.id);

        return (
          <div key={item.id}>
            <button
              type="button"
              onClick={() => toggleItem(item.id)}
              className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left text-sm font-black text-slate-800 transition hover:bg-slate-50"
              aria-expanded={isOpen}
            >
              <span>{item.title}</span>
              <ChevronDown
                size={17}
                className={`shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
              />
            </button>

            {isOpen && (
              <div className="px-4 pb-4 text-sm font-semibold leading-6 text-slate-600">
                {item.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
