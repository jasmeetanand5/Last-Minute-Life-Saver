import { Task } from "./types";

export interface TaskDeadlineAnalysis {
  hoursRemaining: number;
  bufferHours: number;
  status: "completed" | "overdue" | "panic" | "high" | "medium" | "safe";
  statusLabel: string;
  statusColor: string;
  badgeClass: string;
  description: string;
  countdownText: string;
}

// Format the date for friendly UI viewing
export function formatFriendlyDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Invalid date";
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (e) {
    return dateStr;
  }
}

// Analyze the urgency details of a single task
export function analyzeTaskDeadline(task: Task, now: Date = new Date()): TaskDeadlineAnalysis {
  if (task.completed) {
    return {
      hoursRemaining: 0,
      bufferHours: 0,
      status: "completed",
      statusLabel: "Completed",
      statusColor: "text-emerald-500",
      badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200 border",
      description: "Successfully saved! Good job keeping this deadline alive.",
      countdownText: "Task Completed",
    };
  }

  const deadlineTime = new Date(task.deadline).getTime();
  const currentTime = now.getTime();
  const diffMs = deadlineTime - currentTime;
  const hoursRemaining = diffMs / (1000 * 60 * 60);
  const bufferHours = hoursRemaining - task.estimatedEffort;

  // Formatting countdown text
  let countdownText = "";
  if (diffMs <= 0) {
    countdownText = "Overdue!";
    return {
      hoursRemaining,
      bufferHours,
      status: "overdue",
      statusLabel: "Overdue",
      statusColor: "text-rose-600",
      badgeClass: "bg-rose-100 text-rose-800 border-rose-200 border font-bold animate-pulse",
      description: "The clock ran out! Start immediately to minimize the damage.",
      countdownText,
    };
  }

  const days = Math.floor(hoursRemaining / 24);
  const remHours = Math.floor(hoursRemaining % 24);
  const remMins = Math.floor((diffMs / (1000 * 60)) % 60);

  if (days > 0) {
    countdownText = `${days}d ${remHours}h ${remMins}m remaining`;
  } else if (remHours > 0) {
    countdownText = `${remHours}h ${remMins}m remaining`;
  } else {
    countdownText = `${remMins}m remaining`;
  }

  // Panic & Stress Levels
  if (bufferHours < 0) {
    return {
      hoursRemaining,
      bufferHours,
      status: "panic",
      statusLabel: "CRITICAL PANIC",
      statusColor: "text-red-500",
      badgeClass: "bg-rose-600 text-white font-semibold border-rose-700 shadow-sm animate-pulse",
      description: `Impossible to complete on time at normal speed. Needs extreme focus! (${Math.abs(bufferHours).toFixed(1)}h overdue before starting)`,
      countdownText,
    };
  } else if (bufferHours <= 4) {
    // Under 4 hours of buffer window - Very close!
    return {
      hoursRemaining,
      bufferHours,
      status: "high",
      statusLabel: "HIGH RISK",
      statusColor: "text-orange-500",
      badgeClass: "bg-orange-500 text-white font-medium border-orange-600 shadow-xs",
      description: `Razor thin breathing room (${bufferHours.toFixed(1)}h buffer). Start now!`,
      countdownText,
    };
  } else if (bufferHours <= 16) {
    // Tight schedule but manageable
    return {
      hoursRemaining,
      bufferHours,
      status: "medium",
      statusLabel: "TIGHT BUFFER",
      statusColor: "text-amber-600",
      badgeClass: "bg-amber-50 text-amber-700 border-amber-200 border",
      description: `Moderate breathing room (${bufferHours.toFixed(1)}h buffer). Do not delay.`,
      countdownText,
    };
  } else {
    return {
      hoursRemaining,
      bufferHours,
      status: "safe",
      statusLabel: "SAFE ZONE",
      statusColor: "text-blue-500",
      badgeClass: "bg-sky-50 text-sky-700 border-sky-200 border",
      description: `Healthy buffer (${bufferHours.toFixed(1)}h remaining after work duration). Keep steady!`,
      countdownText,
    };
  }
}

