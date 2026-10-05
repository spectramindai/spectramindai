import {
  ArrowLeft,
  Check,
  ChevronDown,
  FileText,
  UploadCloud,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import { loadQuestionnaireResponses } from "../data/questionnaireEngine";
import { useQuestionnaireSections } from "../core/adapters/useQuestionnaireData";
import { saveOrgQuestionnaireAnswers } from "../core/adapters/useOrganizationStore";
import {
  ISO27001_FRAMEWORK_ID,
  resolveFrameworkId,
} from "../core/engines/framework-engine/frameworkRegistry";
import ActiveFrameworkRequired from "../framework/ActiveFrameworkRequired";
import { frameworkHasLibrary, useFrameworkWorkspace } from "../framework/FrameworkWorkspaceContext";
import { isApiEnabled } from "../api/client";
import { createQuestionnaireRun, loadApiQuestionnaire, saveQuestionnaireAnswer, submitQuestionnaireRun } from "../api/questionnaires";

export default function Questionnaire() {
  const frameworkWorkspace = useFrameworkWorkspace();
  const { activeFramework } = frameworkWorkspace;
  const navigate = useNavigate();
  const handleFrameworkSelect = (framework) => {
    frameworkWorkspace.setActiveFramework(framework.id);
    navigate(`/questionnaire?framework=${framework.slug}`);
  };

  if (!activeFramework) {
    return <ActiveFrameworkRequired />;
  }

  if (activeFramework.slug === "cmmc") {
    return (
      <AppShell>
        <div className="max-w-3xl space-y-5">
          <QuestionnaireHeader
            activeFramework={activeFramework}
            frameworks={frameworkWorkspace.selectedFrameworks}
            onFrameworkSelect={handleFrameworkSelect}
          />
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">
              This framework uses its built-in assessment.
            </h1>
            <Link
              to="/cmmc"
              className="mt-5 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
            >
              Open CMMC Assessment
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <QuestionnaireContent
      key={activeFramework.id}
      activeFramework={activeFramework}
      frameworks={frameworkWorkspace.selectedFrameworks}
      onFrameworkSelect={handleFrameworkSelect}
    />
  );
}

function QuestionnaireContent({ activeFramework, frameworks, onFrameworkSelect }) {
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const selectedFrameworkId = resolveFrameworkId(activeFramework.id) || activeFramework.id;
  const selectedQuestionnaireId = params.get("questionnaire");
  const activeSections = useQuestionnaireSections(selectedFrameworkId);
  const isISO27001 = selectedFrameworkId === ISO27001_FRAMEWORK_ID;

  return (
    <AppShell>
      {isISO27001 ? (
        <SectionQuestionnaire
          key={`${selectedFrameworkId}:${selectedQuestionnaireId || "landing"}`}
          frameworkId={selectedFrameworkId}
          activeFramework={activeFramework}
          sections={activeSections}
          selectedQuestionnaireId={selectedQuestionnaireId}
          frameworks={frameworks}
          onFrameworkSelect={onFrameworkSelect}
        />
      ) : (
        <CombinedQuestionnaire
          key={selectedFrameworkId}
          frameworkId={selectedFrameworkId}
          activeFramework={activeFramework}
          sections={activeSections}
          frameworks={frameworks}
          onFrameworkSelect={onFrameworkSelect}
        />
      )}
    </AppShell>
  );
}

function CombinedQuestionnaire({ frameworkId, activeFramework, sections, frameworks, onFrameworkSelect }) {
  const { responses, updateResponse, submit, loading, error } = useApiQuestionnaire(frameworkId);
  const questionRefs = useRef({});
  const questions = useMemo(() => flattenQuestionnaireSections(sections), [sections]);
  const answerableQuestions = useMemo(() => collectAnswerableQuestions(questions), [questions]);
  const answeredCount = answerableQuestions.filter((question) => isQuestionAnswered(question, responses)).length;
  const totalCount = answerableQuestions.length;
  const progress = totalCount ? Math.round((answeredCount / totalCount) * 100) : 0;
  const nextQuestion = questions.find((question) => !isQuestionGroupAnswered(question, responses));

  const goToNextQuestion = () => {
    if (!nextQuestion) return;
    questionRefs.current[nextQuestion.key]?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="max-w-3xl space-y-5">
      <QuestionnaireHeader
        activeFramework={activeFramework}
        frameworks={frameworks}
        onFrameworkSelect={onFrameworkSelect}
      />

      {error && <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}
      {loading && <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">Loading questionnaire...</p>}

      <section className="rounded-lg border border-white/75 bg-white/70 p-5 shadow-lg shadow-slate-900/5 backdrop-blur">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-black text-slate-950">
              Overall progress
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              {answeredCount} / {totalCount} questions answered
            </p>
          </div>
          <button
            type="button"
            onClick={goToNextQuestion}
            disabled={!nextQuestion}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-amber-700 px-5 text-sm font-black text-white shadow-sm shadow-amber-700/20 transition hover:bg-amber-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
          >
            {nextQuestion ? "Next" : "Completed"}
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-amber-700 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="w-10 text-right text-xs font-black text-slate-700">{progress}%</span>
        </div>

        {!nextQuestion && totalCount > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" onClick={submit} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-black text-white">Submit questionnaire</button>
            <CompletionImplementationLink activeFramework={activeFramework} />
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        {questions.length ? (
          questions.map((question, index) => (
            <QuestionCard
              key={question.key}
              refCallback={(node) => {
                if (node) questionRefs.current[question.key] = node;
              }}
              question={question}
              questionNumber={index + 1}
              responses={responses}
              updateResponse={updateResponse}
            />
          ))
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3 text-xs font-semibold leading-5 text-stone-500">
            Questionnaires are not required for this framework.
          </div>
        )}
      </section>
    </div>
  );
}

function SectionQuestionnaire({
  frameworkId,
  activeFramework,
  sections,
  selectedQuestionnaireId,
  frameworks,
  onFrameworkSelect,
}) {
  const selectedSection = selectedQuestionnaireId
    ? sections.find((section) => section.id === selectedQuestionnaireId) ?? sections[0]
    : null;

  if (selectedSection) {
    return (
      <SectionQuestionnaireDetail
        frameworkId={frameworkId}
        activeFramework={activeFramework}
        section={selectedSection}
        frameworks={frameworks}
        onFrameworkSelect={onFrameworkSelect}
      />
    );
  }

  return (
    <div className="max-w-3xl space-y-5">
      <QuestionnaireHeader
        activeFramework={activeFramework}
        frameworks={frameworks}
        onFrameworkSelect={onFrameworkSelect}
        description="Please complete each questionnaire section before a compliance expert can start working on your account."
      />

      <SectionQuestionnaireGroup
        frameworkId={frameworkId}
        activeFramework={activeFramework}
        sections={sections}
      />
    </div>
  );
}

function SectionQuestionnaireGroup({ frameworkId, activeFramework, sections }) {
  const { responses } = useApiQuestionnaire(frameworkId);
  const [isExpanded, setIsExpanded] = useState(true);
  const allSectionsComplete = sections.length > 0 && sections.every((section) => getSectionStatus(section, responses).completed);

  return (
    <section className="space-y-2">
      <button
        type="button"
        onClick={() => setIsExpanded((current) => !current)}
        className="flex items-center gap-2"
        aria-expanded={isExpanded}
      >
        <ChevronDown
          size={13}
          className={`text-slate-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}
        />
        <h2 className="text-base font-bold leading-6 tracking-normal text-slate-950">{activeFramework.name}</h2>
      </button>

      {isExpanded ? (
        <div className="overflow-hidden rounded-md border border-amber-200 bg-amber-50/70">
          {sections.length ? (
            sections.map((section) => {
              const status = getSectionStatus(section, responses);

              return (
                <Link
                  key={section.id}
                  to={`/questionnaire?framework=${activeFramework.slug}&questionnaire=${section.id}`}
                  className="flex items-center justify-between gap-4 border-b border-amber-100 bg-amber-50/50 px-4 py-3 transition last:border-b-0 hover:bg-amber-50"
                >
                  <span>
                    <span className="block text-xs font-bold leading-5 text-slate-800">{section.title}</span>
                    <span className="block text-xs font-medium leading-4 text-slate-500">
                      {status.completed
                        ? "This questionnaire is successfully completed."
                        : `${status.answered}/${status.total} questions completed.`}
                    </span>
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-bold ${
                      status.completed
                        ? "border-amber-200 bg-amber-50 text-amber-900"
                        : "border-amber-300 bg-amber-50 text-amber-900"
                    }`}
                  >
                    <FileText size={13} />
                    {status.completed ? "Completed" : "Start"}
                  </span>
                </Link>
              );
            })
          ) : (
            <div className="bg-amber-50/60 px-4 py-3 text-xs font-semibold leading-5 text-stone-500">
              Questionnaires are not required for this framework.
            </div>
          )}
        </div>
      ) : null}
      {allSectionsComplete ? (
        <CompletionImplementationLink activeFramework={activeFramework} />
      ) : null}
    </section>
  );
}

