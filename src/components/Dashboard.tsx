import { Activity, AlertTriangle, CheckCircle2, Clock, Hourglass } from "lucide-react";
import { Task } from "../types";
import { analyzeTaskDeadline, getLifeSaverAdvice, isTaskPanicQualifying } from "../utils";

interface DashboardProps {
  tasks: Task[];
  filterType: "all" | "upcoming" | "overdue" | "panic" | "completed";
  setFilterType: (filter: "all" | "upcoming" | "overdue" | "panic" | "completed") => void;
  now: Date;
  onFocusTask?: (taskId: string) => void;
}

export default function Dashboard({ tasks, filterType, setFilterType, now, onFocusTask }: DashboardProps) {
  // Compute analytics from tasks
  const total = tasks.length;
  const completed = tasks.filter(t => t.completed).length;
  const overdue = tasks.filter(t => !t.completed && new Date(t.deadline).getTime() < now.getTime()).length;
  const upcoming = tasks.filter(t => !t.completed).length;

  const handleFilterClick = (type: "all" | "upcoming" | "overdue" | "panic" | "completed") => {
    setFilterType(type);
    setTimeout(() => {
      const el = document.getElementById("tasks-board-section");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 50);
  };

  // High Risk / PanicTasks count (qualifies for panic)
  const panic = tasks.filter(t => isTaskPanicQualifying(t, now)).length;

  // Total efforts remaining
  const activeTasks = tasks.filter(t => !t.completed);
  const totalEffortRemaining = activeTasks.reduce((sum, t) => sum + t.estimatedEffort, 0);

  // Advice
  const advice = getLifeSaverAdvice(tasks, now);

  const actionableTasks = activeTasks
    .filter(t => {
      const analysis = analyzeTaskDeadline(t, now);
      return analysis.status === "overdue" || analysis.status === "panic" || analysis.status === "high" || analysis.status === "medium";
    })
    .sort((a, b) => {
      const aAna = analyzeTaskDeadline(a, now);
      const bAna = analyzeTaskDeadline(b, now);
      const statusWeight = (status: string) => {
        switch (status) {
          case "overdue": return 4;
          case "panic": return 3;
          case "high": return 2;
          case "medium": return 1;
          default: return 0;
        }
      };
      return statusWeight(bAna.status) - statusWeight(aAna.status) || aAna.bufferHours - bAna.bufferHours;
    });

  // Panic meter calculation (0 to 100)
  // Higher weight for overdue and panic tasks
  const maxPanicScore = 100;
  let computedPanicScore = 0;
  if (activeTasks.length > 0) {
    let score = 0;
    activeTasks.forEach(t => {
      const analysis = analyzeTaskDeadline(t, now);
      if (analysis.status === "overdue") score += 25; // extremely heavy weight
      else if (analysis.status === "panic") score += 20;
      else if (analysis.status === "high") score += 12;
      else if (analysis.status === "medium") score += 5;
      else score += 1;
    });
    computedPanicScore = Math.min(maxPanicScore, Math.round((score / (activeTasks.length * 15)) * 100));
  }

  // Choose a color and label based on panic meter score
  let panicMeterLabel = "CRITICAL CRISIS";
  let panicMeterGradient = "from-rose-500 to-red-600";
  let panicMeterTextClass = "text-rose-600";
  if (computedPanicScore === 0) {
    panicMeterLabel = "COMPLETE CALM";
    panicMeterGradient = "from-teal-400 to-emerald-500";
    panicMeterTextClass = "text-emerald-600";
  } else if (computedPanicScore < 20) {
    panicMeterLabel = "PEACEFUL BUFFER";
    panicMeterGradient = "from-emerald-400 to-teal-500";
    panicMeterTextClass = "text-emerald-600";
  } else if (computedPanicScore < 50) {
    panicMeterLabel = "MODERATE LOAD";
    panicMeterGradient = "from-amber-400 to-orange-500";
    panicMeterTextClass = "text-orange-500";
  } else if (computedPanicScore < 80) {
    panicMeterLabel = "HIGH ALERT";
    panicMeterGradient = "from-orange-500 to-rose-500";
    panicMeterTextClass = "text-rose-500";
  }

  return (
    <div className="space-y-6" id="dashboard-container">
      {/* Dynamic Advice & Diagnosis banner */}
      <div
        className={`p-5 rounded-2xl border transition-all duration-300 ${
          advice.level === "crisis"
            ? "bg-rose-50/70 border-rose-100 text-rose-950"
            : advice.level === "alert"
              ? "bg-amber-50/70 border-amber-100 text-amber-950"
              : "bg-emerald-50/70 border-emerald-100 text-emerald-950"
        }`}
        id="advice-banner"
      >
        <div className="flex flex-col sm:flex-row items-start gap-4">
          <div
            className={`p-2.5 rounded-xl self-start ${
              advice.level === "crisis"
                ? "bg-rose-100 text-rose-600"
                : advice.level === "alert"
                  ? "bg-amber-100 text-amber-600"
                  : "bg-emerald-100 text-emerald-600"
            }`}
          >
            {advice.level === "crisis" ? (
              <AlertTriangle className="w-6 h-6 animate-bounce" />
            ) : advice.level === "alert" ? (
              <Clock className="w-6 h-6" />
            ) : (
              <CheckCircle2 className="w-6 h-6" />
            )}
          </div>
          <div className="space-y-1">
            <h3 className="font-display font-semibold text-lg leading-tight tracking-tight">
              {advice.header}
            </h3>
            <p className="text-sm opacity-90 leading-relaxed font-sans max-w-3xl">
              {advice.message}
            </p>
          </div>
          {activeTasks.length > 0 && (
            <div className="sm:ml-auto flex items-center gap-2 bg-white/80 backdrop-blur-md px-3.5 py-1.5 rounded-xl shadow-xs border border-inherit text-xs font-mono font-medium whitespace-nowrap self-stretch sm:self-center justify-center">
              <Hourglass className="w-3.5 h-3.5 text-gray-400" />
              <span>{totalEffortRemaining.toFixed(1)}h work left</span>
            </div>
          )}
        </div>

        {/* Actionable alerts links list */}
        {actionableTasks.length > 0 && (
          <div className="mt-4 pt-3.5 border-t border-dashed border-gray-350/45 w-full">
            <span className="text-[10px] font-mono font-bold tracking-wider opacity-85 block mb-2 text-slate-500">
              🎯 ACTIONABLE WARNINGS (CLICK TO LOCATE TASK):
            </span>
            <div className="flex flex-wrap gap-2">
              {actionableTasks.map(task => {
                const analysis = analyzeTaskDeadline(task, now);
                const isOverdue = analysis.status === "overdue";
                const isPanic = analysis.status === "panic";
                return (
                  <button
                    key={task.id}
                    onClick={() => onFocusTask?.(task.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition-all border shadow-2xs hover:shadow-xs hover:scale-[1.01] ${
                      isOverdue
                        ? "bg-rose-100/90 text-rose-950 border-rose-300/80 hover:bg-rose-200"
                        : isPanic
                          ? "bg-amber-100/90 text-amber-950 border-amber-300/80 hover:bg-amber-200"
                          : "bg-blue-100/95 text-blue-950 border-blue-300/85 hover:bg-blue-200/95"
                    }`}
                  >
                    <span className="relative flex h-2 w-2">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isOverdue || isPanic ? "bg-red-400" : "bg-blue-400"}`}></span>
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${isOverdue || isPanic ? "bg-red-500" : "bg-blue-500"}`}></span>
                    </span>
                    <span className="font-semibold truncate max-w-[200px]">{task.title}</span>
                    <span className="font-mono text-[9px] opacity-75">({analysis.statusLabel})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Stats Cards Section */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5" id="stats-grid">
        {/* Total Card */}
        <button
          onClick={() => handleFilterClick("all")}
          className={`group flex flex-col justify-between p-4 rounded-xl text-left border transition-all duration-200 cursor-pointer ${
            filterType === "all"
              ? "bg-slate-900 border-slate-900 text-white shadow-md ring-2 ring-slate-900/10"
              : "bg-white hover:bg-slate-50 border-gray-100 shadow-xs"
          }`}
          id="stat-total-tasks"
        >
          <div className="flex items-center justify-between w-full">
            <span className={`text-xs font-medium font-mono uppercase tracking-wider ${filterType === "all" ? "text-slate-300" : "text-gray-400"}`}>
              Total Tasks
            </span>
            <Activity className={`w-4 h-4 transition-transform duration-200 group-hover:scale-110 ${filterType === "all" ? "text-slate-300" : "text-gray-400"}`} />
          </div>
          <div className="mt-4 flex items-baseline gap-1.5">
            <span className="text-3xl font-display font-bold tabular-nums">{total}</span>
          </div>
        </button>

        {/* Upcoming Card */}
        <button
          onClick={() => handleFilterClick("upcoming")}
          className={`group flex flex-col justify-between p-4 rounded-xl text-left border transition-all duration-200 cursor-pointer ${
            filterType === "upcoming"
              ? "bg-blue-600 border-blue-600 text-white shadow-md ring-2 ring-blue-600/10"
              : "bg-white hover:bg-slate-50 border-gray-100 shadow-xs"
          }`}
          id="stat-upcoming-tasks"
        >
          <div className="flex items-center justify-between w-full">
            <span className={`text-xs font-medium font-mono uppercase tracking-wider ${filterType === "upcoming" ? "text-blue-100" : "text-gray-400"}`}>
              Upcoming
            </span>
            <Clock className={`w-4 h-4 transition-transform duration-200 group-hover:scale-110 ${filterType === "upcoming" ? "text-blue-150" : "text-gray-400"}`} />
          </div>
          <div className="mt-4 flex items-baseline gap-1.5">
            <span className="text-3xl font-display font-bold tabular-nums">{upcoming}</span>
          </div>
        </button>

        {/* Overdue Card */}
        <button
          onClick={() => handleFilterClick("overdue")}
          className={`group flex flex-col justify-between p-4 rounded-xl text-left border transition-all duration-200 cursor-pointer ${
            filterType === "overdue"
              ? "bg-rose-600 border-rose-600 text-white shadow-md ring-2 ring-rose-600/10"
              : "bg-white hover:bg-slate-50 border-gray-100 shadow-xs"
          }`}
          id="stat-overdue-tasks"
        >
          <div className="flex items-center justify-between w-full">
            <span className={`text-xs font-medium font-mono uppercase tracking-wider ${filterType === "overdue" ? "text-rose-100" : "text-gray-400"}`}>
              Overdue
            </span>
            <AlertTriangle className={`w-4 h-4 transition-transform duration-200 group-hover:scale-110 ${filterType === "overdue" ? "text-rose-200" : "text-rose-500"}`} />
          </div>
          <div className="mt-4 flex items-baseline gap-1.5">
            <span className="text-3xl font-display font-bold tabular-nums">{overdue}</span>
            {overdue > 0 && filterType !== "overdue" && (
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
              </span>
            )}
          </div>
        </button>

        {/* Panic Level Card */}
        <button
          onClick={() => handleFilterClick("panic")}
          className={`group flex flex-col justify-between p-4 rounded-xl text-left border transition-all duration-200 cursor-pointer ${
            filterType === "panic"
              ? "bg-orange-600 border-orange-600 text-white shadow-md ring-2 ring-orange-600/10"
              : "bg-white hover:bg-slate-50 border-gray-100 shadow-xs"
          }`}
          id="stat-panic-tasks"
        >
          <div className="flex items-center justify-between w-full">
            <span className={`text-xs font-medium font-mono uppercase tracking-wider ${filterType === "panic" ? "text-orange-100" : "text-gray-400"}`}>
              Panic Zone
            </span>
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${filterType === "panic" ? "bg-white/25 text-white" : "bg-red-50 text-rose-600"}`}>
              {panic}
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-1.5">
            <span className="text-3xl font-display font-bold tabular-nums">{panic}</span>
            {panic > 0 && <span className="text-[10px] font-semibold text-orange-500 group-hover:animate-pulse">Tight buffer!</span>}
          </div>
        </button>

        {/* Completed Card */}
        <button
          onClick={() => handleFilterClick("completed")}
          className={`group col-span-2 md:col-span-1 flex flex-col justify-between p-4 rounded-xl text-left border transition-all duration-200 cursor-pointer ${
            filterType === "completed"
              ? "bg-emerald-600 border-emerald-600 text-white shadow-md ring-2 ring-emerald-600/10"
              : "bg-white hover:bg-slate-50 border-gray-100 shadow-xs"
          }`}
          id="stat-completed-tasks"
        >
          <div className="flex items-center justify-between w-full">
            <span className={`text-xs font-medium font-mono uppercase tracking-wider ${filterType === "completed" ? "text-emerald-100" : "text-gray-400"}`}>
              Completed
            </span>
            <CheckCircle2 className={`w-4 h-4 transition-transform duration-200 group-hover:scale-110 ${filterType === "completed" ? "text-emerald-200" : "text-emerald-500"}`} />
          </div>
          <div className="mt-4 flex items-baseline gap-1.5">
            <span className="text-3xl font-display font-bold tabular-nums">{completed}</span>
            {total > 0 && (
              <span className={`text-xs font-mono ${filterType === "completed" ? "text-emerald-200" : "text-gray-400"}`}>
                ({Math.round((completed / total) * 100)}%)
              </span>
            )}
          </div>
        </button>
      </div>

      {/* Panic Level Meter & Statistics Column */}
      <div className="bg-white border border-gray-100 p-5 rounded-2xl shadow-xs" id="panic-meter">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="space-y-0.5">
            <h4 className="font-display font-bold text-gray-900 text-sm tracking-tight flex items-center gap-1.5">
              <span>Overall Panic Indicator</span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded bg-gray-100 font-semibold uppercase ${panicMeterTextClass}`}>
                {panicMeterLabel}
              </span>
            </h4>
            <p className="text-xs text-gray-400 max-w-xl">
              Calculated based on active workload, deadlines, and current time buffers.
            </p>
          </div>
          <div className="text-right">
            <span className={`text-3xl font-display font-extrabold tracking-tight ${panicMeterTextClass}`}>
              {computedPanicScore}%
            </span>
          </div>
        </div>

        {/* Progress Bar with customizable gradient and subtle layout shadows */}
        <div className="h-4 bg-gray-50 rounded-full overflow-hidden border border-gray-100 relative">
          <div
            className={`h-full bg-gradient-to-r ${panicMeterGradient} rounded-full transition-all duration-1000 ease-out-cubic`}
            style={{ width: `${computedPanicScore}%` }}
          />
        </div>
        
        {/* Helper values for progress meter */}
        <div className="flex justify-between mt-2.5 px-1 font-mono text-[10px] text-gray-400 tracking-wider">
          <span>0% CHILL (CALM)</span>
          <span>50% WARNING</span>
          <span>100% EXTREME PANIC</span>
        </div>
      </div>
    </div>
  );
}
