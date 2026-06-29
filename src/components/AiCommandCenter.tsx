import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  Sparkles, 
  RefreshCw, 
  AlertTriangle, 
  Play, 
  Hourglass, 
  ShieldAlert, 
  Target, 
  ShieldCheck, 
  ListOrdered, 
  X,
  Check,
  ChevronDown, 
  ChevronRight,
  Info
} from "lucide-react";
import { Task } from "../types";
import { calculateTaskRisk, calculateEstimatedTaskFinish } from "../utils";

interface AiCommandCenterProps {
  tasks: Task[];
  now: Date;
  onApplyQueue: (taskIds: string[]) => void;
  onResetQueue: () => void;
  isQueueApplied: boolean;
  onFocusTask: (taskId: string) => void;
  onStartWorkingTask: (taskId: string) => void;
}

interface RescueResult {
  recommendedTask: string;
  reason: string;
  nextAction: string;
  estimatedFocusTime: string;
  riskIfIgnored: "Low" | "Medium" | "High";
  isFallback?: boolean;
}

interface ConflictResult {
  conflictDetected: boolean;
  conflictingTasks: string[];
  explanation: string;
  prioritizedTask: string;
  prioritizedReason: string;
}

interface QueueItem {
  id: string;
  title: string;
  reason: string;
}