function SectionQuestionnaireDetail({ frameworkId, activeFramework, section, frameworks, onFrameworkSelect }) {
  const { responses, updateResponse, submit, error } = useApiQuestionnaire(frameworkId);
  const [isQuestionsExpanded, setIsQuestionsExpanded] = useState(true);
  const status = getSectionStatus(section, responses);
  const progress = status.total ? Math.round((status.answered / status.total) * 100) : 0;

  return (
    <div className="max-w-3xl space-y-4">
      <header className="space-y-4">
        <QuestionnaireHeader
          activeFramework={activeFramework}
          frameworks={frameworks}
          onFrameworkSelect={onFrameworkSelect}
          title={section.title}
          description="Complete this questionnaire section, then return to choose the next section."
        />
        <Link
          to={`/questionnaire?framework=${activeFramework.slug}`}
          className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-blue-700"
        >
          <ArrowLeft size={13} />
          Back to Questionnaires
        </Link>
      </header>

      <div className="flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-amber-700 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs font-bold text-slate-700">{progress}%</span>
      </div>

      {status.completed ? (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={submit} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-black text-white">Submit questionnaire</button>
          <CompletionImplementationLink activeFramework={activeFramework} />
        </div>
      ) : null}
      {error && <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}

      <section className="space-y-3">
        <button
          type="button"
          onClick={() => setIsQuestionsExpanded((current) => !current)}
          className="flex w-full items-center justify-between border-b border-slate-200 pb-2"
          aria-expanded={isQuestionsExpanded}
        >
          <span className="inline-flex items-center gap-2">
            <ChevronDown
              size={13}
              className={`text-slate-500 transition-transform ${isQuestionsExpanded ? "rotate-180" : ""}`}
            />
            <h2 className="text-lg font-bold leading-6 tracking-normal text-slate-950">Questions</h2>
          </span>
          {status.completed ? <Check size={15} className="text-blue-600" /> : null}
        </button>

        {isQuestionsExpanded
          ? section.questions.map((question) => (
              <QuestionCard
                key={question.key}
                question={question}
                responses={responses}
                updateResponse={updateResponse}
              />
            ))
          : null}
      </section>
    </div>
  );
}