// Check if a task qualifies for Panic / Critical Mode (deadline < 24h OR buffer <= 4h)
export function isTaskPanicQualifying(task: Task, now: Date = new Date()): boolean {
  if (task.completed) return false;
  const deadlineTime = new Date(task.deadline).getTime();
  const currentTime = now.getTime();
  const hoursRemaining = (deadlineTime - currentTime) / (1000 * 60 * 60);
  const bufferHours = hoursRemaining - task.estimatedEffort;

  return hoursRemaining < 24 || bufferHours <= 4;
}

export interface TaskRiskAssessment {
  score: number;
  level: "Low" | "Medium" | "High";
  color: string;
  bg: string;
  border: string;
  iconBg: string;
  factors: {
    name: string;
    value: string;
    impact: "low" | "medium" | "high";
    description: string;
  }[];
}

// Calculate AI-driven risk assessment dynamically based on time remaining, effort, and active task density
export function calculateTaskRisk(
  task: Task,
  activeTasksCount: number,
  now: Date = new Date()
): TaskRiskAssessment {
  if (task.storedRisk) {
    return task.storedRisk;
  }
  return calculateTaskRiskRaw(task, activeTasksCount, now);
}

// Recalculates risk for all tasks using a stable reference time (usually when task list or detail changes)
export function computeStoredRiskForTasks(tasks: Task[], referenceTime: Date = new Date()): Task[] {
  const activeTasksCount = tasks.filter(t => !t.completed).length;
  return tasks.map(task => {
    return {
      ...task,
      storedRisk: calculateTaskRiskRaw(task, activeTasksCount, referenceTime),
    };
  });
}