export default function AiCommandCenter({ 
  tasks, 
  now, 
  onApplyQueue, 
  onResetQueue, 
  isQueueApplied, 
  onFocusTask, 
  onStartWorkingTask 
}: AiCommandCenterProps) {
  // Independent accordion states for compact cards
  const [isQueueExpanded, setIsQueueExpanded] = useState(false);
  const [isRescueExpanded, setIsRescueExpanded] = useState(false);
  const [isConflictExpanded, setIsConflictExpanded] = useState(false);

  // Smart Rescue Plan State
  const [isRescueLoading, setIsRescueLoading] = useState(false);
  const [rescueResult, setRescueResult] = useState<RescueResult | null>(null);
  const [rescueError, setRescueError] = useState<string | null>(null);
  const [cachedRescuePlan, setCachedRescuePlan] = useState<{ result: RescueResult; generatedAt: string } | null>(null);
  const [isShowingRescueCached, setIsShowingRescueCached] = useState(false);

  // Workload Conflict Detector State
  const [isConflictLoading, setIsConflictLoading] = useState(false);
  const [conflictResult, setConflictResult] = useState<ConflictResult | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);

  // Intelligent Queue State
  const [isQueueLoading, setIsQueueLoading] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [queueSummary, setQueueSummary] = useState<string>("");
  const [queueError, setQueueError] = useState<string | null>(null);
  const [cachedQueue, setCachedQueue] = useState<{ queue: QueueItem[]; summary: string; generatedAt: string } | null>(null);
  const [isShowingQueueCached, setIsShowingQueueCached] = useState(false);

  const activeTasks = tasks.filter((t) => !t.completed);

  // 1. Load Caches on Mount
  useEffect(() => {
    // Rescue cache
    const cachedRescue = localStorage.getItem("SMART_RESCUE_PLAN_CACHE");
    if (cachedRescue) {
      try {
        const parsed = JSON.parse(cachedRescue);
        if (parsed && parsed.result && parsed.generatedAt) {
          setCachedRescuePlan(parsed);
          setRescueResult(parsed.result);
          setIsShowingRescueCached(true);
        }
      } catch (e) {
        console.error("Failed to parse cached rescue plan:", e);
      }
    }

    // Queue cache
    const cachedQ = localStorage.getItem("INTELLIGENT_QUEUE_CACHE");
    if (cachedQ) {
      try {
        const parsed = JSON.parse(cachedQ);
        if (parsed && Array.isArray(parsed.queue) && parsed.generatedAt) {
          setCachedQueue(parsed);
          setQueue(parsed.queue);
          setQueueSummary(parsed.summary || "");
          setIsShowingQueueCached(true);
        }
      } catch (e) {
        console.error("Failed to parse cached queue:", e);
      }
    }
  }, []);

  // Sync / clear rescue cache if recommended task gets completed or deleted
  useEffect(() => {
    if (rescueResult) {
      const isStillActive = tasks.some(
        (t) => !t.completed && t.title.toLowerCase().trim() === rescueResult.recommendedTask.toLowerCase().trim()
      );
      if (!isStillActive) {
        localStorage.removeItem("SMART_RESCUE_PLAN_CACHE");
        setRescueResult(null);
        setCachedRescuePlan(null);
        setIsShowingRescueCached(false);
      }
    }
  }, [tasks, rescueResult]);

  // Keys to watch active tasks changes
  const activeTasksKey = activeTasks
    .map((t) => `${t.id}-${t.completed}-${t.deadline}`)
    .join("|");

  // 2. Fetch / Run API functions
  const runRescueAnalysis = async (force = false) => {
    if (activeTasks.length === 0) {
      setRescueResult(null);
      return;
    }

    if (!force && rescueResult) {
      return;
    }

    setIsRescueLoading(true);
    setRescueError(null);
    setIsShowingRescueCached(false);

    try {
      const response = await fetch("/api/smart-rescue-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tasks: activeTasks,
          currentTime: now.toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to reach server");
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      if (data.isFallback) {
        const cached = localStorage.getItem("SMART_RESCUE_PLAN_CACHE");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.result) {
            setRescueResult(parsed.result);
            setIsShowingRescueCached(true);
            return;
          }
        }
      }

      setRescueResult(data);

      if (!data.isFallback) {
        const timestamp = new Date().toLocaleString([], { 
          month: 'short', 
          day: 'numeric', 
          hour: 'numeric', 
          minute: '2-digit', 
          second: '2-digit' 
        });
        const cacheObj = { result: data, generatedAt: timestamp };
        localStorage.setItem("SMART_RESCUE_PLAN_CACHE", JSON.stringify(cacheObj));
        setCachedRescuePlan(cacheObj);
      }
    } catch (err: any) {
      console.error("Rescue Plan API Error:", err);
      const cached = localStorage.getItem("SMART_RESCUE_PLAN_CACHE");
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.result) {
            setRescueResult(parsed.result);
            setIsShowingRescueCached(true);
            return;
          }
        } catch (e) {}
      }
      setRescueError("AI could not build your Smart Rescue Plan at the moment.");
    } finally {
      setIsRescueLoading(false);
    }
  };

  const runConflictAnalysis = async () => {
    if (activeTasks.length === 0) {
      setConflictResult({
        conflictDetected: false,
        conflictingTasks: [],
        explanation: "All quiet. You currently have no active tasks.",
        prioritizedTask: "",
        prioritizedReason: ""
      });
      return;
    }

    setIsConflictLoading(true);
    setConflictError(null);
    try {
      const response = await fetch("/api/workload-conflict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tasks: activeTasks,
          currentTime: now.toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to contact backend API");
      }

      const data = await response.json();
      setConflictResult(data);
    } catch (err: any) {
      console.error("Conflict Analysis Error:", err);
      setConflictError("Unable to run workload conflict assessment.");
    } finally {
      setIsConflictLoading(false);
    }
  };

  const runQueueAnalysis = async (force = false) => {
    if (activeTasks.length === 0) {
      setQueue([]);
      setQueueSummary("");
      return;
    }

    if (!force && queue.length > 0) {
      return;
    }

    setIsQueueLoading(true);
    setQueueError(null);
    setIsShowingQueueCached(false);

    try {
      const response = await fetch("/api/intelligent-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tasks: activeTasks,
          currentTime: now.toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to contact server");
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      if (data.isFallback) {
        const cached = localStorage.getItem("INTELLIGENT_QUEUE_CACHE");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && Array.isArray(parsed.queue)) {
            setQueue(parsed.queue);
            setQueueSummary(parsed.summary || "");
            setIsShowingQueueCached(true);
            return;
          }
        }
      }

      setQueue(data.recommendedOrder || []);
      setQueueSummary(data.analysisSummary || "");

      if (!data.isFallback) {
        const timestamp = new Date().toLocaleString([], { 
          month: 'short', 
          day: 'numeric', 
          hour: 'numeric', 
          minute: '2-digit', 
          second: '2-digit' 
        });
        const cacheObj = {
          queue: data.recommendedOrder || [],
          summary: data.analysisSummary || "",
          generatedAt: timestamp
        };
        localStorage.setItem("INTELLIGENT_QUEUE_CACHE", JSON.stringify(cacheObj));
        setCachedQueue(cacheObj);
      }
    } catch (err: any) {
      console.error("Queue API Error:", err);
      const cached = localStorage.getItem("INTELLIGENT_QUEUE_CACHE");
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && Array.isArray(parsed.queue)) {
            setQueue(parsed.queue);
            setQueueSummary(parsed.summary || "");
            setIsShowingQueueCached(true);
            return;
          }
        } catch (e) {}
      }
      setQueueError("Unable to build recommended task order.");
    } finally {
      setIsQueueLoading(false);
    }
  };

  // Auto-run on mount or list changes
  useEffect(() => {
    runRescueAnalysis();
    runConflictAnalysis();
    runQueueAnalysis();
  }, [activeTasksKey]);

  // Handle Accept / Ignore for sequence reorganization
  const handleAcceptQueue = () => {
    const ids = queue.map((q) => q.id);
    onApplyQueue(ids);
  };

  const handleIgnoreQueue = () => {
    onResetQueue();
  };

  // Determine Today's Top Priority details
  let topPriorityTitle = "";
  let topPriorityReason = "";
  let recommendedNextAction = "";
  let estimatedFocusTime = "";
  let sourceLabel = "";

  if (rescueResult && rescueResult.recommendedTask) {
    topPriorityTitle = rescueResult.recommendedTask;
    topPriorityReason = rescueResult.reason;
    recommendedNextAction = rescueResult.nextAction;
    estimatedFocusTime = rescueResult.estimatedFocusTime;
    sourceLabel = "Rescue Priority";
  } else if (conflictResult && conflictResult.conflictDetected && conflictResult.prioritizedTask) {
    topPriorityTitle = conflictResult.prioritizedTask;
    topPriorityReason = conflictResult.prioritizedReason || conflictResult.explanation;
    recommendedNextAction = "Resolve overlapping workload priority immediately.";
    const tObj = activeTasks.find(t => t.title.toLowerCase().trim() === topPriorityTitle.toLowerCase().trim());
    estimatedFocusTime = tObj ? `${tObj.estimatedEffort}h` : "N/A";
    sourceLabel = "Conflict Resolver";
  } else if (queue.length > 0) {
    const topItem = queue[0];
    topPriorityTitle = topItem.title;
    topPriorityReason = topItem.reason;
    recommendedNextAction = "Start task execution according to your intelligent queue strategy.";
    const tObj = activeTasks.find(t => t.id === topItem.id);
    estimatedFocusTime = tObj ? `${tObj.estimatedEffort}h` : "N/A";
    sourceLabel = "Queue Priority";
  } else if (activeTasks.length > 0) {
    const sortedActiveByDeadline = [...activeTasks].sort(
      (a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
    );
    const nearestTask = sortedActiveByDeadline[0];
    topPriorityTitle = nearestTask.title;
    const deadlineDate = new Date(nearestTask.deadline);
    const formattedDeadline = deadlineDate.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
    topPriorityReason = `This task has the nearest upcoming deadline (${formattedDeadline}). Focus on it now to stay on schedule.`;
    recommendedNextAction = "Engage in a continuous focused work sprint.";
    estimatedFocusTime = `${nearestTask.estimatedEffort}h`;
    sourceLabel = "Timeline Fallback";
  }

  const matchedTaskObj = topPriorityTitle
    ? activeTasks.find(
        (t) => t.title.toLowerCase().trim() === topPriorityTitle.toLowerCase().trim() || t.id === topPriorityTitle
      )
    : null;

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case "High":
        return "bg-rose-500/10 border-rose-500/35 text-rose-400";
      case "Medium":
        return "bg-amber-500/10 border-amber-500/35 text-amber-400";
      default:
        return "bg-emerald-500/10 border-emerald-500/35 text-emerald-400";
    }
  };

  return (
    <div className="flex flex-col gap-3 w-full" id="ai-command-suite">
      
      {/* SECTION 1: INTELLIGENT TASK QUEUE */}
      <div 
        className="w-full bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-lg overflow-hidden transition-all duration-300"
        id="ai-queue-compact-card"
      >
        {/* COMPACT SUMMARY ROW */}
        <div 
          onClick={() => setIsQueueExpanded(!isQueueExpanded)}
          className="p-4 sm:px-6 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-850/60 transition-colors select-none"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
              <ListOrdered className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-display font-black tracking-tight text-white">
                  Intelligent Task Queue
                </span>
                {topPriorityTitle && (
                  <span className="text-[9px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                    Top Priority: {topPriorityTitle.length > 22 ? `${topPriorityTitle.slice(0, 22)}...` : topPriorityTitle}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 leading-normal font-sans mt-0.5 hidden sm:block">
                Dynamically ranks tasks by deadline and cognitive load to optimize sequence flow.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className={`text-[10px] font-mono font-semibold px-2.5 py-0.5 rounded-full border ${
              isQueueApplied 
                ? "bg-indigo-950/80 text-indigo-300 border-indigo-500/30" 
                : "bg-slate-800/80 text-slate-400 border-slate-700/60"
            }`}>
              {isQueueApplied ? "AI Sorting On" : "Standard Sorting"}
            </span>
            <div className="p-1 rounded-lg hover:bg-slate-800 transition-colors">
              <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isQueueExpanded ? "rotate-90" : ""}`} />
            </div>
          </div>
        </div>

        {/* EXPANDED CONTENT ACCORDION */}
        <motion.div
          initial={false}
          animate={{
            height: isQueueExpanded ? "auto" : 0,
            opacity: isQueueExpanded ? 1 : 0,
          }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          style={{ overflow: "hidden" }}
        >
          <div className="p-5 sm:px-6 bg-slate-950/40 border-t border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap border-b border-slate-800/60 pb-3">
              <div className="space-y-0.5">
                <h4 className="text-xs font-mono font-black tracking-widest text-indigo-400 uppercase">
                  Queue Priority Sequence
                </h4>
                <p className="text-[11px] text-slate-400">
                  Calculated using urgency parameters, capacity thresholds, and buffer stress.
                </p>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  runQueueAnalysis(true);
                }}
                disabled={isQueueLoading}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 disabled:bg-slate-850 disabled:text-slate-500 border border-slate-700 hover:border-slate-650 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all"
              >
                <RefreshCw className={`w-2.5 h-2.5 ${isQueueLoading ? "animate-spin" : ""}`} />
                <span>{isQueueLoading ? "Scanning..." : "Re-Prioritize"}</span>
              </button>
            </div>

            {queueError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <p className="text-xs text-rose-200">{queueError}</p>
              </div>
            )}

            {isQueueLoading && !queue.length && (
              <div className="py-8 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-indigo-500" />
                <span>Assembling AI Queue sequencing rules...</span>
              </div>
            )}

            {queue.length > 0 ? (
              <div className="space-y-4 text-xs">
                {isShowingQueueCached && (
                  <div className="px-3 py-1.5 rounded-lg bg-indigo-950/60 border border-indigo-500/25 text-indigo-200 text-[10px] flex items-center justify-between gap-2">
                    <span className="font-bold">✓ Loaded Cache</span>
                    <span className="font-mono text-slate-400">
                      {cachedQueue?.generatedAt || "Recently"}
                    </span>
                  </div>
                )}

                {queueSummary && (
                  <div className="bg-indigo-950/20 border border-indigo-500/15 p-3 rounded-xl leading-relaxed text-indigo-200 text-[11px]">
                    <span className="font-bold text-indigo-350 mr-1">Executive Strategy:</span>
                    {queueSummary}
                  </div>
                )}

                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {queue.map((item, index) => {
                    const matched = tasks.find((t) => t.id === item.id);
                    const isCompleted = matched?.completed;
                    let isOverdue = false;
                    let riskLevel: "Low" | "Medium" | "High" = "Low";

                    if (matched) {
                      isOverdue = !matched.completed && new Date(matched.deadline).getTime() < now.getTime();
                      if (matched.storedRisk?.level) riskLevel = matched.storedRisk.level;
                      else if (matched.aiAnalysis?.riskLevel) riskLevel = matched.aiAnalysis.riskLevel;
                      else riskLevel = calculateTaskRisk(matched, activeTasks.length, now).level;
                    }

                    return (
                      <div 
                        key={item.id}
                        className={`p-3 rounded-xl border flex items-start justify-between gap-3 ${
                          index === 0 && !isCompleted
                            ? "bg-indigo-500/10 border-indigo-500/30"
                            : "bg-slate-850/40 border-slate-800/80"
                        }`}
                      >
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`w-4.5 h-4.5 rounded-md text-[10px] font-mono font-black flex items-center justify-center shrink-0 ${
                              index === 0 ? "bg-indigo-500 text-white" : "bg-slate-800 text-slate-400"
                            }`}>
                              {index + 1}
                            </span>
                            
                            {isOverdue && (
                              <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[8px] font-mono font-bold px-1 rounded uppercase">
                                Overdue
                              </span>
                            )}
                            
                            <span className={`border text-[8px] font-mono font-bold px-1 rounded uppercase ${getRiskBadge(riskLevel)}`}>
                              {riskLevel} Risk
                            </span>

                            {index === 0 && (
                              <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[8px] font-mono font-bold px-1 rounded uppercase">
                                Today's Best Action
                              </span>
                            )}
                          </div>

                          <h5 className="font-bold text-white break-words text-xs">{item.title}</h5>
                          <p className="text-[10.5px] text-slate-400 leading-normal font-medium">{item.reason}</p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {matched && index === 0 && !isCompleted && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onStartWorkingTask(matched.id);
                              }}
                              className="px-2.5 py-1 text-[10px] font-mono font-black bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors cursor-pointer flex items-center gap-1"
                              title="Launch focus session for today's priority task"
                            >
                              <span>🚀 Start</span>
                            </button>
                          )}
                          {matched && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onFocusTask(matched.id);
                              }}
                              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-indigo-400 transition-colors cursor-pointer"
                              title="Focus Task"
                            >
                              <Target className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Accept / Revert Controls */}
                <div className="pt-3 border-t border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <p className="text-[10px] text-slate-400">
                    {isQueueApplied ? "✓ Reorganized workspace sorting by AI order." : "Apply sequence sorting to your task workspace?"}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleIgnoreQueue();
                      }}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-350 rounded-lg text-[10px] font-bold cursor-pointer flex items-center gap-1"
                    >
                      <X className="w-3 h-3 text-slate-400" />
                      <span>Keep Current</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAcceptQueue();
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black cursor-pointer flex items-center gap-1 transition-all ${
                        isQueueApplied 
                          ? "bg-indigo-950 border border-indigo-500/30 text-indigo-300"
                          : "bg-indigo-600 hover:bg-indigo-500 text-white"
                      }`}
                    >
                      <Check className="w-3 h-3 text-indigo-300" />
                      <span>{isQueueApplied ? "Applied AI Order" : "Apply AI Order"}</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              !isQueueLoading && (
                <div className="py-6 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-1">
                  <ListOrdered className="w-8 h-8 text-slate-800" />
                  <span>No intelligent queue suggestions are available. Log tasks to build order.</span>
                </div>
              )
            )}
          </div>
        </motion.div>
      </div>

      {/* SECTION 2: SMART RESCUE PLAN */}
      <div 
        className="w-full bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-lg overflow-hidden transition-all duration-300"
        id="ai-rescue-compact-card"
      >
        {/* COMPACT SUMMARY ROW */}
        <div 
          onClick={() => setIsRescueExpanded(!isRescueExpanded)}
          className="p-4 sm:px-6 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-850/60 transition-colors select-none"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-display font-black tracking-tight text-white">
                  Smart Rescue Plan
                </span>
                {rescueResult && rescueResult.recommendedTask && (
                  <span className="text-[9px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-full">
                    Rescue Focus: {rescueResult.recommendedTask.length > 22 ? `${rescueResult.recommendedTask.slice(0, 22)}...` : rescueResult.recommendedTask}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 leading-normal font-sans mt-0.5 hidden sm:block">
                Identifies high-threat deadlines and guides crisis formulation.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className={`text-[10px] font-mono font-semibold px-2.5 py-0.5 rounded-full border ${
              rescueResult && rescueResult.riskIfIgnored === "High"
                ? "bg-rose-950/80 text-rose-300 border-rose-500/30 animate-pulse"
                : "bg-emerald-950/80 text-emerald-300 border-emerald-500/20"
            }`}>
              {rescueResult ? `${rescueResult.riskIfIgnored} Threat` : "Safe Buffer"}
            </span>
            <div className="p-1 rounded-lg hover:bg-slate-800 transition-colors">
              <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isRescueExpanded ? "rotate-90" : ""}`} />
            </div>
          </div>
        </div>

        {/* EXPANDED CONTENT ACCORDION */}
        <motion.div
          initial={false}
          animate={{
            height: isRescueExpanded ? "auto" : 0,
            opacity: isRescueExpanded ? 1 : 0,
          }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          style={{ overflow: "hidden" }}
        >
          <div className="p-5 sm:px-6 bg-slate-950/40 border-t border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap border-b border-slate-800/60 pb-3">
              <div className="space-y-0.5">
                <h4 className="text-xs font-mono font-black tracking-widest text-indigo-400 uppercase">
                  Crisis Rescue Strategy
                </h4>
                <p className="text-[11px] text-slate-400">
                  Targeted triage guidance to prevent cascading milestone breaches.
                </p>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  runRescueAnalysis(true);
                }}
                disabled={isRescueLoading}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-850 disabled:text-slate-500 text-white border border-rose-600 hover:border-rose-500 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all active:scale-97"
              >
                <RefreshCw className={`w-2.5 h-2.5 ${isRescueLoading ? "animate-spin" : ""}`} />
                <span>{isRescueLoading ? "Analyzing..." : "Re-Formulate"}</span>
              </button>
            </div>

            {rescueError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                <p className="text-xs text-rose-300">{rescueError}</p>
              </div>
            )}

            {isRescueLoading && !rescueResult && (
              <div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-rose-500" />
                <span>Formulating active rescue plan...</span>
              </div>
            )}

            {rescueResult ? (
              <div className="space-y-3.5 text-xs">
                {isShowingRescueCached && (
                  <div className="px-3 py-1 bg-indigo-950/60 border border-indigo-500/25 text-indigo-200 text-[10px] flex items-center justify-between gap-2 rounded">
                    <span className="font-bold">✓ Loaded Cache</span>
                    <span className="font-mono text-slate-400">{cachedRescuePlan?.generatedAt}</span>
                  </div>
                )}

                <div className="bg-slate-850/40 border border-slate-800/80 p-4 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono font-bold text-slate-500 uppercase">Recommended Rescue Task</span>
                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-mono font-bold uppercase border ${getRiskBadge(rescueResult.riskIfIgnored)}`}>
                      {rescueResult.riskIfIgnored} Threat Level
                    </span>
                  </div>
                  <h5 className="font-bold text-white text-sm">{rescueResult.recommendedTask}</h5>
                  <p className="text-[11.5px] text-slate-300 italic leading-relaxed">"{rescueResult.reason}"</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-slate-850/40 border border-slate-800 p-3 rounded-xl space-y-1.5">
                    <span className="text-[9px] font-mono font-bold text-slate-500 uppercase">Est. Session Duration</span>
                    <div className="flex items-center gap-1.5 font-mono font-bold text-slate-200">
                      <Hourglass className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>{rescueResult.estimatedFocusTime}</span>
                    </div>
                  </div>

                  <div className="bg-slate-850/40 border border-slate-800 p-3 rounded-xl space-y-1.5">
                    <span className="text-[9px] font-mono font-bold text-slate-500 uppercase">Recommended Next Action</span>
                    <p className="text-[11px] font-semibold text-slate-200">{rescueResult.nextAction}</p>
                  </div>
                </div>

                {matchedTaskObj && (
                  <div className="pt-3 border-t border-slate-800/60 flex justify-end">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartWorkingTask(matchedTaskObj.id);
                      }}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-sans font-black text-xs rounded-xl shadow-md hover:shadow-rose-600/20 cursor-pointer transition-all active:scale-97 flex items-center gap-1.5"
                    >
                      <span>🚀 Start Rescue Session Now</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              !isRescueLoading && (
                <div className="py-4 text-center text-xs text-slate-500">
                  No active high-risk warnings formulated. Log tasks to monitor safety.
                </div>
              )
            )}
          </div>
        </motion.div>
      </div>

      {/* SECTION 3: WORKLOAD CONFLICT DETECTOR */}
      <div 
        className="w-full bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-lg overflow-hidden transition-all duration-300"
        id="ai-conflict-compact-card"
      >
        {/* COMPACT SUMMARY ROW */}
        <div 
          onClick={() => setIsConflictExpanded(!isConflictExpanded)}
          className="p-4 sm:px-6 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-850/60 transition-colors select-none"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-sm font-display font-black tracking-tight text-white block">
                Workload Conflict Detector
              </span>
              <p className="text-xs text-slate-400 leading-normal font-sans mt-0.5 hidden sm:block">
                Scans schedule capacity limits and deadline density overlaps.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className={`text-[10px] font-mono font-semibold px-2.5 py-0.5 rounded-full border ${
              conflictResult && conflictResult.conflictDetected
                ? "bg-amber-950/80 text-amber-300 border-amber-500/30"
                : "bg-emerald-950/80 text-emerald-300 border-emerald-500/20"
            }`}>
              {conflictResult ? (conflictResult.conflictDetected ? "Conflict Discovered" : "Timeline Balanced") : "Scan Needed"}
            </span>
            <div className="p-1 rounded-lg hover:bg-slate-800 transition-colors">
              <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isConflictExpanded ? "rotate-90" : ""}`} />
            </div>
          </div>
        </div>

        {/* EXPANDED CONTENT ACCORDION */}
        <motion.div
          initial={false}
          animate={{
            height: isConflictExpanded ? "auto" : 0,
            opacity: isConflictExpanded ? 1 : 0,
          }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          style={{ overflow: "hidden" }}
        >
          <div className="p-5 sm:px-6 bg-slate-950/40 border-t border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap border-b border-slate-800/60 pb-3">
              <div className="space-y-0.5">
                <h4 className="text-xs font-mono font-black tracking-widest text-indigo-400 uppercase">
                  Deadline Density Scanner
                </h4>
                <p className="text-[11px] text-slate-400">
                  Scans parallel workload paths to locate delivery pressure bottlenecks.
                </p>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  runConflictAnalysis();
                }}
                disabled={isConflictLoading}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-slate-650 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all"
              >
                <RefreshCw className={`w-2.5 h-2.5 ${isConflictLoading ? "animate-spin" : ""}`} />
                <span>Scan Timeline</span>
              </button>
            </div>

            {conflictError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                <p className="text-xs text-rose-300">{conflictError}</p>
              </div>
            )}

            {isConflictLoading && !conflictResult && (
              <div className="py-4 text-center text-xs text-slate-400">
                Scanning active workload densities...
              </div>
            )}

            {conflictResult && !isConflictLoading ? (
              <div className="space-y-3.5 text-xs">
                {conflictResult.conflictDetected ? (
                  <div className="space-y-3.5">
                    <div className="bg-rose-500/5 border border-rose-500/15 p-3 rounded-xl flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5 animate-pulse" />
                      <div className="space-y-0.5">
                        <h5 className="font-bold text-rose-300 uppercase text-[9px] font-mono">Capacity Bottleneck Alert</h5>
                        <p className="text-[11px] text-slate-200 leading-normal">{conflictResult.explanation}</p>
                      </div>
                    </div>

                    {conflictResult.conflictingTasks?.length > 0 && (
                      <div className="bg-slate-850/40 border border-slate-800 p-3 rounded-xl space-y-1">
                        <span className="text-[9px] font-mono font-bold text-slate-500 uppercase">Overlapping Items</span>
                        <ul className="space-y-1">
                          {conflictResult.conflictingTasks.map((t, i) => (
                            <li key={i} className="flex items-center gap-2 text-[11px] font-semibold text-slate-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0"></span>
                              <span>{t}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-emerald-500/5 border border-emerald-500/15 p-3 rounded-xl flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <h5 className="font-bold text-emerald-300 uppercase text-[9px] font-mono">Workload Stable</h5>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        Capacity levels and deadline separations are balanced. No bottleneck clashes discovered.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </motion.div>
      </div>

    </div>
  );
}
