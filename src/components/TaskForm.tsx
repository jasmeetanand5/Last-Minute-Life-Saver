import React, { useState } from "react";
import { PlusCircle, Sparkles, ChevronDown, ChevronUp, CheckCircle } from "lucide-react";
import { Task, CategoryType } from "../types";

interface TaskFormProps {
  onAddTask: (task: {
    title: string;
    deadline: string;
    estimatedEffort: number;
    category: CategoryType;
    notes: string;
    resourceLink?: string;
  }) => void;
}

const CATEGORIES: CategoryType[] = ["Work", "School", "Personal", "Other"];

export default function TaskForm({
  onAddTask,
}: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [estimatedEffort, setEstimatedEffort] = useState<string>("");
  const [category, setCategory] = useState<CategoryType>("Work");
  const [notes, setNotes] = useState("");
  const [resourceLink, setResourceLink] = useState("");
  const [showAdvance, setShowAdvance] = useState(false);
  const [error, setError] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  // Required fields validator helper
  const isFormValid = title.trim() !== "" && deadline !== "" && estimatedEffort !== "" && Number(estimatedEffort) > 0;

  const resetFields = () => {
    setTitle("");
    setDeadline("");
    setEstimatedEffort("");
    setCategory("Work");
    setNotes("");
    setResourceLink("");
    setError("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setShowSuccess(false);

    if (!title.trim()) {
      setError("Task title is required");
      return;
    }
    if (!deadline) {
      setError("Please set a deadline time");
      return;
    }
    if (estimatedEffort === "" || Number(estimatedEffort) <= 0) {
      setError("Please enter a valid estimated effort in hours");
      return;
    }

    const payload = {
      title: title.trim(),
      deadline: new Date(deadline).toISOString(),
      estimatedEffort: Number(estimatedEffort),
      category,
      notes: notes.trim(),
      resourceLink: resourceLink.trim(),
    };

    onAddTask(payload);
    resetFields();
    setShowSuccess(true);
    
    // Automatically hide success notification after a few seconds
    setTimeout(() => {
      setShowSuccess(false);
    }, 4000);
  };

  // Helper presets for single-click effort inputs
  const applyEffortPreset = (hours: number) => {
    setEstimatedEffort(hours.toString());
  };

  // Set default deadline to (Current Time + 24 hours) for fast onboarding
  const setQuickDeadline = (hoursAhead: number) => {
    const d = new Date();
    d.setHours(d.getHours() + hoursAhead);
    const tzoffset = d.getTimezoneOffset() * 60000;
    const localISOTime = new Date(d.getTime() - tzoffset).toISOString().slice(0, 16);
    setDeadline(localISOTime);
  };

  return (
    <div
      className="bg-white border border-gray-100 rounded-2xl p-5 shadow-xs"
      id="task-form-panel"
    >
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-50 font-sans">
        <div>
          <h3 className="font-display font-bold text-gray-900 text-base flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-blue-500" />
            <span>Log Incoming Danger</span>
          </h3>
          <p className="text-xs text-gray-400">
            Instantly map task details to calculate and secure your buffer.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-rose-50 text-rose-800 text-xs rounded-xl border border-rose-100 font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title Input */}
        <div className="space-y-1">
          <label htmlFor="task-title" className="text-xs font-semibold text-gray-700 block">
            Task Name / Objective <span className="text-rose-500">*</span>
          </label>
          <input
            id="task-title"
            type="text"
            className="w-full text-sm border border-gray-200 hover:border-gray-300 focus:border-slate-800 outline-hidden rounded-xl px-3.5 py-2.5 transition-colors focus:ring-1 focus:ring-slate-800"
            placeholder="e.g., Finalize Q3 Budget Slide, Physics Lab Report"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Deadline input */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label htmlFor="task-deadline" className="text-xs font-semibold text-gray-700 block">
                Deadline Time <span className="text-rose-500">*</span>
              </label>
              {/* Quick assistance */}
              <div className="flex gap-1.5 text-[10px] font-mono">
                <button
                  type="button"
                  onClick={() => setQuickDeadline(3)}
                  className="text-blue-600 hover:underline cursor-pointer"
                >
                  +3h
                </button>
                <span className="text-gray-350">|</span>
                <button
                  type="button"
                  onClick={() => setQuickDeadline(12)}
                  className="text-blue-600 hover:underline cursor-pointer"
                >
                  +12h
                </button>
                <span className="text-gray-350">|</span>
                <button
                  type="button"
                  onClick={() => setQuickDeadline(24)}
                  className="text-blue-600 hover:underline cursor-pointer"
                >
                  +24h
                </button>
              </div>
            </div>
            <input
              id="task-deadline"
              type="datetime-local"
              className="w-full text-sm border border-gray-200 hover:border-gray-300 focus:border-slate-800 outline-hidden rounded-xl px-3.5 py-2.5 transition-colors font-sans focus:ring-1 focus:ring-slate-800"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>

          {/* Effort input */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label htmlFor="task-effort" className="text-xs font-semibold text-gray-700 block">
                Estimated Work Effort <span className="text-rose-500">*</span>
              </label>
              {/* presets */}
              <div className="flex gap-1.5 text-[10px] font-mono text-gray-400">
                <button
                  type="button"
                  onClick={() => applyEffortPreset(0.5)}
                  className="hover:text-amber-500 transition-colors cursor-pointer"
                >
                  30m
                </button>
                <span className="text-gray-300">•</span>
                <button
                  type="button"
                  onClick={() => applyEffortPreset(1)}
                  className="hover:text-amber-500 transition-colors cursor-pointer"
                >
                  1h
                </button>
                <span className="text-gray-300">•</span>
                <button
                  type="button"
                  onClick={() => applyEffortPreset(3)}
                  className="hover:text-amber-500 transition-colors cursor-pointer"
                >
                  3h
                </button>
                <span className="text-gray-300">•</span>
                <button
                  type="button"
                  onClick={() => applyEffortPreset(6)}
                  className="hover:text-amber-500 transition-colors cursor-pointer"
                >
                  6h
                </button>
              </div>
            </div>
            <div className="relative">
              <input
                id="task-effort"
                type="number"
                step="0.5"
                min="0.5"
                className="w-full text-sm border border-gray-200 hover:border-gray-300 focus:border-slate-800 outline-hidden rounded-xl pl-3.5 pr-20 py-2.5 transition-colors font-mono focus:ring-1 focus:ring-slate-800"
                placeholder="e.g. 1, 1.5, 4"
                value={estimatedEffort}
                onChange={(e) => setEstimatedEffort(e.target.value)}
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-gray-400 select-none pointer-events-none">
                Hours
              </span>
            </div>
          </div>
        </div>

        {/* Toggleable Advanced settings (Category, Notes, and Link) */}
        <button
          type="button"
          onClick={() => setShowAdvance(!showAdvance)}
          className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 cursor-pointer pt-1"
        >
          {showAdvance ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          Advanced Details (Category, Notes, Resource Link)
        </button>

        {showAdvance && (
          <div className="p-3 bg-slate-50/50 border border-slate-100 rounded-xl space-y-3 animate-fadeIn">
            {/* Category */}
            <div className="space-y-1">
              <span className="text-xs font-semibold text-gray-700 block">Task Category</span>
              <div className="grid grid-cols-4 gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`py-1.5 px-1 text-xs rounded-lg font-medium border text-center transition-all cursor-pointer ${
                      category === cat
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Resource Link */}
            <div className="space-y-1">
              <label htmlFor="task-link" className="text-xs font-semibold text-gray-700 block text-left">
                Resource Link (URL)
              </label>
              <input
                id="task-link"
                type="url"
                className="w-full text-xs border border-gray-250 hover:border-gray-300 focus:border-slate-800 outline-hidden rounded-xl px-3 py-2.5 transition-colors font-sans"
                placeholder="e.g. https://company.com/apply"
                value={resourceLink}
                onChange={(e) => setResourceLink(e.target.value)}
              />
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <label htmlFor="task-notes" className="text-xs font-semibold text-gray-700 block text-left">
                Optional Notes / Location / Rules
              </label>
              <textarea
                id="task-notes"
                className="w-full text-xs border border-gray-250 hover:border-gray-300 focus:border-slate-800 outline-hidden rounded-xl px-3 py-2.1 transition-colors resize-none font-sans"
                placeholder="Important URLs, contacts, submission guidelines..."
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="space-y-2.5 pt-3 border-t border-slate-100">
          {showSuccess && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200/80 text-emerald-800 rounded-xl px-3.5 py-3 text-xs font-semibold animate-fadeIn" id="task-creation-success-message">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Success! Task created and added to your active stack.</span>
            </div>
          )}

          <button
            type="submit"
            disabled={!isFormValid}
            className={`w-full py-3.5 rounded-xl font-sans font-black text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 shadow-xs ${
              isFormValid
                ? "bg-slate-900 hover:bg-slate-800 text-white cursor-pointer hover:scale-[1.01] active:scale-[0.98]"
                : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200/50"
            }`}
            id="task-submit-button"
          >
            <PlusCircle className="w-4 h-4 shrink-0" />
            <span>Create Task</span>
          </button>
          
          {!isFormValid && (
            <p className="text-[10px] text-slate-400 text-center font-sans mt-1 leading-snug">
              Please enter the <strong className="text-slate-500">Task Name</strong>, <strong className="text-slate-500">Deadline Time</strong>, and <strong className="text-slate-500">Estimated Work Effort</strong> to unlock the button.
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