export function calculateTaskRiskRaw(
  task: Task,
  activeTasksCount: number,
  now: Date = new Date()
): TaskRiskAssessment {
  if (task.completed) {
    return {
      score: 0,
      level: "Low",
      color: "text-emerald-600",
      bg: "bg-emerald-50/50",
      border: "border-emerald-100",
      iconBg: "bg-emerald-100/60",
      factors: [
        {
          name: "Status",
          value: "Completed",
          impact: "low",
          description: "This task has been fully completed. Great job!",
        },
      ],
    };
  }

  const deadlineTime = new Date(task.deadline).getTime();
  const currentTime = now.getTime();
  const hoursRemaining = (deadlineTime - currentTime) / (1000 * 60 * 60);
  const bufferHours = hoursRemaining - task.estimatedEffort;

  let score = 0;
  const factors: TaskRiskAssessment["factors"] = [];

  // 1. Time Remaining Factor
  let timeImpact: "low" | "medium" | "high" = "low";
  let timeDesc = "";
  let timeVal = "";
  if (hoursRemaining <= 0) {
    score += 55;
    timeImpact = "high";
    timeVal = "Overdue";
    timeDesc = "This task has passed its official deadline.";
  } else if (hoursRemaining <= 12) {
    score += 40;
    timeImpact = "high";
    timeVal = `${hoursRemaining.toFixed(1)}h left`;
    timeDesc = "Critical deadline under 12 hours away.";
  } else if (hoursRemaining <= 24) {
    score += 25;
    timeImpact = "medium";
    timeVal = `${hoursRemaining.toFixed(1)}h left`;
    timeDesc = "Urgent deadline approaching within 24 hours.";
  } else if (hoursRemaining <= 72) {
    score += 12;
    timeImpact = "low";
    timeVal = `${(hoursRemaining / 24).toFixed(1)} days left`;
    timeDesc = "Approaching deadline within 3 days.";
  } else {
    score += 2;
    timeImpact = "low";
    timeVal = `${(hoursRemaining / 24).toFixed(0)} days left`;
    timeDesc = "Adequate time remains until deadline.";
  }
  factors.push({
    name: "Time Window",
    value: timeVal,
    impact: timeImpact,
    description: timeDesc,
  });

  // 2. Effort vs Window (Buffer strain)
  let bufferImpact: "low" | "medium" | "high" = "low";
  let bufferDesc = "";
  let bufferVal = "";
  if (bufferHours < 0) {
    score += 35;
    bufferImpact = "high";
    bufferVal = `${Math.abs(bufferHours).toFixed(1)}h deficit`;
    bufferDesc = "Impossible to complete on time at normal speed.";
  } else if (bufferHours <= 4) {
    score += 25;
    bufferImpact = "high";
    bufferVal = `${bufferHours.toFixed(1)}h buffer`;
    bufferDesc = "Razor thin buffer. Any delay will cause a deficit.";
  } else if (bufferHours <= 12) {
    score += 15;
    bufferImpact = "medium";
    bufferVal = `${bufferHours.toFixed(1)}h buffer`;
    bufferDesc = "Tight buffer window. Start work block soon.";
  } else {
    score += 0;
    bufferImpact = "low";
    bufferVal = `${bufferHours.toFixed(1)}h buffer`;
    bufferDesc = "Sufficient buffer to complete stress-free.";
  }
  factors.push({
    name: "Schedule Buffer",
    value: bufferVal,
    impact: bufferImpact,
    description: bufferDesc,
  });

  // 3. Active Task Density Multiplier
  let loadImpact: "low" | "medium" | "high" = "low";
  let loadDesc = "";
  let loadVal = "";
  if (activeTasksCount >= 8) {
    score += 15;
    loadImpact = "high";
    loadVal = `${activeTasksCount} tasks queue`;
    loadDesc = "Extreme schedule pressure. High context-switching risk.";
  } else if (activeTasksCount >= 4) {
    score += 10;
    loadImpact = "medium";
    loadVal = `${activeTasksCount} active tasks`;
    loadDesc = "Moderately busy workload. Competing priorities exist.";
  } else if (activeTasksCount >= 2) {
    score += 5;
    loadImpact = "low";
    loadVal = `${activeTasksCount} active tasks`;
    loadDesc = "Manageable number of competing items.";
  } else {
    score += 0;
    loadImpact = "low";
    loadVal = "1 active task";
    loadDesc = "No other competing priorities. Focus is completely clean.";
  }
  factors.push({
    name: "Queue Competition",
    value: loadVal,
    impact: loadImpact,
    description: loadDesc,
  });

  // Ensure score stays in logical bounds
  score = Math.min(100, Math.max(0, score));

  let level: "Low" | "Medium" | "High" = "Low";
  let color = "text-emerald-600";
  let bg = "bg-emerald-50/70";
  let border = "border-emerald-200/60";
  let iconBg = "bg-emerald-100";

  // Check if Gemini risk assessment has run and should be the source of truth
  if (task.aiAnalysis?.riskLevel) {
    level = task.aiAnalysis.riskLevel;
    if (level === "High") {
      score = Math.max(75, score);
      color = "text-rose-600";
      bg = "bg-rose-50/70";
      border = "border-rose-200/60";
      iconBg = "bg-rose-100";
    } else if (level === "Medium") {
      score = score < 30 || score >= 60 ? 45 : score;
      color = "text-amber-600";
      bg = "bg-amber-50/70";
      border = "border-amber-200/60";
      iconBg = "bg-amber-100";
    } else {
      score = Math.min(25, score);
      color = "text-emerald-600";
      bg = "bg-emerald-50/70";
      border = "border-emerald-200/60";
      iconBg = "bg-emerald-100";
    }
  } else {
    if (hoursRemaining <= 0 || bufferHours < 0 || score >= 60) {
      level = "High";
      color = "text-rose-600";
      bg = "bg-rose-50/70";
      border = "border-rose-200/60";
      iconBg = "bg-rose-100";
    } else if (score >= 30 || hoursRemaining <= 24 || bufferHours <= 8) {
      level = "Medium";
      color = "text-amber-600";
      bg = "bg-amber-50/70";
      border = "border-amber-200/60";
      iconBg = "bg-amber-100";
    }
  }

  return {
    score,
    level,
    color,
    bg,
    border,
    iconBg,
    factors,
  };
}

