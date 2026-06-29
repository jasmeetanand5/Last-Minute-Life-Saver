import React, { useState } from "react";
import { motion } from "motion/react";
import { Task } from "../types";
import { analyzeTaskDeadline, isTaskPanicQualifying, calculateTaskRisk } from "../utils";
import { Flame, CheckCircle, ArrowLeft, Clock, Zap, ExternalLink, ShieldAlert, Sparkles, AlertCircle, Trash2, Check, Lightbulb } from "lucide-react";

interface PanicModeProps {
  tasks: Task[];
  now: Date;
  onToggleComplete: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onExit: () => void;
  
  // Timer & Focus states
  activeFocusTaskId?: string | null;
  focusTimeRemaining?: number;
  isFocusPaused?: boolean;
  focusSessionDuration?: number;
  onStartFocusSession?: (id: string, durationSeconds?: number) => void;
  onToggleFocusPause?: () => void;
  onEndFocusSession?: () => void;
  onMinimizeFocus?: () => void;
}

export default function PanicMode({ 
  tasks, 
  now, 
  onToggleComplete, 
  onDeleteTask, 
  onExit,
  activeFocusTaskId = null,
  focusTimeRemaining = 45 * 60,
  isFocusPaused = false,
  focusSessionDuration = 45 * 60,
  onStartFocusSession,
  onToggleFocusPause,
  onEndFocusSession,
  onMinimizeFocus
}: PanicModeProps) {
  const [localFocusedTaskId, setLocalFocusedTaskId] = useState<string | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);

  // Determine the current focused/active task ID
  const currentFocusedId = activeFocusTaskId !== null ? activeFocusTaskId : localFocusedTaskId;

  // Critical tasks: qualifying under critical conditions
  // Sorted nearest deadline / overdue first
  const criticalTasks = tasks
    .filter(t => isTaskPanicQualifying(t, now))
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());

  // Calculate total effort remaining
  const totalEffortRemaining = criticalTasks.reduce((sum, t) => sum + t.estimatedEffort, 0);

  const highestPriorityTask = criticalTasks[0];

  const handleStartHighestPriority = () => {
    if (highestPriorityTask) {
      if (onStartFocusSession) {
        onStartFocusSession(highestPriorityTask.id, 45 * 60);
      } else {
        setLocalFocusedTaskId(highestPriorityTask.id);
      }
      setTimeout(() => {
        const element = document.getElementById(`panic-task-card-${highestPriorityTask.id}`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 50);
    }
  };

  // Clean next action assistant
  const getNextAction = (notes?: string): string => {
    if (!notes || notes.trim() === "") {
      return "Break this work statement down into 20-minute rapid interval blocks. Close all irrelevant browser tabs & begin executing immediately.";
    }
    return notes.trim();
  };

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900 flex flex-col font-sans transition-all duration-300 animate-fadeIn" id="panic-mode-container">
      {/* Pristine Modern SaaS Header */}
      <header className="bg-white border-b border-slate-200/80 py-4 px-4 sticky top-0 z-20 shadow-2xs backdrop-blur-md" id="panic-header">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-xl text-slate-700">
              <Zap className="w-5 h-5 text-indigo-600 animate-pulse" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-slate-900 flex items-center gap-1.5 font-sans">
                Hyper-Focus Mode
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-400 font-mono tracking-wider font-semibold uppercase">
                CRITICAL IMPENDING TARGETS • {criticalTasks.length} TASK{criticalTasks.length === 1 ? "" : "S"} UNDER 24H
              </p>
            </div>
          </div>
          
          <button
            onClick={onExit}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-white border border-slate-200/80 hover:bg-slate-50 hover:text-slate-950 rounded-xl transition-all cursor-pointer shadow-3xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 space-y-6" id="panic-main">
        {/* Calm High-Contrast Focus Insights Block */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs grid grid-cols-1 sm:grid-cols-3 gap-5" id="panic-sum-card">
          <div className="text-left">
            <span className="text-[10px] font-mono tracking-wider font-extrabold text-slate-400 uppercase block leading-none">Focus Workload</span>
            <div className="text-2xl font-black text-slate-900 font-sans tracking-tight mt-1.5">{totalEffortRemaining.toFixed(1)} hrs</div>
            <p className="text-[11px] text-slate-500 mt-1 leading-normal">Estimated work effort needed to secure your deadlines.</p>
          </div>
          
          <div className="hidden sm:block h-full w-px bg-slate-200/70 self-center"></div>
          
          <div className="text-left">
            <span className="text-[10px] font-mono tracking-wider font-extrabold text-slate-400 uppercase block leading-none">Task Buffer Strain</span>
            <div className="text-2xl font-black text-slate-900 font-sans tracking-tight mt-1.5">{criticalTasks.length} Impending</div>
            <p className="text-[11px] text-slate-500 mt-1 leading-normal">Active items requiring priority intervention.</p>
          </div>

          <div className="hidden sm:block h-full w-px bg-slate-200/70 self-center"></div>
          
          <div className="text-left">
            <span className="text-[10px] font-mono tracking-wider font-extrabold text-slate-400 uppercase block leading-none">Reference Clock</span>
            <div className="text-2xl font-mono font-bold text-indigo-600 mt-1.5">
              {now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 leading-normal">Current active clock. Keep focus locked.</p>
          </div>
        </div>

        {/* Countdown Timer inside Panic Mode Workspace */}
        {currentFocusedId && focusTimeRemaining !== undefined && focusSessionDuration !== undefined && (() => {
          const activeTask = tasks.find(t => t.id === currentFocusedId);
          if (!activeTask) return null;

          const minutes = Math.floor(focusTimeRemaining / 60);
          const seconds = focusTimeRemaining % 60;
          const progressPercent = (focusTimeRemaining / focusSessionDuration) * 100;

          return (
            <div className="bg-linear-to-r from-indigo-950 via-slate-900 to-indigo-950 border border-indigo-500/40 p-5 rounded-3xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-5 text-white relative overflow-hidden animate-fadeIn mb-6" id="panic-focus-timer-banner">
              {/* Visual Accent Glows */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>
              
              <div className="flex items-center gap-4 text-left w-full md:w-auto relative z-10">
                <div className="relative flex items-center justify-center w-12 h-12 shrink-0 bg-slate-950/60 rounded-full border border-indigo-500/30">
                  {!isFocusPaused && (
                    <span className="absolute inset-0 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></span>
                  )}
                  <span className="text-xl">🎯</span>
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[9px] font-bold font-mono tracking-widest text-indigo-400 uppercase flex items-center gap-1.5 leading-none">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping"></span>
                    HYPER FOCUS ACTIVE SESSION
                  </span>
                  <h3 className="text-sm font-black text-white truncate mt-1" title={activeTask.title}>
                    {activeTask.title}
                  </h3>
                  <p className="text-[10px] text-indigo-200 mt-0.5">
                    {isFocusPaused ? "Session paused" : "Deep work countdown active. Distractions filtered."}
                  </p>
                </div>
              </div>

              {/* Progress bar and countdown timer */}
              <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end shrink-0 relative z-10">
                <div className="flex flex-col items-start md:items-end">
                  <span className="text-[9px] font-bold font-mono text-indigo-400 tracking-wider">TIME REMAINING</span>
                  <div className="text-2xl font-mono font-black tracking-widest text-indigo-300">
                    {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                  </div>
                  {/* Horizontal progress bar */}
                  <div className="w-28 bg-slate-950/50 h-1.5 rounded-full overflow-hidden mt-1 border border-indigo-950">
                    <div 
                      className="bg-indigo-500 h-full rounded-full transition-all duration-1000"
                      style={{ width: `${progressPercent}%` }}
                    ></div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={onToggleFocusPause}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold tracking-wider cursor-pointer transition-all flex items-center gap-1.5 ${
                      isFocusPaused 
                        ? "bg-indigo-600 hover:bg-indigo-550 text-white shadow-xs shadow-indigo-500/20" 
                        : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60"
                    }`}
                  >
                    {isFocusPaused ? "▶ Resume" : "⏸ Pause"}
                  </button>
                  {onMinimizeFocus && (
                    <button
                      onClick={onMinimizeFocus}
                      className="px-3.5 py-2 bg-slate-850 hover:bg-slate-800 text-indigo-300 hover:text-indigo-200 border border-indigo-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      ← Return to Workspace
                    </button>
                  )}
                  <button
                    onClick={onEndFocusSession}
                    className="px-3.5 py-2 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 hover:border-rose-500/50 text-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    ⏹ End Session
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Start Highest Priority Task Primary Call-to-Action Banner */}
        {criticalTasks.length > 0 && !currentFocusedId && (
          <div className="bg-indigo-600 text-white rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-md text-left transition-all hover:shadow-lg animate-fadeIn border border-indigo-500">
            <div className="space-y-1">
              <span className="text-[10px] font-mono tracking-wider font-extrabold text-indigo-200 uppercase block">recommended workspace focus</span>
              <h3 className="font-sans font-black text-white text-base leading-snug">
                Lock Focus Immediately
              </h3>
              <p className="text-xs text-indigo-100 flex items-center gap-1.5 leading-snug">
                <Sparkles className="w-3.5 h-3.5 shrink-0 text-indigo-300" />
                <span>Automatically highlight and position the most critical task on your stack.</span>
              </p>
            </div>
            
            <button
              onClick={handleStartHighestPriority}
              className="shrink-0 flex items-center justify-center gap-2 px-5 py-3 bg-white hover:bg-slate-50 text-indigo-600 font-sans font-black text-xs tracking-wider rounded-xl shadow-xs hover:scale-[1.02] cursor-pointer transition-all active:scale-97"
            >
              <span>🚀 Start Highest Priority Task</span>
            </button>
          </div>
        )}

        {/* Clear feedback if nothing is left */}
        {criticalTasks.length === 0 ? (
          <div className="text-center py-16 px-6 bg-white border border-slate-200/80 rounded-3xl space-y-4 shadow-3xs" id="panic-empty">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-150 shadow-2xs">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-black text-slate-900">✅ No immediate deadline risks detected.</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                No active deadlines under 24 hours require extreme measures. You have navigated critical risks successfully!
              </p>
            </div>
            <button
              onClick={onExit}
              className="mt-2 px-5 py-2 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-all cursor-pointer shadow-sm"
            >
              Standard Workspace
            </button>
          </div>
        ) : (
          <div className="space-y-4" id="panic-tasks-list">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest font-mono">
                🎯 active stress-point tracking
              </span>
              <span className="text-[10px] font-bold text-indigo-600 font-mono bg-indigo-50 px-2 py-0.5 rounded">
                High Priority Mode Enabled
              </span>
            </div>

            {criticalTasks
              .filter(task => !currentFocusedId || task.id === currentFocusedId)
              .map(task => {
                const analysis = analyzeTaskDeadline(task, now);
                const activeTasksCount = tasks.filter(t => !t.completed).length;
                const riskAssessment = calculateTaskRisk(task, activeTasksCount, now);
                const isOverdue = analysis.hoursRemaining <= 0;
                const isFocused = task.id === currentFocusedId;
              
              // Get domain for resource icon
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

              return (
                <div
                  key={task.id}
                  className={`bg-white border rounded-2xl p-6 transition-all duration-300 relative overflow-hidden ${
                    isFocused
                      ? "ring-4 ring-indigo-500/65 border-indigo-500 bg-indigo-50/5 shadow-md scale-[1.015] z-10"
                      : isOverdue
                        ? "border-rose-300 hover:border-rose-450 shadow-2xs"
                        : "border-slate-200/80 hover:border-slate-300 shadow-2xs"
                  }`}
                  id={`panic-task-card-${task.id}`}
                >
                  {/* Subtle Top warning accent bar instead of full heavy neon cards */}
                  <div className={`absolute top-0 left-0 right-0 h-1.5 ${isFocused ? "bg-indigo-600" : isOverdue ? "bg-rose-500" : "bg-amber-400"}`} />

                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5 text-left mt-1">
                    <div className="space-y-4 min-w-0 flex-1">
                      
                      {/* Task Headers & Metadata pill labels */}
                      <div className="flex flex-wrap items-center gap-2">
                        {isFocused && (
                          <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono tracking-wider uppercase bg-indigo-600 text-white flex items-center gap-1 shrink-0 shadow-2xs animate-pulse">
                            <Sparkles className="w-3.5 h-3.5 shrink-0" />
                            <span>Active Focus Target</span>
                          </span>
                        )}

                        {isOverdue ? (
                          <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono tracking-wider uppercase bg-rose-50 text-rose-750 border border-rose-200/60 flex items-center gap-1 shrink-0">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                            <span>Overdue: {analysis.countdownText}</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono tracking-wider uppercase bg-amber-50 text-amber-800 border border-amber-200/60 flex items-center gap-1 shrink-0">
                            <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span>T-Minus: {analysis.countdownText}</span>
                          </span>
                        )}

                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono tracking-wider uppercase bg-slate-100 text-slate-600 border border-slate-200/60">
                          {task.category || "Work"}
                        </span>

                        {/* AI Risk Assessment tag */}
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono tracking-wider uppercase border shadow-3xs ${riskAssessment.color} ${riskAssessment.bg} ${riskAssessment.border}`}>
                          Risk: {riskAssessment.level}
                        </span>
                      </div>

                      {/* Task At Risk (Title) */}
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono block">
                          TASK AT RISK
                        </span>
                        <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug tracking-tight">
                          {task.title}
                        </h3>
                      </div>

                      {/* Streamlined AI Risk & Action Dashboard */}
                      <div className="mt-4 p-4 rounded-xl border border-slate-200 bg-white/70 space-y-4">
                        
                        {/* Task Status */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/60 text-left">
                          <div>
                            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest font-mono block mb-1">
                              TASK STATUS
                            </span>
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-md border uppercase shadow-3xs ${riskAssessment.color} ${riskAssessment.bg} ${riskAssessment.border}`}>
                                {riskAssessment.level} Risk
                              </span>
                              <span className="text-xs font-medium text-slate-500 font-sans">
                                • {isOverdue ? "Overdue / Past Deadline" : `${analysis.hoursRemaining.toFixed(1)} hours remaining`}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Recommended Next Action */}
                        <div className="text-left min-w-0">
                          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest font-mono block mb-1.5">
                            RECOMMENDED NEXT ACTION
                          </span>
                          <div className={`border rounded-xl p-3 flex items-start gap-2 shadow-3xs text-xs font-semibold min-w-0 ${
                            isOverdue 
                              ? "bg-rose-50/20 border-rose-150 text-rose-900" 
                              : "bg-indigo-50/20 border-indigo-150 text-indigo-900"
                          }`}>
                            <Check className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                            <span className="flex-1 break-words min-w-0">{task.aiAnalysis ? task.aiAnalysis.recommendedNextAction : getNextAction(task.notes)}</span>
                          </div>
                        </div>

                        {/* Task Breakdown & AI Advice (Only if AI Analysis is run) */}
                        {task.aiAnalysis ? (
                          <div className="space-y-4 divide-y divide-slate-200/40 min-w-0">
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
                        ) : (
                          <div className="text-[11px] text-slate-400 text-left italic font-sans">
                            * For granular breakdowns, please trigger "Generate Action Steps" on the main dashboard task card.
                          </div>
                        )}
                      </div>

                      {/* Display Link if exists */}
                      {task.resourceLink && (
                        <div className="flex items-center gap-2 pt-0.5">
                          <a
                            href={task.resourceLink.startsWith("http") ? task.resourceLink : `https://${task.resourceLink}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.8 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer border border-slate-200/80 shadow-3xs"
                          >
                            {faviconUrl ? (
                              <img
                                src={faviconUrl}
                                alt=""
                                className="w-3.5 h-3.5 rounded-xs shrink-0 select-none bg-white p-0.5 inline-block"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
                            )}
                            <span>Open Reference Link</span>
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Actions panel */}
                    <div className="sm:self-center shrink-0 w-full sm:w-auto">
                      {deletingTaskId === task.id ? (
                        <div className="flex flex-col sm:flex-row items-center gap-2 bg-rose-50 border border-rose-200/95 p-2.5 rounded-xl animate-fadeIn w-full">
                          <span className="text-[11px] font-sans font-bold text-rose-700 px-2 text-center sm:text-left leading-tight shrink-0">
                            Scrub this critical task from logs?
                          </span>
                          <div className="flex gap-1.5 w-full sm:w-auto">
                            <button
                              onClick={() => {
                                onDeleteTask(task.id);
                                setDeletingTaskId(null);
                              }}
                              className="flex-1 sm:flex-none px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-sans font-extrabold text-xs rounded-lg transition-colors cursor-pointer text-center"
                              id={`panic-confirm-delete-${task.id}`}
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setDeletingTaskId(null)}
                              className="flex-1 sm:flex-none px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-sans font-medium text-xs rounded-lg transition-colors cursor-pointer text-center"
                              id={`panic-cancel-delete-${task.id}`}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full">
                          <div className="relative w-full sm:w-auto flex grow">
                            <button
                              onClick={() => {
                                setCompletingTaskId(task.id);
                                setTimeout(() => {
                                  onToggleComplete(task.id);
                                  setCompletingTaskId(null);
                                }, 500);
                              }}
                              className="w-full px-5 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-sans font-extrabold text-xs tracking-wider rounded-xl hover:scale-[1.01] active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:shadow-md grow"
                            >
                              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 fill-slate-950 font-black animate-pulse" />
                              <span>MARK COMPLETED</span>
                            </button>
                            {completingTaskId === task.id && (
                              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-30">
                                {[...Array(16)].map((_, i) => {
                                  const angle = (i * 360) / 16;
                                  const distance = 35 + Math.random() * 35;
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
                                        scale: [0, 1.4, 0.8, 0],
                                        x: x,
                                        y: y,
                                        opacity: [1, 1, 0.4, 0]
                                      }}
                                      transition={{
                                        duration: 0.5,
                                        ease: "easeOut"
                                      }}
                                    />
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => setDeletingTaskId(task.id)}
                            className="w-full sm:w-auto px-4 py-3.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-sans font-extrabold text-xs tracking-wider rounded-xl hover:scale-[1.01] transition-all flex items-center justify-center gap-2 cursor-pointer border border-rose-200 transition-colors"
                            title="Scrub from logs"
                            id={`panic-delete-btn-${task.id}`}
                          >
                            <Trash2 className="w-4 h-4 shrink-0 text-rose-500" />
                            <span>SCRUB</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Calm minimalist focus text */}
        <div className="text-center text-slate-400 text-xs font-mono py-6" id="panic-footer">
          🧘 Drink water • Take 3 deep breaths • Eliminate active distractions • Action cures anxiety.
        </div>
      </main>
    </div>
  );
}
