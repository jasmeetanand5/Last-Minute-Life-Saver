import React, { useState } from "react";
import { motion } from "motion/react";
import { Check, Edit3, Trash2, Calendar, FileText, ChevronRight, ChevronDown, Flame, ExternalLink, Save, X, Sparkles, Clock, AlertCircle, Lightbulb, RefreshCw, Info, Target, Coffee } from "lucide-react";
import { Task, CategoryType } from "../types";
import { analyzeTaskDeadline, formatFriendlyDate, calculateTaskRisk, estimateDeadlineSuccessProbability, analyzeProcrastinationRisk, generateLocalDefaultFocusPlan } from "../utils";

interface TaskCardProps {
  key?: string;
  task: Task;
  onToggleComplete: (id: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  now: Date;
  isHighlighted?: boolean;
  isBriefGlow?: boolean;
  activeTasksCount?: number;
  totalActiveEffort?: number;
  otherActiveTasks?: string[];
  isSelected?: boolean;
  onSelectToggle?: (id: string) => void;
  isFocusedSessionActive?: boolean;
  isActiveFocused?: boolean;
  onAddToast?: (message: string, title?: string) => void;
  onStartWorkingTask?: (id: string) => void;
}

interface AIAnalysisResult {
  breakdown: string[];
  recommendedNextAction: string;
  suggestedStartTime: string;
  riskLevel: "Low" | "Medium" | "High";
  productivityAdvice: string;
}

// Keep track of the user's expand/collapse preference for each task within the current browser session.
// This preserves the state across renders, component remounts, etc., but defaults to collapsed upon a page reload.
const sessionAiAnalysisPreferences = new Map<string, boolean>();
const sessionFocusPlanPreferences = new Map<string, boolean>();
const sessionNotesPreferences = new Map<string, boolean>();
const sessionDeadlinePredictionPreferences = new Map<string, boolean>();
const sessionProcrastinationPreferences = new Map<string, boolean>();

export default function TaskCard({ 
  task, 
  onToggleComplete, 
  onEdit, 
  onDelete, 
  now, 
  isHighlighted, 
  isBriefGlow,
  activeTasksCount,
  totalActiveEffort,
  otherActiveTasks,
  isSelected,
  onSelectToggle,
  isFocusedSessionActive,
  isActiveFocused,
  onAddToast,
  onStartWorkingTask
}: TaskCardProps) {
  const [showNotes, setShowNotes] = useState(() => {
    return sessionNotesPreferences.get(task.id) || false;
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState<CategoryType>("Work");
  const [editDeadline, setEditDeadline] = useState("");
  const [editEffort, setEditEffort] = useState<string | number>("");
  const [editNotes, setEditNotes] = useState("");
  const [editResourceLink, setEditResourceLink] = useState("");
  const [editError, setEditError] = useState("");
  const [justSaved, setJustSaved] = useState(false);
  const [showParticles, setShowParticles] = useState(false);

  // AI Analysis States
  const [showAiAnalysisDetail, setShowAiAnalysisDetail] = useState(() => {
    return sessionAiAnalysisPreferences.get(task.id) || false;
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Focus Session Plan States
  const [showFocusPlanDetail, setShowFocusPlanDetail] = useState(() => {
    return sessionFocusPlanPreferences.get(task.id) || false;
  });
  const [isPlanningFocus, setIsPlanningFocus] = useState(false);
  const [focusPlanError, setFocusPlanError] = useState<string | null>(null);
  const [temporaryPlan, setTemporaryPlan] = useState<Task["aiFocusPlan"]>(null);
  const [completedSessions, setCompletedSessions] = useState<number[]>(() => {
    return task.aiFocusPlan?.completedSessions || [];
  });
  const [showDeadlinePredictionDetail, setShowDeadlinePredictionDetail] = useState(() => {
    return sessionDeadlinePredictionPreferences.get(task.id) || false;
  });
  const [showProcrastinationDetail, setShowProcrastinationDetail] = useState(() => {
    return sessionProcrastinationPreferences.get(task.id) || false;
  });
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [editedSessions, setEditedSessions] = useState<any[]>([]);

  const startEditingPlan = () => {
    if (task.aiFocusPlan) {
      setEditedSessions(JSON.parse(JSON.stringify(task.aiFocusPlan.sessions)));
      setIsEditingPlan(true);
    }
  };

  const handleUpdateSessionField = (index: number, field: string, value: any) => {
    const updated = [...editedSessions];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    setEditedSessions(updated);
  };

  const handleSaveEditedPlan = () => {
    if (task.aiFocusPlan) {
      onEdit({
        ...task,
        aiFocusPlan: {
          ...task.aiFocusPlan,
          sessions: editedSessions,
          isCustomized: true,
          lastUpdated: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
        }
      });
      setIsEditingPlan(false);
      if (onAddToast) {
        onAddToast("✍️ Focus Plan Customized & Saved", task.title);
      }
    }
  };

  const handleCancelEditingPlan = () => {
    setIsEditingPlan(false);
  };

  // Sync completed sessions if aiFocusPlan prop changes on task
  React.useEffect(() => {
    setCompletedSessions(task.aiFocusPlan?.completedSessions || []);
  }, [task.aiFocusPlan]);

  const handleCreateCustomPlan = () => {
    const defaultPlan = generateLocalDefaultFocusPlan(task);
    onEdit({
      ...task,
      aiFocusPlan: {
        ...defaultPlan,
        isCustomized: true
      }
    });
    setCompletedSessions([]);
    setEditedSessions(JSON.parse(JSON.stringify(defaultPlan.sessions)));
    setIsEditingPlan(true);
    setShowFocusPlanDetail(true);
    if (onAddToast) {
      onAddToast("✍️ Custom Focus Plan Initialized", "Edit your sessions below.");
    }
  };

  const generateFocusPlan = async () => {
    setShowFocusPlanDetail(true);
    setIsPlanningFocus(true);
    setFocusPlanError(null);
    try {
      const response = await fetch("/api/focus-session-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: task.title,
          estimatedEffort: task.estimatedEffort,
          notes: task.notes || "",
          category: task.category || "General",
          deadlineInfo: formatFriendlyDate(task.deadline),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to contact planner server.");
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      setTemporaryPlan(data);
    } catch (err: any) {
      console.error("Focus plan API error, falling back to local generator:", err);
      // Automatically fall back to a locally generated default plan
      const fallback = generateLocalDefaultFocusPlan(task);
      setTemporaryPlan({
        sessions: fallback.sessions,
        completedSessions: [],
        lastUpdated: fallback.lastUpdated,
        isCustomized: false,
        isDefaultLocal: true
      });
      if (onAddToast) {
        onAddToast("⚡ Generated Local Default Focus Plan", "AI was unavailable; local fallback created successfully.");
      }
    } finally {
      setIsPlanningFocus(false);
    }
  };

  const handleAcceptFocusPlan = () => {
    if (temporaryPlan) {
      onEdit({
        ...task,
        aiFocusPlan: {
          ...temporaryPlan,
          completedSessions: []
        },
      });
      setTemporaryPlan(null);
      setShowFocusPlanDetail(true);
      if (onAddToast) {
        onAddToast("✅ Focus Plan Activated", task.title);
      }
    }
  };

  const handleIgnoreFocusPlan = () => {
    setTemporaryPlan(null);
  };

  const handleClearFocusPlan = () => {
    onEdit({
      ...task,
      aiFocusPlan: null,
    });
    setCompletedSessions([]);
  };

  const toggleSessionComplete = (sessionNum: number) => {
    const updated = completedSessions.includes(sessionNum)
      ? completedSessions.filter((s) => s !== sessionNum)
      : [...completedSessions, sessionNum];
    
    setCompletedSessions(updated);
    if (task.aiFocusPlan) {
      onEdit({
        ...task,
        aiFocusPlan: {
          ...task.aiFocusPlan,
          completedSessions: updated
        }
      });
    }
  };

  const runAIAnalysis = async () => {
    setIsAnalyzing(true);
    setAiError(null);
    setShowSuccess(false);
    try {
      const response = await fetch("/api/analyze-task", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: task.title,
          description: task.notes || "",
          deadline: task.deadline,
          estimatedEffort: task.estimatedEffort,
          activeTasksCount: activeTasksCount || 1,
          totalActiveEffort: totalActiveEffort || task.estimatedEffort,
          otherActiveTasks: otherActiveTasks || [],
          currentTime: now.toISOString(),
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        console.error("Gemini API Non-OK response details:", errData);
        throw new Error(errData.error || "Failed to analyze task.");
      }

      const data = await response.json();
      const nowStr = new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' });
      onEdit({
        ...task,
        aiAnalysis: {
          ...data,
          lastUpdated: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' }),
          generatedAt: nowStr,
        },
      });
      setShowAiAnalysisDetail(true);
      sessionAiAnalysisPreferences.set(task.id, true);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
      }, 4000);
    } catch (err: any) {
      console.error("Gemini API Error details:", err);
      const errorString = String(err?.message || "").toLowerCase();
      if (errorString.includes("429") || errorString.includes("quota") || errorString.includes("limit") || errorString.includes("demand") || errorString.includes("rate")) {
        setAiError("Gemini is currently experiencing high demand. Try again shortly.");
      } else {
        setAiError("AI analysis is temporarily unavailable. Please try again in a moment.");
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleShowAiAnalysis = () => {
    const newVal = !showAiAnalysisDetail;
    setShowAiAnalysisDetail(newVal);
    sessionAiAnalysisPreferences.set(task.id, newVal);
  };

  // Sync details visibility if task ID changes
  React.useEffect(() => {
    setShowAiAnalysisDetail(sessionAiAnalysisPreferences.get(task.id) || false);
    setShowFocusPlanDetail(sessionFocusPlanPreferences.get(task.id) || false);
    setShowNotes(sessionNotesPreferences.get(task.id) || false);
    setShowDeadlinePredictionDetail(sessionDeadlinePredictionPreferences.get(task.id) || false);
    setShowProcrastinationDetail(sessionProcrastinationPreferences.get(task.id) || false);
  }, [task.id]);

  const analysis = analyzeTaskDeadline(task, now);
  const riskAssessment = calculateTaskRisk(task, activeTasksCount || 1, now);
  const prediction = estimateDeadlineSuccessProbability(
    task,
    activeTasksCount || 1,
    totalActiveEffort || task.estimatedEffort,
    now
  );
  const procrastinationRisk = analyzeProcrastinationRisk(task, now);
  const isOverdue = !task.completed && new Date(task.deadline).getTime() < now.getTime();

  const startEditing = () => {
    setEditTitle(task.title);
    setEditCategory((task.category as CategoryType) || "Work");
    
    // Format deadline for datetime-local input
    try {
      const d = new Date(task.deadline);
      const tzoffset = d.getTimezoneOffset() * 60000;
      const localISOTime = new Date(d.getTime() - tzoffset).toISOString().slice(0, 16);
      setEditDeadline(localISOTime);
    } catch (_) {
      setEditDeadline(task.deadline);
    }
    
    setEditEffort(task.estimatedEffort);
    setEditNotes(task.notes || "");
    setEditResourceLink(task.resourceLink || "");
    setEditError("");
    setIsEditing(true);
  };

  const handleSave = () => {
    setEditError("");
    if (!editTitle.trim()) {
      setEditError("Task title is required");
      return;
    }
    if (!editDeadline) {
      setEditError("Please set a deadline time");
      return;
    }
    if (editEffort === "" || Number(editEffort) <= 0) {
      setEditError("Please enter a valid estimated effort");
      return;
    }

    onEdit({
      ...task,
      title: editTitle.trim(),
      category: editCategory,
      deadline: new Date(editDeadline).toISOString(),
      estimatedEffort: Number(editEffort),
      notes: editNotes.trim(),
      resourceLink: editResourceLink.trim(),
      lastEditedAt: new Date().toISOString(),
    });
    setIsEditing(false);
    setJustSaved(true);
    setTimeout(() => {
      setJustSaved(false);
    }, 3000);
  };

  // Category tags custom styles
  const getCategoryStyles = (category?: string) => {
    switch (category) {
      case "Work":
        return "bg-slate-100 text-slate-800 border-slate-200/60";
      case "School":
        return "bg-indigo-50 text-indigo-700 border-indigo-200/60";
      case "Personal":
        return "bg-amber-50 text-amber-700 border-amber-200/60";
      case "Other":
        return "bg-teal-50 text-teal-700 border-teal-200/85";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  let domain = "";
  try {
    if (task.resourceLink) {
      domain = new URL(task.resourceLink).hostname;
    }
  } catch (e) {
    try {
      domain = new URL("https://" + task.resourceLink).hostname;
    } catch (_) {}
  }
  const faviconUrl = domain ? `https://www.google.com/s2/favicons?sz=64&domain=${domain}` : "";

  if (isEditing) {
    return (
      <div
        className="relative bg-white border-2 border-indigo-500 rounded-2xl p-5 shadow-lg animate-fadeIn text-left space-y-4 font-sans"
        id={`task-card-edit-${task.id}`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <span className="text-xs font-bold text-indigo-600 font-mono tracking-wider uppercase">⚡ INLINE COORDINATES EDITOR</span>
          <button
            onClick={() => setIsEditing(false)}
            className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 cursor-pointer transition-all"
            title="Cancel editing"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {editError && (
          <p className="text-[11px] font-semibold text-rose-600 bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-lg text-left">
            ⚠️ {editError}
          </p>
        )}

        {/* Title input */}
        <div className="space-y-1 text-left">
          <label className="text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono block">
            Task Name / Target
          </label>
          <input
            type="text"
            className="w-full text-sm font-sans font-bold border border-slate-200 hover:border-slate-350 focus:border-slate-800 outline-none rounded-xl px-3 py-2 transition-colors"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="What is the critical target?"
          />
        </div>

        {/* Category selection */}
        <div className="space-y-1 text-left">
          <label className="text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono block">
            Category
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {(["Work", "School", "Personal", "Other"] as CategoryType[]).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setEditCategory(cat)}
                className={`py-1 px-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer text-center ${
                  editCategory === cat
                    ? "bg-slate-900 border-slate-900 text-white shadow-2xs"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Twin input row: Deadline & Work Effort */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono block">
              Time Deadline
            </label>
            <input
              type="datetime-local"
              className="w-full text-xs font-mono border border-slate-200 hover:border-slate-350 focus:border-slate-800 outline-none rounded-xl px-3 py-2 transition-colors"
              value={editDeadline}
              onChange={(e) => setEditDeadline(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono block">
              Work Effort (Hours)
            </label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              max="168"
              className="w-full text-xs font-mono border border-slate-200 hover:border-slate-350 focus:border-slate-800 outline-none rounded-xl px-3 py-2 transition-colors"
              value={editEffort}
              onChange={(e) => setEditEffort(e.target.value)}
              placeholder="e.g. 1, 1.5, 4"
            />
          </div>
        </div>

        {/* Optional Resource Link */}
        <div className="space-y-1 text-left">
          <label className="text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono block">
            Resource Link (URL)
          </label>
          <input
            type="url"
            className="w-full text-xs font-mono border border-slate-200 hover:border-slate-350 focus:border-slate-800 outline-none rounded-xl px-3 py-2 transition-colors"
            value={editResourceLink}
            onChange={(e) => setEditResourceLink(e.target.value)}
            placeholder="e.g. https://portal.company.com"
          />
        </div>

        {/* Notes */}
        <div className="space-y-1 text-left">
          <label className="text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono block">
            Optional Notes / Description
          </label>
          <textarea
            className="w-full text-xs font-sans border border-slate-200 hover:border-slate-350 focus:border-slate-800 outline-none rounded-xl px-3 py-2 transition-colors h-16 resize-y"
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            placeholder="Important links, submission details, login info..."
          />
        </div>

        {/* Form controls row */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="px-4 py-2.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-800 rounded-xl transition-all cursor-pointer shadow-2xs"
          >
            Cancel
          </button>
          
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-black bg-blue-600 hover:bg-blue-750 text-white rounded-xl shadow-md hover:shadow-lg hover:scale-[1.02] cursor-pointer transition-all active:scale-97"
          >
            <Save className="w-4 h-4 shrink-0 text-blue-100" />
            <span>Save Changes</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group relative bg-white border rounded-2xl p-5 shadow-xs transition-all duration-300 ${
        isFocusedSessionActive
          ? isActiveFocused
            ? "shadow-[0_0_25px_rgba(99,102,241,0.65)] ring-4 ring-indigo-500 bg-indigo-50/10 border-indigo-500 scale-[1.015] z-10"
            : "opacity-20 pointer-events-none saturate-50 grayscale-30 scale-[0.98]"
          : justSaved
            ? "ring-4 ring-emerald-500/60 bg-emerald-50/10 border-emerald-500 scale-[1.01] shadow-md z-10"
            : isBriefGlow
              ? "shadow-[0_0_25px_rgba(99,102,241,0.65)] ring-4 ring-indigo-500/50 bg-indigo-50/10 border-indigo-500 scale-[1.015] z-10 animate-pulse"
              : isHighlighted
                ? "ring-4 ring-indigo-500/85 bg-indigo-50/10 border-indigo-500 scale-[1.02] z-10 animate-highlight-glow"
                : task.completed
                  ? "border-emerald-100 opacity-75 grayscale-30"
                  : analysis.status === "panic"
                    ? "border-red-200 shadow-md ring-1 ring-red-100/50"
                    : "border-gray-100 hover:border-gray-200 hover:shadow-md"
      }`}
      id={`task-card-${task.id}`}
    >
      {/* Dynamic Recommendation Focus Banner */}
      {isHighlighted && (
        <div className="mb-4 bg-indigo-600 text-white px-3 py-2 rounded-xl flex items-center gap-2 text-xs font-bold animate-bounce-subtle shadow-sm select-none">
          <Sparkles className="w-4 h-4 text-white animate-pulse shrink-0" />
          <span>🎯 Current Coaching Recommendation Focus</span>
        </div>
      )}

      {/* Visual Feedback for Successful Save */}
      {justSaved && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex items-center gap-2.5 text-xs font-bold animate-fadeIn shadow-2xs">
          <span className="flex h-2 w-2 relative shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 animate-pulse"></span>
          </span>
          <span className="flex-1">✨ Changes saved successfully! Buffer scores updated.</span>
        </div>
      )}

      {/* Absolute Left Panic Accent Border */}
      {!task.completed && (analysis.status === "panic" || analysis.status === "high") && (
        <div
          className={`absolute left-0 top-6 bottom-6 w-1 rounded-r-md ${
            analysis.status === "panic" ? "bg-rose-500 animate-pulse" : "bg-orange-500"
          }`}
        />
      )}

      {/* Main Header / Info Layout */}
      <div className="flex items-start gap-3.5">
        {/* Bulk Selection Checkbox */}
        {onSelectToggle && (
          <div className="shrink-0 flex items-center pt-0.5">
            <button
              onClick={() => onSelectToggle(task.id)}
              className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95 duration-150 ${
                isSelected
                  ? "bg-indigo-600 border-indigo-600 text-white shadow-xs"
                  : "border-slate-300 hover:border-indigo-500 bg-white"
              }`}
              id={`select-task-btn-${task.id}`}
              title={isSelected ? "Deselect task" : "Select task"}
            >
              {isSelected && (
                <Check className="w-3.5 h-3.5 stroke-[3.5]" />
              )}
            </button>
          </div>
        )}

        {/* Satisfying Checkbox Indicator */}
        <div className="relative shrink-0">
          <button
            onClick={() => {
              if (!task.completed) {
                setShowParticles(true);
                setTimeout(() => setShowParticles(false), 1000);
              }
              onToggleComplete(task.id);
            }}
            className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95 duration-150 ${
              task.completed
                ? "bg-emerald-500 border-emerald-500 text-white"
                : "border-gray-300 hover:border-slate-800 bg-white"
            }`}
            id={`toggle-complete-${task.id}`}
            title={task.completed ? "Mark incomplete" : "Mark completed"}
          >
            {task.completed && (
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
              >
                <Check className="w-4 h-4 stroke-[3]" />
              </motion.div>
            )}
          </button>

          {showParticles && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-30">
              {[...Array(12)].map((_, i) => {
                const angle = (i * 360) / 12;
                const distance = 25 + Math.random() * 30;
                const x = Math.cos((angle * Math.PI) / 180) * distance;
                const y = Math.sin((angle * Math.PI) / 180) * distance;
                const size = 3 + Math.random() * 5;
                const colors = ["#10B981", "#34D399", "#059669", "#6366F1", "#A7F3D0", "#3B82F6"];
                const color = colors[Math.floor(Math.random() * colors.length)];
                return (
                  <motion.div
                    key={i}
                    className="absolute rounded-full"
                    style={{ 
                      backgroundColor: color,
                      width: size,
                      height: size,
                    }}
                    initial={{ scale: 0, x: 0, y: 0, opacity: 1 }}
                    animate={{
                      scale: [0, 1.3, 0.8, 0],
                      x: x,
                      y: y,
                      opacity: [1, 1, 0.5, 0]
                    }}
                    transition={{
                      duration: 0.7,
                      ease: "easeOut"
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Text Content */}
        <div className="space-y-1.5 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {/* Category Tag */}
            {task.category && (
              <span
                className={`text-[10px] font-semibold font-mono tracking-wider px-2 py-0.5 rounded-md border uppercase ${getCategoryStyles(
                  task.category,
                )}`}
              >
                {task.category}
              </span>
            )}

            {/* Unified Risk Level Tag */}
            <span
              className={`text-[10px] font-bold font-mono tracking-wide px-2 py-0.5 rounded-md border uppercase shadow-3xs ${riskAssessment.color} ${riskAssessment.bg} ${riskAssessment.border}`}
            >
              Risk: {riskAssessment.level}
            </span>

            {/* Procrastination Risk Collapsed Tag */}
            {procrastinationRisk.isAtRisk && (
              <span
                className="text-[10px] font-extrabold font-mono tracking-wide px-2 py-0.5 rounded-md border border-amber-200 bg-amber-50 text-amber-700 uppercase shadow-3xs flex items-center gap-1.5 animate-pulse-slow"
                id={`procrastination-risk-badge-${task.id}`}
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                <span>At Risk of Procrastination</span>
              </span>
            )}
          </div>

          <h4
            className={`font-display font-bold text-gray-900 text-base leading-snug tracking-tight break-words ${
              task.completed ? "line-through text-gray-450 decoration-gray-400 decoration-2" : ""
            }`}
          >
            {task.title}
          </h4>

          {/* Effort details, Time left, and Status badges */}
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <div className="flex items-center gap-2 bg-slate-100/80 border border-slate-200/60 px-3.5 py-2 rounded-xl text-slate-800 transition-colors">
              <Calendar className="w-4.5 h-4.5 text-slate-500 shrink-0" />
              <div className="text-left">
                <span className="text-[9px] font-bold text-slate-400 tracking-wider font-mono block uppercase leading-none mb-0.5">DEADLINE</span>
                <span className="text-sm font-black text-slate-900 font-sans tracking-tight">
                  {formatFriendlyDate(task.deadline)}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/50 px-3.5 py-2 rounded-xl text-slate-600">
              <div className="text-left font-mono">
                <span className="text-[9px] font-bold text-slate-400 tracking-wider block uppercase leading-none mb-0.5">REQUIRED WORK</span>
                <span className="text-xs font-bold text-slate-800">
                  {task.estimatedEffort} hours
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/50 px-3.5 py-2 rounded-xl text-slate-600">
              <div className="text-left font-mono">
                <span className="text-[9px] font-bold text-slate-400 tracking-wider block uppercase leading-none mb-0.5">STATUS</span>
                <span className={`text-xs font-bold ${
                  task.completed 
                    ? "text-emerald-600" 
                    : isOverdue 
                    ? "text-rose-600" 
                    : "text-indigo-600"
                }`}>
                  {task.completed ? "Completed" : isOverdue ? "Overdue" : analysis.countdownText || "Active"}
                </span>
              </div>
            </div>
          </div>

          {/* Default Action Row: Analyze Task & Start Working */}
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-slate-100">
            {/* Analyze Task Button */}
            <button
              onClick={runAIAnalysis}
              disabled={isAnalyzing}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all border ${
                isAnalyzing 
                  ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-80"
                  : task.aiAnalysis
                  ? "bg-white hover:bg-slate-50 border-slate-200 text-slate-700 active:scale-95 animate-pulse-slow"
                  : "bg-indigo-600 hover:bg-indigo-700 border-indigo-600 text-white shadow-2xs active:scale-95 animate-pulse-slow"
              }`}
              id={`default-analyze-btn-${task.id}`}
              title="Get Gemini AI insights, safety buffer estimates, and scheduling recommendations"
            >
              {isAnalyzing ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-500" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              )}
              <span>
                {isAnalyzing ? "Analyzing..." : task.aiAnalysis ? "Refresh AI Analysis" : "Analyze Task"}
              </span>
            </button>

            {/* Start Working Button */}
            {!task.completed && onStartWorkingTask && (
              <button
                onClick={() => onStartWorkingTask(task.id)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 cursor-pointer active:scale-97 transition-all font-sans"
                id={`default-start-working-btn-${task.id}`}
                title={isFocusedSessionActive && isActiveFocused ? "Return to the active focus timer" : "Start a focus session for this task"}
              >
                <span>
                  {isFocusedSessionActive && isActiveFocused ? "Return to Workspace" : "🚀 Start Working"}
                </span>
              </button>
            )}
          </div>

          {/* Missed Deadline Prediction Visualizer */}
          <div className="mt-4 p-3 bg-slate-50/70 border border-slate-150/80 rounded-xl text-left animate-fadeIn">
            <button
              onClick={() => {
                const newVal = !showDeadlinePredictionDetail;
                setShowDeadlinePredictionDetail(newVal);
                sessionDeadlinePredictionPreferences.set(task.id, newVal);
              }}
              className="w-full flex items-center justify-between text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 cursor-pointer select-none focus:outline-hidden"
              id={`toggle-deadline-prediction-btn-${task.id}`}
            >
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-500" />
                <span>Missed Deadline Prediction</span>
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`px-2 py-0.5 rounded border text-[10px] ${
                  prediction.likelihood === "High Risk"
                    ? "bg-rose-50 border-rose-200 text-rose-600 font-extrabold"
                    : prediction.likelihood === "Medium Risk"
                    ? "bg-amber-50 border-amber-200 text-amber-600 font-bold"
                    : "bg-emerald-50 border-emerald-200 text-emerald-600 font-semibold"
                }`}>
                  {prediction.likelihood}
                </span>
                {showDeadlinePredictionDetail ? (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                )}
              </div>
            </button>

            <motion.div
              initial={false}
              animate={{
                height: showDeadlinePredictionDetail ? "auto" : 0,
                opacity: showDeadlinePredictionDetail ? 1 : 0,
                marginTop: showDeadlinePredictionDetail ? 10 : 0,
              }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              style={{ overflow: "hidden" }}
            >
              <div className="space-y-2">
                {isOverdue ? (
                  <>
                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="font-sans text-rose-600 font-black">Deadline Missed</span>
                    </div>
                    <p className="text-[10.5px] text-rose-700 font-bold leading-relaxed font-sans mt-2 pt-1.5 border-t border-rose-200/30">
                      This task is overdue and requires immediate attention.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="font-sans text-slate-600 font-medium">Success Probability:</span>
                      <span className="font-mono font-black text-slate-900 text-xs">
                        {prediction.successProbability}%
                      </span>
                    </div>

                    {/* Progress/Gauge Bar */}
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden relative">
                      <motion.div
                        className={`h-full rounded-full transition-all duration-500 ${
                          prediction.successProbability >= 75
                            ? "bg-emerald-500"
                            : prediction.successProbability >= 45
                            ? "bg-amber-500"
                            : "bg-rose-500"
                        }`}
                        style={{ width: `${prediction.successProbability}%` }}
                        initial={{ width: 0 }}
                        animate={{ width: `${prediction.successProbability}%` }}
                      />
                    </div>

                    {/* Quick Helper Subtext from factors */}
                    {prediction.factors.length > 0 && !task.completed && (
                      <p className="text-[10px] text-slate-500 font-medium leading-relaxed font-sans mt-2 pt-1 border-t border-slate-200/40">
                        💡 {prediction.factors[0]}
                      </p>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </div>

          {/* Procrastination Risk Panel */}
          {procrastinationRisk.isAtRisk && (
            <div className="mt-4 p-4 rounded-xl border border-amber-200 bg-amber-50/20 text-left animate-fadeIn" id={`procrastination-risk-panel-${task.id}`}>
              <button
                onClick={() => {
                  const newVal = !showProcrastinationDetail;
                  setShowProcrastinationDetail(newVal);
                  sessionProcrastinationPreferences.set(task.id, newVal);
                }}
                className="w-full flex items-center justify-between text-left focus:outline-hidden cursor-pointer"
                id={`toggle-procrastination-btn-${task.id}`}
              >
                <div className="flex items-center gap-2 text-amber-800 font-extrabold text-xs uppercase tracking-tight">
                  <AlertCircle className="w-4.5 h-4.5 text-amber-600 shrink-0 animate-pulse" />
                  <span>Procrastination Warning</span>
                </div>
                {showProcrastinationDetail ? <ChevronDown className="w-4 h-4 text-amber-600" /> : <ChevronRight className="w-4 h-4 text-amber-600" />}
              </button>

              <motion.div
                initial={false}
                animate={{
                  height: showProcrastinationDetail ? "auto" : 0,
                  opacity: showProcrastinationDetail ? 1 : 0,
                  marginTop: showProcrastinationDetail ? 12 : 0,
                }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                style={{ overflow: "hidden" }}
              >
                <div className="space-y-3 font-sans">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-amber-700 block uppercase tracking-wider mb-0.5">
                      Reason
                    </span>
                    <p className="text-xs font-bold text-slate-800 leading-relaxed">
                      {procrastinationRisk.reason}
                    </p>
                  </div>
                  
                  <div className="pt-1.5 border-t border-amber-200/40">
                    <span className="text-[10px] font-mono font-bold text-amber-700 block uppercase tracking-wider mb-1">
                      Suggested Action
                    </span>
                    <div className="text-xs font-semibold text-slate-700 leading-relaxed bg-white border border-amber-100/70 rounded-xl p-3 shadow-3xs flex gap-2">
                      <span className="text-amber-500 text-sm">✨</span>
                      <span>{procrastinationRisk.suggestedAction}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </div>
      </div>

      {/* Resource Link Section */}
      {task.resourceLink && (
        <div className="mt-3.5 pl-9">
          <div className={`p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn transition-all duration-300 ${
            isBriefGlow 
              ? "bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/15 shadow-sm scale-[1.01]" 
              : "bg-slate-50 border border-slate-150/70"
          }`}>
            <div className="min-w-0 flex-1">
              <span className={`text-[10px] font-mono font-bold tracking-wider block mb-0.5 ${
                isBriefGlow ? "text-indigo-600" : "text-slate-500"
              }`}>
                RESOURCE LINK {isBriefGlow && "★"}
              </span>
              <span className={`text-xs font-mono truncate block select-all ${
                isBriefGlow ? "text-indigo-900 font-medium" : "text-gray-500"
              }`} title={task.resourceLink}>
                {task.resourceLink}
              </span>
            </div>
            <a
              href={task.resourceLink.startsWith("http") ? task.resourceLink : `https://${task.resourceLink}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`shrink-0 flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-2xs transition-all cursor-pointer ${
                isBriefGlow 
                  ? "bg-indigo-600 hover:bg-indigo-500 text-white hover:shadow-indigo-500/20 hover:scale-[1.03] animate-bounce" 
                  : "bg-slate-900 hover:bg-slate-800 text-white hover:shadow-xs"
              }`}
            >
              {faviconUrl ? (
                <img
                  src={faviconUrl}
                  alt=""
                  className="w-3.5 h-3.5 rounded-xs shrink-0 select-none bg-white p-0.5 flex items-center justify-center"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <ExternalLink className="w-3.5 h-3.5" />
              )}
              <span>Open Link</span>
            </a>
          </div>
        </div>
      )}

      {/* Task Notes Section */}
      {task.notes && (
        <div className="mt-3 pl-9">
          <button
            onClick={() => {
              const newVal = !showNotes;
              setShowNotes(newVal);
              sessionNotesPreferences.set(task.id, newVal);
            }}
            className="flex items-center gap-1 text-[11px] font-sans text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
          >
            {showNotes ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            <span>Notes</span>
          </button>

          <motion.div
            initial={false}
            animate={{
              height: showNotes ? "auto" : 0,
              opacity: showNotes ? 1 : 0,
              marginTop: showNotes ? 10 : 0,
            }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-gray-600 font-sans leading-relaxed whitespace-pre-wrap flex items-start gap-2 animate-fadeIn">
              <FileText className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
              <p className="flex-1 break-words">{task.notes}</p>
            </div>
          </motion.div>
        </div>
      )}

      {/* Collapsible AI Analysis Details */}
      {!task.completed && task.aiAnalysis && (
        <div className="mt-4 p-4 rounded-xl border border-slate-200/60 bg-slate-50/50 text-left">
          <button
            onClick={() => {
              const newVal = !showAiAnalysisDetail;
              setShowAiAnalysisDetail(newVal);
              sessionAiAnalysisPreferences.set(task.id, newVal);
            }}
            className="w-full flex items-center justify-between text-left focus:outline-hidden cursor-pointer"
            id={`toggle-ai-analysis-header-${task.id}`}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
              <span className="text-sm font-black text-slate-900">AI Analysis</span>
              {task.aiAnalysis.lastUpdated && (
                <span className="text-[10px] text-slate-400 font-mono">
                  (Updated {task.aiAnalysis.lastUpdated})
                </span>
              )}
            </div>
            {showAiAnalysisDetail ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
          </button>

          <motion.div
            initial={false}
            animate={{
              height: showAiAnalysisDetail ? "auto" : 0,
              opacity: showAiAnalysisDetail ? 1 : 0,
              marginTop: showAiAnalysisDetail ? 12 : 0,
            }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div className="space-y-4 divide-y divide-slate-200/40 pt-3 border-t border-slate-200/40">
              {aiError && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl text-[11px] text-amber-800 flex items-center justify-between gap-1.5 animate-fadeIn mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-amber-500 font-bold">⚠️ Last Successful Analysis</span>
                  </div>
                  <span className="font-mono text-[9px] text-amber-700 font-bold">
                    Generated: {task.aiAnalysis.generatedAt || task.aiAnalysis.lastUpdated || "Recently"}
                  </span>
                </div>
              )}
              
              {/* Recommended Next Action */}
              <div className="pt-1 text-left min-w-0">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest font-mono block mb-1.5">
                  RECOMMENDED NEXT ACTION
                </span>
                <div className="bg-white border border-slate-150 rounded-xl p-3 flex items-start gap-2 shadow-3xs leading-relaxed text-xs font-semibold text-slate-900 min-w-0">
                  <Check className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                  <span className="flex-1 break-words min-w-0">{task.aiAnalysis.recommendedNextAction}</span>
                </div>
                
                {/* Scheduling recommendation block */}
                {(() => {
                  const deadlineTime = new Date(task.deadline).getTime();
                  const currentTime = now.getTime();
                  const hoursRemaining = (deadlineTime - currentTime) / (1000 * 60 * 60);
                  const bufferHours = hoursRemaining - task.estimatedEffort;
                  
                  const isHeavyWorkload = (activeTasksCount && activeTasksCount >= 4) || (totalActiveEffort && totalActiveEffort >= 10);
                  const isModerateWorkload = (activeTasksCount && activeTasksCount >= 2) || (totalActiveEffort && totalActiveEffort >= 5);
                  
                  const startTimeStr = task.aiAnalysis.suggestedStartTime;
                  const hasUrgentKeywords = startTimeStr.includes("⚠") || 
                                            startTimeStr.toLowerCase().includes("now") || 
                                            startTimeStr.toLowerCase().includes("immediately") ||
                                            startTimeStr.toLowerCase().includes("urgent");
                  
                  let status: "now" | "soon" | "track" = "track";
                  let statusLabel = "On Track";
                  let statusBadgeStyle = "";
                  
                  if (hoursRemaining <= 0 || bufferHours <= 1.5 || hasUrgentKeywords || (bufferHours <= 4 && isHeavyWorkload)) {
                    status = "now";
                    statusLabel = "🚨 Start Now";
                    statusBadgeStyle = "bg-rose-50 border-rose-200 text-rose-700 font-extrabold animate-pulse shadow-xs";
                  } else if (bufferHours <= 6 || (bufferHours <= 12 && isModerateWorkload) || (hoursRemaining <= 24 && bufferHours <= 8)) {
                    status = "soon";
                    statusLabel = "⚠ Start Soon";
                    statusBadgeStyle = "bg-amber-50 border-amber-200 text-amber-700 font-bold shadow-3xs";
                  } else {
                    status = "track";
                    statusLabel = "✅ On Track";
                    statusBadgeStyle = "bg-emerald-50 border-emerald-200 text-emerald-700 font-medium shadow-3xs";
                  }
                  
                  const cleanSuggestedStartTime = startTimeStr.replace(/^[⚠\s]+/, "");
                  
                  return (
                    <div className="mt-3 bg-white border border-slate-150 rounded-xl p-4 shadow-3xs animate-fadeIn text-left min-w-0">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest font-mono block mb-2.5">
                        SCHEDULING RECOMMENDATION
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 items-stretch min-w-0">
                        <div className="border-b sm:border-b-0 sm:border-r border-slate-100 pb-3 sm:pb-0 sm:pr-4 flex flex-col justify-center min-w-0">
                          <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                            Recommended Start:
                          </span>
                          <span className="text-sm font-black text-slate-950 tracking-tight leading-snug break-words">
                            {cleanSuggestedStartTime}
                          </span>
                        </div>
                        <div className="sm:pl-2 flex flex-col justify-center min-w-0">
                          <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                            Status:
                          </span>
                          <div className="inline-flex min-w-0">
                            <span className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs tracking-wide break-words ${statusBadgeStyle}`}>
                              <span>{statusLabel}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3.5 pt-2.5 border-t border-slate-100/80 flex items-start gap-2 text-[10.5px] text-slate-500 leading-normal min-w-0">
                        <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="font-medium flex-1 break-words min-w-0">
                          {status === "now" && "🚨 Action is needed right now! Your remaining time is smaller than or nearly equal to the required effort, leaving no room for delays."}
                          {status === "soon" && `⚠ Prepare to start shortly. You have a narrow safety window of ${bufferHours.toFixed(1)}h. Starting soon will protect you from entering panic mode.`}
                          {status === "track" && `✅ You're in a great position! With a generous safety buffer of ${bufferHours.toFixed(1)}h, you can comfortably proceed on the recommended schedule.`}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Task Breakdown */}
              <div className="pt-3 text-left min-w-0">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest font-mono block mb-2">
                  TASK BREAKDOWN
                </span>
                <ul className="space-y-1.5">
                  {task.aiAnalysis.breakdown.map((step, idx) => (
                    <li key={idx} className="text-xs text-slate-700 font-sans flex items-start gap-2.5 bg-white/50 border border-slate-100/60 rounded-lg p-2 min-w-0">
                      <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50/80 w-5 h-5 rounded-full flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="flex-1 leading-snug break-words min-w-0">{step}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* AI Advice */}
              <div className="pt-3 text-left min-w-0">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest font-mono block mb-1.5">
                  AI ADVICE
                </span>
                <p className="text-xs text-slate-600 italic font-sans flex items-start gap-2 bg-amber-50/30 border border-amber-100/40 rounded-lg p-2.5 min-w-0">
                  <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
                  <span className="flex-1 break-words min-w-0">{task.aiAnalysis.productivityAdvice}</span>
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* AI Focus Session Planner Block */}
      {!task.completed && (
        <div className="mt-4 p-4 rounded-xl border border-indigo-200/50 bg-indigo-50/10 text-left">
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left ${
            (showFocusPlanDetail || isPlanningFocus || temporaryPlan)
              ? "pb-3 border-b border-indigo-150/40 mb-4"
              : ""
          }`}>
            <div className="min-w-0">
              <span className="text-[10px] font-extrabold text-indigo-500 uppercase tracking-widest font-mono block mb-1">
                AI FOCUS PLANNING
              </span>
              <h4 className="text-sm font-black text-slate-900 tracking-tight flex flex-wrap items-center gap-1.5">
                <Target className="w-4 h-4 text-indigo-600 animate-pulse animate-duration-2000" />
                <span>Focus Session Plan</span>
                {task.aiFocusPlan && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-150/60 rounded-full px-2.5 py-0.5 ml-1 shrink-0">
                    {completedSessions.length} / {task.aiFocusPlan.sessions.length} Done
                  </span>
                )}
              </h4>
            </div>

            {/* Generate, clear or toggle actions */}
            <div className="shrink-0 flex items-center gap-2">
              {task.aiFocusPlan && (
                <button
                  onClick={() => {
                    const newVal = !showFocusPlanDetail;
                    setShowFocusPlanDetail(newVal);
                    sessionFocusPlanPreferences.set(task.id, newVal);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                  id={`toggle-focus-plan-btn-${task.id}`}
                >
                  {showFocusPlanDetail ? (
                    <>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                      <span>Hide Plan</span>
                    </>
                  ) : (
                    <>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                      <span>Show Plan</span>
                    </>
                  )}
                </button>
              )}

              {!task.aiFocusPlan && !temporaryPlan ? (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={generateFocusPlan}
                    disabled={isPlanningFocus}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                      isPlanningFocus
                        ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                        : "bg-indigo-600 hover:bg-indigo-700 border-indigo-600 text-white shadow-2xs hover:scale-[1.01]"
                    }`}
                    id={`focus-plan-gen-btn-${task.id}`}
                  >
                    {isPlanningFocus ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
                    )}
                    <span>{isPlanningFocus ? "AI Planning..." : "⚡ AI Plan"}</span>
                  </button>
                  <button
                    onClick={handleCreateCustomPlan}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-amber-200 bg-amber-50/50 hover:bg-amber-100 text-amber-700 cursor-pointer transition-all hover:scale-[1.01]"
                    id={`focus-plan-custom-btn-${task.id}`}
                  >
                    <Edit3 className="w-3.5 h-3.5 text-amber-500" />
                    <span>Custom Plan</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={task.aiFocusPlan ? handleClearFocusPlan : handleIgnoreFocusPlan}
                  className="px-3 py-1.5 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                  id={`focus-plan-clear-btn-${task.id}`}
                >
                  {task.aiFocusPlan ? "Clear Plan" : "Ignore"}
                </button>
              )}
            </div>
          </div>

          {/* Error notification if focus planning fails */}
          {focusPlanError && (
            <div className="p-3 mb-3 rounded-xl bg-rose-50 border border-rose-100 text-xs text-rose-700 flex items-start gap-2.5 text-left animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Focus Planner Error</p>
                <p className="opacity-95 mt-0.5">{focusPlanError}</p>
              </div>
            </div>
          )}

          <motion.div
            initial={false}
            animate={{
              height: (showFocusPlanDetail || isPlanningFocus || temporaryPlan) ? "auto" : 0,
              opacity: (showFocusPlanDetail || isPlanningFocus || temporaryPlan) ? 1 : 0,
              marginTop: (showFocusPlanDetail || isPlanningFocus || temporaryPlan) ? 12 : 0,
            }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            {/* Scenario 1: No plan generated yet */}
            {!task.aiFocusPlan && !temporaryPlan && !isPlanningFocus && (
              <div className="py-2.5 text-center text-xs text-slate-500 font-sans leading-relaxed">
                <span>Map out your session to beat procrastination. Create a sequence of structured focus blocks with tailored breaks.</span>
              </div>
            )}

            {/* Scenario 2: Loading State */}
            {isPlanningFocus && (
              <div className="py-6 flex flex-col items-center justify-center gap-3 text-slate-400 font-sans animate-pulse">
                <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
                <div className="text-center">
                  <p className="text-xs font-bold text-slate-700">Deconstructing Task Scope...</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Gemini is designing cognitive intervals tailored for "{task.title}".</p>
                </div>
              </div>
            )}

            {/* Scenario 3: Proposed temporary plan (Accept/Ignore phase) */}
            {temporaryPlan && (
              <div className="space-y-4 animate-slideDown">
                <div className="bg-amber-50/40 border border-dashed border-amber-300 rounded-xl p-3 text-left">
                  <p className="text-[11px] font-bold text-amber-800 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>Proposed Focus Plan</span>
                  </p>
                  <p className="text-[11px] text-amber-700 mt-1">
                    Review the structured focus sessions below. Accept this recommendation to save it as your active plan.
                  </p>
                </div>

                <div className="space-y-3">
                  {temporaryPlan.sessions.map((session, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-3xs flex flex-col gap-2.5 text-left"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                        <span className="text-[11px] font-extrabold text-indigo-600 font-mono tracking-wider">
                          Session {session.sessionNumber}:
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10.5px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{session.duration}</span>
                          </span>
                          <span className="text-[10.5px] font-mono font-bold px-2 py-0.5 rounded bg-amber-50 border border-amber-100 text-amber-700 flex items-center gap-1">
                            <Coffee className="w-3 h-3 text-amber-500" />
                            <span>Break: {session.breakDuration}</span>
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div>
                          <span className="text-[9.5px] font-mono font-bold text-slate-400 block uppercase">Task</span>
                          <p className="text-xs font-extrabold text-slate-800 leading-snug">{session.task}</p>
                        </div>
                        <div>
                          <span className="text-[9.5px] font-mono font-bold text-slate-400 block uppercase">Goal</span>
                          <p className="text-[11.5px] text-slate-600 font-medium leading-relaxed">{session.goal}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Accept/Ignore Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-indigo-100/50">
                  <button
                    onClick={handleIgnoreFocusPlan}
                    className="px-3.5 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold cursor-pointer transition-colors animate-pulse-slow"
                  >
                    Ignore Plan
                  </button>
                  <button
                    onClick={handleAcceptFocusPlan}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 border border-indigo-600 text-white rounded-lg text-xs font-bold shadow-2xs cursor-pointer transition-colors"
                  >
                    Accept Plan
                  </button>
                </div>
              </div>
            )}

            {/* Scenario 4: Active Saved Plan (Normal Mode) */}
            {task.aiFocusPlan && !isEditingPlan && (
              <div className="space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between text-left">
                  {task.aiFocusPlan.isCustomized ? (
                    <span className="text-[10px] font-bold text-amber-750 bg-amber-50 border border-amber-200/60 rounded-full px-2.5 py-0.5 flex items-center gap-1 shadow-3xs">
                      <Edit3 className="w-3 h-3 text-amber-600" />
                      <span>Customized Focus Plan</span>
                    </span>
                  ) : task.aiFocusPlan.isDefaultLocal ? (
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/60 rounded-full px-2.5 py-0.5 flex items-center gap-1 shadow-3xs">
                      <Sparkles className="w-3 h-3 text-indigo-600 animate-pulse" />
                      <span>Default Focus Plan</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-150/60 rounded-full px-2.5 py-0.5 flex items-center gap-1 shadow-3xs">
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>Active Focus Plan Loaded</span>
                    </span>
                  )}
                  <span className="text-[9px] font-medium text-slate-400 font-mono">
                    Progress: {completedSessions.length} / {task.aiFocusPlan.sessions.length} sessions
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-1.5 bg-slate-100 border border-slate-200/40 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    style={{
                      width: `${
                        (completedSessions.length / task.aiFocusPlan.sessions.length) * 100
                      }%`,
                    }}
                  />
                </div>

                <div className="space-y-3">
                  {task.aiFocusPlan.sessions.map((session, idx) => {
                    const isSessionCompleted = completedSessions.includes(session.sessionNumber);
                    return (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-xl border transition-all duration-200 text-left flex flex-col gap-2.5 relative ${
                          isSessionCompleted
                            ? "bg-emerald-50/10 border-emerald-200/50 opacity-75 shadow-none"
                            : "bg-white border-indigo-100/80 shadow-3xs hover:border-indigo-200"
                        }`}
                      >
                        {/* Checkbox to mark complete */}
                        <div className="flex items-start justify-between gap-3 border-b border-slate-100/80 pb-2">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleSessionComplete(session.sessionNumber)}
                              className={`w-4 h-4 rounded border flex items-center justify-center transition-all cursor-pointer ${
                                isSessionCompleted
                                  ? "bg-emerald-500 border-emerald-500 text-white"
                                  : "border-slate-300 hover:border-indigo-500 bg-white"
                              }`}
                              title={isSessionCompleted ? "Mark session active" : "Mark session finished"}
                            >
                              {isSessionCompleted && <Check className="w-3 h-3" />}
                            </button>
                            <span
                              className={`text-[11px] font-black font-mono tracking-wider uppercase ${
                                isSessionCompleted ? "text-emerald-700" : "text-indigo-600"
                              }`}
                            >
                              Session {session.sessionNumber}:
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 select-none">
                            <span
                              className={`text-[10.5px] font-mono font-semibold px-2 py-0.5 rounded flex items-center gap-1 ${
                                isSessionCompleted
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-50 text-slate-600 border border-slate-200/60"
                              }`}
                            >
                              <Clock className="w-3 h-3 opacity-70" />
                              <span>{session.duration}</span>
                            </span>
                            <span
                              className={`text-[10.5px] font-mono font-semibold px-2 py-0.5 rounded flex items-center gap-1 ${
                                isSessionCompleted
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-indigo-50/40 text-indigo-700 border border-indigo-100/30"
                              }`}
                            >
                              <Coffee className="w-3 h-3 opacity-70" />
                              <span>Break: {session.breakDuration}</span>
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div>
                            <span className="text-[9.5px] font-mono font-bold text-slate-400 block uppercase">Task</span>
                            <p
                              className={`text-xs font-bold leading-snug ${
                                isSessionCompleted ? "text-slate-500 line-through" : "text-slate-800"
                              }`}
                            >
                              {session.task}
                            </p>
                          </div>
                          <div>
                            <span className="text-[9.5px] font-mono font-bold text-slate-400 block uppercase">Goal</span>
                            <p
                              className={`text-[11.5px] font-medium leading-relaxed ${
                                isSessionCompleted ? "text-slate-400 line-through" : "text-slate-600"
                              }`}
                            >
                              {session.goal}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Actions in footer */}
                <div className="flex items-center justify-between pt-2.5 border-t border-indigo-100/50 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={generateFocusPlan}
                      disabled={isPlanningFocus}
                      className="text-[11.5px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <RefreshCw className={`w-3 h-3 ${isPlanningFocus ? "animate-spin" : ""}`} />
                      <span>Re-Generate Plan</span>
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      onClick={startEditingPlan}
                      className="text-[11.5px] font-bold text-amber-600 hover:text-amber-800 flex items-center gap-1 cursor-pointer transition-colors"
                      id={`edit-plan-btn-${task.id}`}
                    >
                      <Edit3 className="w-3 h-3 text-amber-500" />
                      <span>Edit Plan</span>
                    </button>
                  </div>
                  <button
                    onClick={handleClearFocusPlan}
                    className="text-[11.5px] font-bold text-rose-600 hover:text-rose-800 cursor-pointer transition-colors"
                  >
                    Reset Focus Plan
                  </button>
                </div>
              </div>
            )}

            {/* Scenario 4: Active Saved Plan (Editing Mode) */}
            {task.aiFocusPlan && isEditingPlan && (
              <div className="space-y-4 animate-fadeIn" id={`focus-plan-edit-form-${task.id}`}>
                <div className="flex items-center justify-between text-left border-b border-indigo-100/50 pb-2">
                  <span className="text-[11px] font-black text-indigo-950 uppercase tracking-wider flex items-center gap-1">
                    <Edit3 className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Customize Focus Roadmap</span>
                  </span>
                  <span className="text-[10px] font-mono font-bold text-amber-600 bg-amber-50 border border-amber-200/40 px-2 py-0.5 rounded-md">
                    Customize Mode
                  </span>
                </div>

                <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                  {editedSessions.map((session, idx) => (
                    <div key={idx} className="p-3.5 rounded-2xl border border-indigo-100/80 bg-slate-50/50 text-left space-y-3 shadow-3xs">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                        <span className="text-[11px] font-mono font-black text-indigo-600 uppercase tracking-wide">
                          Session {session.sessionNumber} Settings
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-2.5 text-xs">
                        {/* Session Title */}
                        <div>
                          <label className="text-[9.5px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">
                            Session Title / Task
                          </label>
                          <input
                            type="text"
                            value={session.task}
                            onChange={(e) => handleUpdateSessionField(idx, "task", e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-xl font-bold text-slate-800 bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-hidden transition-all"
                            placeholder="e.g. Write code structure"
                          />
                        </div>

                        {/* Session Goal */}
                        <div>
                          <label className="text-[9.5px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">
                            Session Goal
                          </label>
                          <input
                            type="text"
                            value={session.goal}
                            onChange={(e) => handleUpdateSessionField(idx, "goal", e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-slate-700 bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-hidden transition-all"
                            placeholder="e.g. Complete basic endpoints"
                          />
                        </div>

                        {/* Durations */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[9.5px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">
                              Work Duration (e.g. 25m)
                            </label>
                            <input
                              type="text"
                              value={session.duration}
                              onChange={(e) => handleUpdateSessionField(idx, "duration", e.target.value)}
                              className="w-full px-3 py-1.5 border border-slate-200 rounded-xl font-mono text-slate-700 bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-hidden transition-all"
                              placeholder="e.g. 25 minutes"
                            />
                          </div>
                          <div>
                            <label className="text-[9.5px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">
                              Break Duration (e.g. 5m)
                            </label>
                            <input
                              type="text"
                              value={session.breakDuration}
                              onChange={(e) => handleUpdateSessionField(idx, "breakDuration", e.target.value)}
                              className="w-full px-3 py-1.5 border border-slate-200 rounded-xl font-mono text-slate-700 bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-hidden transition-all"
                              placeholder="e.g. 5 minutes"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Edit Actions buttons */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-indigo-100/50">
                  <button
                    onClick={handleCancelEditingPlan}
                    className="px-3.5 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEditedPlan}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-2xs cursor-pointer transition-colors flex items-center gap-1.5"
                    id={`save-edited-plan-${task.id}`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Edited Plan</span>
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* Action tray with inline confirm delete */}
      <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between gap-2 px-1">
        {showDeleteConfirm ? (
          <div className="flex items-center gap-2 w-full justify-between animate-fadeIn">
            <span className="text-xs font-semibold text-rose-600 select-none flex items-center gap-1">
              <Trash2 className="w-3.5 h-3.5 animate-pulse" />
              Scrub this task?
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => {
                  onDelete(task.id);
                  setShowDeleteConfirm(false);
                }}
                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-[11px] font-bold transition-colors cursor-pointer"
                id={`confirm-delete-${task.id}`}
              >
                Confirm
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[11px] font-bold transition-colors cursor-pointer"
                id={`cancel-delete-${task.id}`}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="text-slate-350 text-[10px] font-mono select-none">
              ID: {task.id.slice(0, 8)}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={startEditing}
                className="p-1.5 text-gray-400 hover:text-slate-800 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                title="Edit Task Coordinates"
                id={`edit-task-${task.id}`}
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                title="Scrub from logs (Delete)"
                id={`delete-task-${task.id}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
