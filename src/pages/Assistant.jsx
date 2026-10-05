import { Bot, Send, Sparkles } from "lucide-react";
import { useState } from "react";
import AppShell from "../components/layout/AppShell";

const prompts = [
  "Why is my SOC 2 score low?",
  "Which vendor reviews are due?",
  "Summarize open risks",
  "What evidence is missing?",
];

export default function Assistant() {
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState("");

  const analyze = () => {
    const q = question.toLowerCase();

    if (q.includes("soc2") || q.includes("soc 2") || q.includes("score")) {
      setResponse(
        "Your SOC 2 readiness is 81%. 12 controls are incomplete, Incident Response Testing is missing, and 3 vendor reviews are overdue."
      );
    } else if (q.includes("risk")) {
      setResponse("There are currently 3 open risks. The highest priority risk is an unpatched server.");
    } else if (q.includes("vendor")) {
      setResponse("AWS is low risk. GitHub and Google Workspace require review within the next quarter.");
    } else if (q.includes("evidence")) {
      setResponse(
        "124 evidence files have been uploaded. The Access Review and IAM Audit evidence are mapped to SOC 2 controls."
      );
    } else {
      setResponse("Try asking about SOC 2, risks, vendors, or evidence so I can return a focused insight.");
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-blue-600 dark:text-blue-300">
            AI Assistant
          </p>
          <h1 className="mt-2 text-4xl font-bold text-slate-950 dark:text-white">
            Compliance Assistant
          </h1>
          <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">
            Ask questions about controls, evidence, risks, and vendors to get quick guidance.
          </p>
        </div>

        <section className="rounded-2xl bg-slate-950 p-6 text-white dark:bg-blue-600">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white/10">
              <Bot size={26} />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Ask a compliance question</h2>
              <p className="mt-2 text-slate-300 dark:text-blue-100">
                The assistant uses demo workspace data to return practical compliance summaries.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex flex-wrap gap-2">
            {prompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => setQuestion(prompt)}
                className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-blue-950 dark:hover:text-blue-200"
              >
                {prompt}
              </button>
            ))}
          </div>

          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask about SOC 2, risks, vendors, or evidence..."
            className="h-40 w-full rounded-lg border border-slate-300 bg-white p-4 text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
          />

          <button
            type="button"
            onClick={analyze}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
          >
            Analyze
            <Send size={18} />
          </button>
        </section>

        {response && (
          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
                <Sparkles size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-950 dark:text-white">Analysis</h2>
                <p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">{response}</p>
              </div>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