function useApiQuestionnaire(frameworkId) {
  const [responses, setResponses] = useState(() => loadQuestionnaireResponses(frameworkId));
  const [runId, setRunId] = useState("");
  const [loading, setLoading] = useState(isApiEnabled);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isApiEnabled) return;
    let cancelled = false;
    Promise.all([loadApiQuestionnaire(frameworkId), createQuestionnaireRun(frameworkId)])
      .then(([snapshot, draft]) => {
        if (cancelled) return;
        setRunId(draft.id);
        const sourceAnswers = snapshot.run?.id === draft.id ? snapshot.run.answers || [] : [];
        const nextResponses = Object.fromEntries(sourceAnswers.map((answer) => [answer.questionId, answer.value]));
        setResponses(nextResponses);
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError.message || "Could not load questionnaire");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [frameworkId]);

  const updateResponse = useCallback((key, value) => {
    setResponses((current) => {
      const nextResponses = { ...current, [key]: value };
      if (!isApiEnabled) saveOrgQuestionnaireAnswers(nextResponses, frameworkId);
      return nextResponses;
    });
    if (isApiEnabled && runId) {
      saveQuestionnaireAnswer(runId, key, value).catch((requestError) => setError(requestError.message || "Could not save answer"));
    }
  }, [frameworkId, runId]);

  const submit = useCallback(async () => {
    if (!isApiEnabled || !runId) return;
    setError("");
    try { await submitQuestionnaireRun(runId); }
    catch (requestError) { setError(requestError.message || "Could not submit questionnaire"); }
  }, [runId]);

  return { responses, updateResponse, submit, loading, error };
}