// Generate diagnostic advice for the user based on overall task structure
export function getLifeSaverAdvice(tasks: Task[], now: Date = new Date()): {
  header: string;
  message: string;
  level: "chill" | "alert" | "crisis";
} {
  const activeTasks = tasks.filter(t => !t.completed);
  if (activeTasks.length === 0) {
    return {
      header: "✅ All clear! Zero impending threats.",
      message: "No active deadlines. Clear schedule. Take a breather!",
      level: "chill",
    };
  }

  let panicCount = 0;
  let highRiskCount = 0;
  let overdueCount = 0;
  let totalEffortRequired = 0;

  activeTasks.forEach(task => {
    const analysis = analyzeTaskDeadline(task, now);
    totalEffortRequired += task.estimatedEffort;
    
    if (analysis.status === "panic") panicCount++;
    else if (analysis.status === "high") highRiskCount++;
    else if (analysis.status === "overdue") overdueCount++;
  });

  if (overdueCount > 0 && panicCount > 0) {
    return {
      header: "🚨 Alert level: CRITICAL CRISIS",
      message: `• ${overdueCount} Overdue items • ${panicCount} negative-buffer item(s). Action: Drop everything else, triage immediately.`,
      level: "crisis",
    };
  }

  if (panicCount > 0) {
    return {
      header: "🔥 Severe Task Crunch!",
      message: `• Hours left exceed deadline by ${panicCount} item(s). Action: Silence phone, put on focus music, start NOW.`,
      level: "crisis",
    };
  }

  if (highRiskCount > 0) {
    return {
      header: "⚡ Warning: Thin Buffers!",
      message: `• ${highRiskCount} upcoming task(s) with tight windows. Action: Reserve study/work blocks today.`,
      level: "alert",
    };
  }

  if (totalEffortRequired > 12) {
    return {
      header: "📋 Steady Load Ahead",
      message: `• ${totalEffortRequired.toFixed(1)}h total effort required. Action: Track pomodoros to preserve energy.`,
      level: "alert",
    };
  }

  return {
    header: "🌱 Systems Green. Steady Buffer.",
    message: "No immediate threat detected. Your planning has secured safety of all items.",
    level: "chill",
  };
}

export interface DeadlinePrediction {
  likelihood: "Low Risk" | "Medium Risk" | "High Risk";
  successProbability: number;
  factors: string[];
}