function QuestionnaireHeader({
  activeFramework,
  frameworks = [],
  onFrameworkSelect,
  title = "Questionnaires",
  description = "All questionnaire questions are shown below with one combined progress tracker.",
}) {
  return (
    <header className="rounded-lg border border-white/75 bg-white/70 p-5 shadow-lg shadow-slate-900/5 backdrop-blur-2xl">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-black uppercase tracking-widest text-amber-700">
            Questionnaire
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-normal text-slate-950">
            {title}
          </h1>
          <p className="mt-2 text-sm font-semibold leading-5 text-slate-500">
            {activeFramework.name}
          </p>
          <p className="mt-1 max-w-2xl text-xs font-medium leading-5 text-slate-500">
            {description}
          </p>
        </div>

        <FrameworkSwitcher
          activeSlug={activeFramework.slug}
          frameworks={frameworks}
          onSelect={onFrameworkSelect}
        />
      </div>
    </header>
  );
}

function FrameworkSwitcher({ activeSlug, frameworks = [], onSelect }) {
  const questionnaireFrameworks = getQuestionnaireFrameworkOptions(frameworks);

  return (
    <div className="inline-flex w-fit flex-wrap items-center gap-1 rounded-lg border border-slate-200/80 bg-white/75 p-1 shadow-sm lg:flex-nowrap lg:justify-end">
      {questionnaireFrameworks.map((framework) => {
        const isActive = framework.slug === activeSlug;

        return (
          <button
            key={framework.id}
            type="button"
            onClick={() => onSelect(framework)}
            className={`inline-flex h-9 min-w-[88px] items-center justify-center whitespace-nowrap rounded-md px-3 text-sm font-black transition ${
              isActive
                ? "bg-amber-700 text-white shadow-sm shadow-amber-700/20"
                : "text-slate-600 hover:bg-white hover:text-slate-950"
            }`}
            aria-pressed={isActive}
          >
            {framework.shortName || framework.name}
          </button>
        );
      })}
    </div>
  );
}

function getQuestionnaireFrameworkOptions(frameworks = []) {
  return frameworks.filter((framework) => framework.slug === "cmmc" || frameworkHasLibrary(framework.id));
}