export function estimateDeadlineSuccessProbability(
  task: Task,
  activeTasksCount: number,
  totalActiveEffort: number,
  now: Date = new Date()
): DeadlinePrediction {
  if (task.completed) {
    return {
      likelihood: "Low Risk",
      successProbability: 100,
      factors: ["Task is already completed!"]
    };
  }

  const deadlineTime = new Date(task.deadline).getTime();
  const currentTime = now.getTime();
  const diffMs = deadlineTime - currentTime;
  const hoursRemaining = diffMs / (1000 * 60 * 60);
  const effort = Number(task.estimatedEffort) || 0.5;
  const bufferHours = hoursRemaining - effort;

  if (hoursRemaining <= 0) {
    return {
      likelihood: "High Risk",
      successProbability: 0,
      factors: ["The deadline has already passed."]
    };
  }

  // 1. Base Success Probability based on ratio of effort to hours remaining
  const ratio = effort / hoursRemaining;
  let baseSuccess = 0;
  if (ratio <= 1) {
    baseSuccess = 100 * (1 - ratio);
  } else {
    baseSuccess = Math.max(5, 50 * (2 - ratio));
  }

  // Calculate penalties and bonuses
  let activePenalty = 0;
  if (activeTasksCount > 1) {
    activePenalty = Math.min(15, (activeTasksCount - 1) * 2.5);
  }

  let workloadPenalty = 0;
  const otherEffort = Math.max(0, totalActiveEffort - effort);
  if (otherEffort > 0) {
    workloadPenalty = Math.min(20, otherEffort * 0.75);
  }

  let bufferAdjustment = 0;
  if (bufferHours < 0) {
    bufferAdjustment = -20;
  } else if (bufferHours <= 2) {
    bufferAdjustment = -10;
  } else if (bufferHours <= 6) {
    bufferAdjustment = -5;
  } else if (bufferHours > 16) {
    bufferAdjustment = 10;
  }

  let finalProbability = baseSuccess - activePenalty - workloadPenalty + bufferAdjustment;
  
  // Keep active probability between 2% and 98%
  finalProbability = Math.min(98, Math.max(2, Math.round(finalProbability)));

  let likelihood: "Low Risk" | "Medium Risk" | "High Risk" = "Low Risk";
  if (finalProbability >= 75) {
    likelihood = "Low Risk";
  } else if (finalProbability >= 45) {
    likelihood = "Medium Risk";
  } else {
    likelihood = "High Risk";
  }

  // Compile factors ensuring complete consistency with finalProbability
  const factors: string[] = [];

  // 1. Time buffer factor
  if (finalProbability >= 75) {
    factors.push(`Time remaining (${hoursRemaining.toFixed(1)}h) provides a healthy, comfortable buffer relative to the estimated ${effort}h of work.`);
  } else if (finalProbability >= 45) {
    factors.push(`Time remaining (${hoursRemaining.toFixed(1)}h) is sufficient, but thin buffer margins require steady and organized effort.`);
  } else {
    if (bufferHours < 0) {
      factors.push(`Required work (${effort}h) exceeds the remaining ${hoursRemaining.toFixed(1)}h window, putting you in an immediate scheduling deficit.`);
    } else {
      factors.push(`The remaining window of ${hoursRemaining.toFixed(1)}h is extremely narrow and sensitive to any unexpected delays.`);
    }
  }

  // 2. Multi-tasking / Queue factor
  if (activeTasksCount > 1) {
    if (finalProbability >= 75) {
      factors.push(`Your queue has other active items, but they do not pose an immediate threat to this task's timeline.`);
    } else if (finalProbability >= 45) {
      factors.push(`Competing active tasks (${activeTasksCount}) are creating minor scheduling friction.`);
    } else {
      factors.push(`A high density of competing active tasks (${activeTasksCount}) increases context-switching risk.`);
    }
  }

  // 3. Overall workload factor
  if (otherEffort > 0) {
    if (finalProbability >= 75) {
      factors.push(`The external workload (${otherEffort.toFixed(1)}h) is well-distributed and manageable.`);
    } else if (finalProbability >= 45) {
      factors.push(`External workload of ${otherEffort.toFixed(1)}h reduces your flexible time blocks today.`);
    } else {
      factors.push(`A demanding total workload of ${otherEffort.toFixed(1)}h across other tasks heavily squeezes your available focus windows.`);
    }
  }

  // 4. Overdue or Deficit specific warning
  if (bufferHours < 0 && finalProbability < 45) {
    factors.push(`Immediate intervention is required to address a ${Math.abs(bufferHours).toFixed(1)}h work deficit.`);
  }

  return {
    likelihood,
    successProbability: finalProbability,
    factors
  };
}

export interface ProcrastinationRisk {
  isAtRisk: boolean;
  reason: string;
  suggestedAction: string;
}

export function analyzeProcrastinationRisk(task: Task, now: Date = new Date()): ProcrastinationRisk {
  if (task.completed) {
    return { isAtRisk: false, reason: "", suggestedAction: "" };
  }

  const createdTime = new Date(task.createdAt).getTime();
  const currentTime = now.getTime();
  const deadlineTime = new Date(task.deadline).getTime();

  const ageMs = currentTime - createdTime;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  const timeToDeadlineMs = deadlineTime - currentTime;
  const hoursToDeadline = timeToDeadlineMs / (1000 * 60 * 60);

  // Existed for several days (e.g., ageDays >= 2 days, or ageDays >= 1.5 days to be friendly)
  // Have not been edited (no lastEditedAt)
  // Approaching deadline (within 72 hours, or already overdue which is the ultimate procrastination)
  const existedForSeveralDays = ageDays >= 1.5;
  const hasNotBeenEdited = !task.lastEditedAt;
  const isApproachingDeadline = hoursToDeadline > 0 && hoursToDeadline <= 72; // within 3 days
  const isOverdue = hoursToDeadline <= 0;

  if (hasNotBeenEdited && (existedForSeveralDays && (isApproachingDeadline || isOverdue) || (ageDays >= 1 && isOverdue))) {
    let reason = "";
    let suggestedAction = "";

    const daysText = Math.floor(ageDays) <= 1 ? "a couple of days" : `${Math.floor(ageDays)} days`;

    if (isOverdue) {
      reason = `This task was created ${daysText} ago and has not been updated, and its deadline has already passed.`;
      suggestedAction = `No pressure! Just take 5 minutes to break the ice: open the focus planner below or write down one tiny, effortless starting step.`;
    } else {
      const hoursRemainingText = hoursToDeadline > 24 
        ? `${Math.floor(hoursToDeadline / 24)} days` 
        : `${Math.ceil(hoursToDeadline)} hours`;
      reason = `This task has been sitting untouched in your list for ${daysText}, while the deadline is approaching in ${hoursRemainingText}.`;
      suggestedAction = `Try setting a 10-minute timer for a painless start, or generate a structured "Focus Session Plan" below to tackle it step-by-step.`;
    }

    return {
      isAtRisk: true,
      reason,
      suggestedAction
    };
  }

  return { isAtRisk: false, reason: "", suggestedAction: "" };
}

/**
 * Parses the human-friendly suggested start time from Gemini into a real Date object.
 */
export function parseSuggestedStartTime(suggested: string | undefined | null, now: Date): Date {
  if (!suggested) return now;
  
  const text = suggested.toLowerCase();
  
  // 1. Check for immediate/now indicators
  if (
    text.includes("now") || 
    text.includes("immediately") || 
    text.includes("immediate") || 
    text.includes("overdue") || 
    text.includes("asap")
  ) {
    return now;
  }
  
  // 2. Check for "within the next [N] hours" or similar
  const nextHoursMatch = text.match(/within\s+the\s+next\s+(\d+(?:\.\d+)?)\s*hour/);
  if (nextHoursMatch) {
    const hours = parseFloat(nextHoursMatch[1]);
    return new Date(now.getTime() + hours * 60 * 60 * 1000);
  }

  // 3. Check for "within the next [N] minutes"
  const nextMinsMatch = text.match(/within\s+the\s+next\s+(\d+)\s*minute/);
  if (nextMinsMatch) {
    const mins = parseInt(nextMinsMatch[1], 10);
    return new Date(now.getTime() + mins * 60 * 1000);
  }

  // 4. Initialize target date to today
  const targetDate = new Date(now.getTime());

  // Check for "tomorrow" or "friday" etc.
  if (text.includes("tomorrow")) {
    targetDate.setDate(targetDate.getDate() + 1);
  } else {
    // Check for weekdays
    const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    for (let i = 0; i < weekdays.length; i++) {
      if (text.includes(weekdays[i])) {
        const currentDay = now.getDay();
        const targetDay = i;
        let daysAhead = targetDay - currentDay;
        if (daysAhead <= 0) {
          daysAhead += 7; // Next week's weekday
        }
        targetDate.setDate(targetDate.getDate() + daysAhead);
        break;
      }
    }
  }

  // 5. Check for time in format "H:M AM/PM" or "H AM/PM"
  // E.g., "5:00 PM", "9:30 AM", "2:00 PM"
  const timeMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const ampm = timeMatch[3];
    
    if (ampm === "pm" && hours < 12) {
      hours += 12;
    } else if (ampm === "am" && hours === 12) {
      hours = 0;
    }
    
    targetDate.setHours(hours, minutes, 0, 0);
    
    // If the parsed time for today has already passed, fallback to now
    if (targetDate.getTime() < now.getTime() && !text.includes("tomorrow")) {
      return now;
    }
    return targetDate;
  }

  // 6. Check for general time periods if no exact time is found
  if (text.includes("morning")) {
    targetDate.setHours(9, 0, 0, 0);
    return targetDate;
  } else if (text.includes("afternoon")) {
    targetDate.setHours(14, 0, 0, 0);
    return targetDate;
  } else if (text.includes("evening")) {
    targetDate.setHours(18, 0, 0, 0);
    return targetDate;
  } else if (text.includes("night")) {
    targetDate.setHours(21, 0, 0, 0);
    return targetDate;
  }

  return now;
}

/**
 * Formats a Date object into a highly polished, human-friendly string.
 */