function CompletionImplementationLink({ activeFramework, className = "" }) {
  const target = activeFramework.slug === "cmmc" ? "/cmmc" : `/implementation?framework=${activeFramework.slug}`;

  return (
    <div className={`rounded-lg border border-emerald-200 bg-emerald-50/70 p-4 ${className}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black text-emerald-900">
            Questionnaire complete
          </p>
          <p className="mt-1 text-xs font-semibold text-emerald-700">
            Continue into implementation for {activeFramework.name}.
          </p>
        </div>
        <Link
          to={target}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-700 px-4 text-sm font-black text-white shadow-sm shadow-emerald-700/20 transition hover:bg-emerald-800"
        >
          Open Implementation
        </Link>
      </div>
    </div>
  );
}

function QuestionCard({ question, questionNumber, refCallback, responses, updateResponse }) {
  const answered = isQuestionAnswered(question, responses);

  return (
    <article ref={refCallback} className="rounded-lg border border-sky-100 bg-sky-50/70 p-4 shadow-sm shadow-slate-900/5 scroll-mt-28">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-sky-100 pb-3">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-amber-700">
            Question {questionNumber}
          </p>
          {question.sectionTitle ? (
            <p className="mt-1 text-xs font-semibold text-slate-500">{question.sectionTitle}</p>
          ) : null}
        </div>
        {isQuestionGroupAnswered(question, responses) ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1 text-xs font-black text-blue-700">
            <Check size={13} />
            Answered
          </span>
        ) : null}
      </div>
      <QuestionPrompt question={question} answered={answered} />
      <QuestionInput question={question} responses={responses} updateResponse={updateResponse} />

      {question.subQuestions?.length ? (
        <div className="mt-3 space-y-3 border-t border-sky-100 pt-3">
          {question.subQuestions.map((subQuestion) => (
            <div key={subQuestion.key} className="rounded-md border border-sky-100 bg-sky-50/60 p-3">
              <QuestionPrompt question={subQuestion} answered={isQuestionAnswered(subQuestion, responses)} compact />
              <QuestionInput question={subQuestion} responses={responses} updateResponse={updateResponse} />
            </div>
          ))}
        </div>
      ) : null}

      {question.uploadEnabled ? <UploadBlock question={question} responses={responses} updateResponse={updateResponse} /> : null}
    </article>
  );
}

function QuestionPrompt({ question, answered, compact = false }) {
  return (
    <div className="mb-2.5 flex items-start justify-between gap-4">
      <div className="space-y-1.5">
        <p className={`${compact ? "text-xs" : "text-sm"} font-bold leading-5 text-slate-800`}>
          {question.required ? <span className="mr-0.5 text-red-500">*</span> : null}
          {question.label}
        </p>
        {question.helpText ? (
          <p className="whitespace-pre-line text-xs font-medium leading-5 text-slate-600">{question.helpText}</p>
        ) : null}
        {question.description ? (
          <p className="text-xs font-medium leading-5 text-slate-500">{question.description}</p>
        ) : null}
      </div>
      {answered ? <Check size={15} className="mt-1 shrink-0 text-blue-600" /> : null}
    </div>
  );
}

function QuestionInput({ question, responses, updateResponse }) {
  if (question.type === "radio") {
    return (
      <div className="flex flex-wrap gap-3">
        {question.options.map((option) => (
          <label key={option} className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
            <input
              type="radio"
              name={question.key}
              checked={responses[question.key] === option}
              onChange={() => updateResponse(question.key, option)}
              className="h-3.5 w-3.5 border-slate-300 text-blue-700 focus:ring-blue-500"
            />
            {option}
          </label>
        ))}
      </div>
    );
  }

  if (question.type === "checkbox") {
    const selected = Array.isArray(responses[question.key]) ? responses[question.key] : [];

    return (
      <div className="grid gap-2">
        {question.options.map((option) => (
          <label key={option} className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
            <input
              type="checkbox"
              checked={selected.includes(option)}
              onChange={() => {
                const nextValue = selected.includes(option)
                  ? selected.filter((item) => item !== option)
                  : [...selected, option];
                updateResponse(question.key, nextValue);
              }}
              className="h-3.5 w-3.5 rounded border-slate-300 text-blue-700 focus:ring-blue-500"
            />
            {option}
          </label>
        ))}
      </div>
    );
  }

  if (question.type === "system_table") {
    return <SystemTable question={question} value={responses[question.key]} onChange={(value) => updateResponse(question.key, value)} />;
  }

  if (question.type === "file") {
    return <UploadBlock question={question} responses={responses} updateResponse={updateResponse} standalone />;
  }

  if (question.type === "text") {
    return (
      <input
        value={responses[question.key] || ""}
        onChange={(event) => updateResponse(question.key, event.target.value)}
        placeholder={question.placeholder || "Type your answer"}
        className="h-10 w-full rounded-md border border-sky-100 bg-white/70 px-3 text-xs font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white"
      />
    );
  }

  return (
    <textarea
      value={responses[question.key] || ""}
      onChange={(event) => updateResponse(question.key, event.target.value)}
      placeholder={question.placeholder || "Type your answer"}
      rows={3}
      className="min-h-20 w-full resize-y rounded-md border border-sky-100 bg-white/70 px-3 py-2.5 text-xs font-medium leading-5 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white"
    />
  );
}

function UploadBlock({ question, responses, updateResponse, standalone = false }) {
  const uploadKey = `${question.key}__files`;
  const files = Array.isArray(responses[uploadKey]) ? responses[uploadKey] : [];

  return (
    <div className={standalone ? "" : "mt-4"}>
      <p className="mb-2 text-xs font-bold text-slate-700">Please upload files if needed</p>
      <label className="flex min-h-20 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-amber-200 bg-amber-50/60 px-3 py-4 text-center transition hover:border-amber-300 hover:bg-amber-50">
        <UploadCloud size={18} className="mb-2 text-slate-500" />
        <span className="text-xs font-semibold text-slate-600">Drag your file(s) here or Browse</span>
        <span className="mt-1 text-xs font-medium text-slate-400">You can upload up to 10 files</span>
        <input
          type="file"
          multiple
          className="sr-only"
          onChange={(event) => {
            const selectedFiles = Array.from(event.target.files ?? []).map((file) => file.name);
            updateResponse(uploadKey, [...files, ...selectedFiles].slice(0, 10));
            event.target.value = "";
          }}
        />
      </label>
      {files.length ? (
        <div className="mt-3 grid gap-2">
          {files.map((fileName) => (
            <div key={fileName} className="rounded-md border border-amber-100 bg-amber-50/60 px-3 py-2 text-xs font-semibold text-slate-600">
              {fileName}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SystemTable({ question, value, onChange }) {
  const fields = question.fields?.length ? question.fields : ["System Name", "Description"];
  const rows = Array.isArray(value) && value.length ? value : [createEmptySystem(fields)];

  const updateCell = (rowIndex, field, nextValue) => {
    const nextRows = rows.map((row, index) => (index === rowIndex ? { ...row, [field]: nextValue } : row));
    onChange(nextRows);
  };

  return (
    <div className="space-y-3">
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="overflow-hidden rounded-md border border-sky-100 bg-white/70">
          <div className="flex items-center justify-between border-b border-sky-100 bg-sky-50/70 px-3 py-2">
            <p className="text-xs font-bold text-slate-700">System #{rowIndex + 1}</p>
            <button type="button" className="text-xs font-semibold text-slate-500 hover:text-blue-700">
              Edit
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {fields.map((field) => (
              <label key={field} className="grid gap-2 px-3 py-2.5 md:grid-cols-[190px_1fr] md:items-start">
                <span className="text-xs font-bold leading-5 text-slate-700">{field}</span>
                <textarea
                  rows={field === "System Usage Description" || field === "Client Service Impact by the System" ? 2 : 1}
                  value={row[field] || ""}
                  onChange={(event) => updateCell(rowIndex, field, event.target.value)}
                  className="min-h-8 resize-y rounded-md border border-transparent bg-transparent text-xs font-medium leading-5 text-slate-700 outline-none focus:border-sky-100 focus:bg-white/70"
                />
              </label>
            ))}
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rows, createEmptySystem(fields)])}
        className="w-full rounded-md border border-dashed border-sky-100 bg-white/60 px-3 py-2.5 text-xs font-bold text-slate-500 transition hover:border-blue-400 hover:text-blue-700"
      >
        + Add System
      </button>
    </div>
  );
}

function createEmptySystem(fields) {
  return fields.reduce((system, field) => ({ ...system, [field]: "" }), {});
}

function flattenQuestionnaireSections(sections = []) {
  return sections.flatMap((section) =>
    (section.questions || []).map((question) => ({
      ...question,
      sectionId: section.id,
      sectionTitle: section.title,
    }))
  );
}

function collectAnswerableQuestions(questions = []) {
  return questions
    .flatMap((question) => [
      question,
      ...(question.subQuestions || []),
    ])
    .filter((question) => question.required !== false);
}

function isQuestionGroupAnswered(question, responses) {
  return collectAnswerableQuestions([question])
    .filter((candidate) => candidate.required !== false)
    .every((candidate) => isQuestionAnswered(candidate, responses));
}

function getSectionStatus(section, responses) {
  const questions = collectAnswerableQuestions(section.questions || []);
  const total = questions.length;
  const answered = questions.filter((question) => isQuestionAnswered(question, responses)).length;
  return {
    total,
    answered,
    completed: total > 0 && answered === total,
  };
}

function isQuestionAnswered(question, responses) {
  const value = responses[question.key];
  if (Array.isArray(value)) {
    if (question.type === "system_table") {
      return value.some((row) => Object.values(row).some((entry) => String(entry ?? "").trim()));
    }
    return value.length > 0;
  }
  return String(value ?? "").trim().length > 0;
}