export function formatEstimateDate(date: Date, now: Date): string {
  const isToday = date.toDateString() === now.toDateString();
  const tomorrow = new Date(now.getTime());
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();
  
  const timeString = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  
  if (isToday) {
    return `Today at ${timeString}`;
  } else if (isTomorrow) {
    return `Tomorrow at ${timeString}`;
  } else {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}

/**
 * Calculates the estimated finish time or estimated recovery time for a task.
 */
export function calculateEstimatedTaskFinish(task: Task, now: Date): { 
  formattedTime: string; 
  isOverdue: boolean; 
} {
  const isOverdue = !task.completed && new Date(task.deadline).getTime() < now.getTime();
  const effortHours = Number(task.estimatedEffort) || 0;
  
  if (isOverdue) {
    // If the task is overdue, we assume an immediate start (now) to estimate recovery
    const recoveryFinish = new Date(now.getTime() + effortHours * 60 * 60 * 1000);
    return {
      formattedTime: formatEstimateDate(recoveryFinish, now),
      isOverdue: true
    };
  } else {
    // Use suggestedStartTime or default to now
    const suggested = task.aiAnalysis?.suggestedStartTime;
    const start = parseSuggestedStartTime(suggested, now);
    const finish = new Date(start.getTime() + effortHours * 60 * 60 * 1000);
    return {
      formattedTime: formatEstimateDate(finish, now),
      isOverdue: false
    };
  }
}

// Generates a local default focus plan using task metadata when Gemini/AI is unavailable or no plan is set yet
export function generateLocalDefaultFocusPlan(task: Task): {
  sessions: {
    sessionNumber: number;
    task: string;
    duration: string;
    goal: string;
    breakDuration: string;
  }[];
  completedSessions: number[];
  lastUpdated: string;
  isCustomized: boolean;
  isDefaultLocal: boolean;
} {
  const effortHours = task.estimatedEffort && task.estimatedEffort > 0 ? task.estimatedEffort : 1.0;
  const sessionMins = 25;
  const rawSessionsCount = Math.round((effortHours * 60) / sessionMins);
  const numSessions = Math.min(6, Math.max(1, rawSessionsCount));

  const sessions = [];
  const notesClean = task.notes ? task.notes.trim() : "";
  const notesLines = notesClean
    ? notesClean
        .split(/\n+/)
        .map(l => l.replace(/^[-*•\d.\s]+/, "").trim())
        .filter(l => l.length > 3)
    : [];

  const aiBreakdown = task.aiAnalysis?.breakdown || [];
  const sources = [...notesLines, ...aiBreakdown];

  for (let i = 1; i <= numSessions; i++) {
    let sessionTask = "";
    let sessionGoal = "";

    if (numSessions === 1) {
      sessionTask = `Deep Focus: ${task.title}`;
      sessionGoal = sources[0] || `Dedicate an uninterrupted block to complete: ${task.title}`;
    } else {
      if (sources.length >= numSessions) {
        sessionTask = `${sources[i - 1]}`;
        sessionGoal = `Focus on: ${sources[i - 1]}`;
      } else {
        if (i === 1) {
          sessionTask = `Setup & Initial Focus`;
          sessionGoal = sources[0] || `Set up your environment and kick off: ${task.title}`;
        } else if (i === numSessions) {
          sessionTask = `Final Review & Wrap Up`;
          sessionGoal = sources[sources.length - 1] || `Test, review, and finalize: ${task.title}`;
        } else {
          const defaultTasks = [
            "Core Implementation Step",
            "Technical Execution Phase",
            "Detail and Content Building",
            "Refinement Block"
          ];
          sessionTask = defaultTasks[(i - 2) % defaultTasks.length];
          sessionGoal = `Work through key details and execution of: ${task.title}`;
        }
      }
    }

    sessions.push({
      sessionNumber: i,
      task: sessionTask.substring(0, 80),
      duration: `${sessionMins} minutes`,
      goal: sessionGoal.substring(0, 100),
      breakDuration: "5 minutes"
    });
  }

  return {
    sessions,
    completedSessions: [],
    lastUpdated: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    isCustomized: false,
    isDefaultLocal: true
  };
}


