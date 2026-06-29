import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

function generateDeterministicRecommendation(tasks: any[], currentTime: string) {
  const nowMs = currentTime ? new Date(currentTime).getTime() : Date.now();

  const processedTasks = tasks.map((t: any) => {
    let isOverdue = false;
    let hoursRemaining = 999999;
    try {
      const deadlineMs = new Date(t.deadline).getTime();
      const diffMs = deadlineMs - nowMs;
      isOverdue = diffMs < 0;
      hoursRemaining = diffMs / (1000 * 60 * 60);
    } catch (e) {
      // ignore
    }

    // Get risk level
    const riskLevel = t.storedRisk?.level || t.aiAnalysis?.riskLevel || "Low";

    return {
      ...t,
      isOverdue,
      hoursRemaining,
      riskLevel
    };
  });

  // Filter out completed tasks just in case
  const activeTasks = processedTasks.filter((t: any) => !t.completed);

  if (activeTasks.length === 0) {
    return {
      recommendedTask: "No active tasks",
      reason: "All of your tasks are completed or you haven't created any yet.",
      nextAction: "Create a new task to generate a Smart Rescue Plan.",
      estimatedFocusTime: "0 mins",
      riskIfIgnored: "Low" as const,
      isFallback: true
    };
  }

  // Priority order:
  // 1. Overdue tasks
  // 2. Tasks due within 24 hours
  // 3. High-risk tasks
  // 4. Medium-risk tasks
  // 5. Low-risk tasks

  // 1. Overdue tasks
  const overdueTasks = activeTasks.filter(t => t.isOverdue);
  if (overdueTasks.length > 0) {
    overdueTasks.sort((a, b) => a.hoursRemaining - b.hoursRemaining);
    const selected = overdueTasks[0];
    const daysOverdue = Math.abs(selected.hoursRemaining / 24).toFixed(1);
    return {
      recommendedTask: selected.title,
      reason: `This task is overdue by ${daysOverdue} days. Resolving overdue work immediately reduces accumulated backlog and stress.`,
      nextAction: "Open the task notes and tackle the first physical step to build momentum.",
      estimatedFocusTime: "25 mins",
      riskIfIgnored: "High" as const,
      isFallback: true
    };
  }

  // 2. Tasks due within 24 hours
  const dueSoonTasks = activeTasks.filter(t => t.hoursRemaining >= 0 && t.hoursRemaining <= 24);
  if (dueSoonTasks.length > 0) {
    dueSoonTasks.sort((a, b) => a.hoursRemaining - b.hoursRemaining);
    const selected = dueSoonTasks[0];
    return {
      recommendedTask: selected.title,
      reason: `This task is due in ${selected.hoursRemaining.toFixed(1)} hours. Prompt action is needed to secure your deadline buffer.`,
      nextAction: "Draft the layout, map core elements, and execute high-priority functions.",
      estimatedFocusTime: "45 mins",
      riskIfIgnored: "High" as const,
      isFallback: true
    };
  }

  // 3. High-risk tasks
  const highRiskTasks = activeTasks.filter(t => t.riskLevel === "High");
  if (highRiskTasks.length > 0) {
    highRiskTasks.sort((a, b) => a.hoursRemaining - b.hoursRemaining);
    const selected = highRiskTasks[0];
    return {
      recommendedTask: selected.title,
      reason: "This task has been flagged as High Risk due to workload concentration or tight timelines.",
      nextAction: "Spend 10 minutes planning the absolute minimum viable steps to get started.",
      estimatedFocusTime: "50 mins",
      riskIfIgnored: "High" as const,
      isFallback: true
    };
  }

  // 4. Medium-risk tasks
  const mediumRiskTasks = activeTasks.filter(t => t.riskLevel === "Medium");
  if (mediumRiskTasks.length > 0) {
    mediumRiskTasks.sort((a, b) => a.hoursRemaining - b.hoursRemaining);
    const selected = mediumRiskTasks[0];
    return {
      recommendedTask: selected.title,
      reason: "This task has a Medium Risk profile. Addressing it now keeps you ahead of your upcoming schedule.",
      nextAction: "Draft a skeleton outline and execute the next easy step.",
      estimatedFocusTime: "30 mins",
      riskIfIgnored: "Medium" as const,
      isFallback: true
    };
  }

  // 5. Low-risk tasks
  const lowRiskTasks = activeTasks.filter(t => t.riskLevel === "Low" || t.riskLevel === "Unknown");
  if (lowRiskTasks.length > 0) {
    lowRiskTasks.sort((a, b) => a.hoursRemaining - b.hoursRemaining);
    const selected = lowRiskTasks[0];
    return {
      recommendedTask: selected.title,
      reason: "This task is Low Risk, making it a great low-friction option to build momentum.",
      nextAction: "Open the workspace and complete one quick item to check it off.",
      estimatedFocusTime: "25 mins",
      riskIfIgnored: "Low" as const,
      isFallback: true
    };
  }

  // Absolute fallback
  const selected = activeTasks[0];
  return {
    recommendedTask: selected.title,
    reason: "This active task is selected to help maintain a steady, productive rhythm.",
    nextAction: "Start with 10 minutes of gentle, focused progress.",
    estimatedFocusTime: "25 mins",
    riskIfIgnored: "Low" as const,
    isFallback: true
  };
}

function generateDeterministicRecommendNext(tasks: any[], currentTime: string) {
  const rec = generateDeterministicRecommendation(tasks, currentTime);
  return {
    recommendedTask: rec.recommendedTask,
    whyThisTask: rec.reason,
    selectedBecause: [
      `Selected based on priority tiering: ${rec.riskIfIgnored} risk status`,
      `Initial focus effort is set to ${rec.estimatedFocusTime}`,
    ],
    nextAction: rec.nextAction,
    estimatedFocusTime: rec.estimatedFocusTime,
    riskIfDelayed: rec.riskIfIgnored,
    isFallback: true
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Server-side Gemini API Route
  app.post("/api/analyze-task", async (req, res) => {
    try {
      const { 
        title, 
        description, 
        deadline, 
        estimatedEffort,
        activeTasksCount,
        totalActiveEffort,
        otherActiveTasks,
        currentTime
      } = req.body;
      if (!title) {
        return res.status(400).json({ error: "Task title is required." });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ 
          error: "GEMINI_API_KEY is not configured on the server. Please add it in Settings > Secrets." 
        });
      }

      // Calculate time remaining based on provided currentTime (client local time) or server time
      let timeRemainingText = "Unknown";
      try {
        const nowMs = currentTime ? new Date(currentTime).getTime() : Date.now();
        const deadlineMs = new Date(deadline).getTime();
        const diffMs = deadlineMs - nowMs;
        if (diffMs < 0) {
          timeRemainingText = "Overdue (deadline has passed)";
        } else {
          const hours = Math.floor(diffMs / (1000 * 60 * 60));
          const days = (diffMs / (1000 * 60 * 60 * 24)).toFixed(1);
          if (hours < 1) {
            const minutes = Math.floor(diffMs / (1000 * 60));
            timeRemainingText = `${minutes} minutes remaining`;
          } else if (hours < 48) {
            timeRemainingText = `${hours} hours remaining`;
          } else {
            timeRemainingText = `${days} days remaining`;
          }
        }
      } catch (e) {
        console.error("Error calculating time remaining:", e);
      }

      // Lazy-initialize client to be safe and use recommended User-Agent header for telemetry
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          }
        }
      });

      const prompt = `You are an AI productivity coach. Analyze the user's task to recommend an intelligent, stress-free start time and detailed plan.
- Task Title: "${title}"
- Description: "${description || "None"}"
- Deadline Time/Date: "${deadline}"
- Estimated Effort Required: ${estimatedEffort} hours

CURRENT CONTEXT FOR INTELLECTUAL SCHEDULING (CRITICAL):
- Current Local Time: ${currentTime || new Date().toISOString()}
- Exact Time Remaining to Deadline: ${timeRemainingText}
- Total Active Tasks: ${activeTasksCount || 1} tasks currently in progress
- Total Existing Workload (Active Effort): ${totalActiveEffort || estimatedEffort} hours across all tasks
- Other Active Task Titles (existing commitments): ${otherActiveTasks && otherActiveTasks.length > 0 ? otherActiveTasks.join(", ") : "None"}

Generate an action-focused, highly concise coaching response.
Your entire set of answers across all fields must be under 100 words in total.

In planning and formatting the suggested start time:
- Prioritize early completion to avoid last-minute stress.
- Recommend starting well before the deadline whenever possible to create healthy safety buffers.
- NEVER recommend starting close to the deadline. For example, if there are 24 hours remaining and estimated effort is 2 hours, do NOT suggest starting 2 hours before the deadline. Suggest starting with at least a 4-8 hour buffer, or starting "in the next hour" or "tomorrow morning" to get it out of the way.
- Adjust the recommendation dynamically: if the user's workload is heavy (${totalActiveEffort} hours across ${activeTasksCount} tasks) or time remaining is short, advise starting immediately or much earlier to prevent entering panic mode.
- CRITICAL: NEVER recommend a start time that is in the past relative to the user's current local time ("Current Local Time: ${currentTime}"). Compare your proposed start time against the current local time. If the ideal start time has already passed, or if the task is becoming risky, you MUST recommend one of these urgent, highly visible, actionable formats:
  * "⚠ Recommended Start: Now"
  * "⚠ Start Immediately to maintain deadline safety buffer."
- If sufficient time remains, use one of these high-contrast, scannable, human-friendly formats:
  * "Recommended Start: Today at 5:00 PM"
  * "Start by 9:30 AM Tomorrow"
  * "Start on Friday at 2:00 PM"
  * "Start within the next 2 hours"
- Do NOT output long, dry timestamps or ISO strings. Keep it friendly, immediate, and understandable in 2 seconds.

Respond with a JSON object containing these exact properties and formats:
{
  "breakdown": [
    "Step 1 (action statement)",
    "Step 2 (action statement)",
    "Step 3 (action statement)"
  ],
  "recommendedNextAction": "A single immediate physical micro-step to start now",
  "suggestedStartTime": "Friendly immediate format matching one of the preferred examples above",
  "riskLevel": "Low" | "Medium" | "High",
  "productivityAdvice": "Exactly one sentence of strong, direct productivity/focus advice."
}

Ensure all text is direct, crisp, action-oriented, and strictly conforms to JSON format.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      const text = response.text || "{}";
      try {
        const parsedData = JSON.parse(text);
        res.json(parsedData);
      } catch (parseError) {
        console.error("Failed to parse response text as JSON:", text);
        res.status(500).json({ error: "Invalid JSON response from the analysis model." });
      }
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      res.status(500).json({ error: error.message || "An error occurred during Gemini analysis." });
    }
  });

  // Server-side AI assistant for "WHAT SHOULD I DO RIGHT NOW?"
  app.post("/api/recommend-next", async (req, res) => {
    const { tasks, currentTime } = req.body || {};
    try {
      if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
        return res.json({
          recommendedTask: "No active tasks",
          whyThisTask: "You have completed all of your active tasks or haven't created any yet!",
          nextAction: "Create a new task or take a well-deserved break!",
          estimatedFocusTime: "0 mins",
          riskIfDelayed: "Low"
        });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.warn("GEMINI_API_KEY is not configured. Falling back to offline deterministic logic.");
        const fallback = generateDeterministicRecommendNext(tasks, currentTime);
        return res.json(fallback);
      }

      // Format tasks for the prompt to minimize tokens and focus on key data
      const formattedTasks = tasks.map((t: any) => {
        let timeRemaining = "Unknown";
        let isOverdue = false;
        let hoursRemainingNum = 999999;
        try {
          const nowMs = currentTime ? new Date(currentTime).getTime() : Date.now();
          const deadlineMs = new Date(t.deadline).getTime();
          const diffMs = deadlineMs - nowMs;
          if (diffMs < 0) {
            timeRemaining = "Overdue (deadline has passed)";
            isOverdue = true;
            hoursRemainingNum = diffMs / (1000 * 60 * 60); // Negative value for overdue
          } else {
            const hours = Math.floor(diffMs / (1000 * 60 * 60));
            hoursRemainingNum = diffMs / (1000 * 60 * 60);
            if (hours < 1) {
              const minutes = Math.floor(diffMs / (1000 * 60));
              timeRemaining = `${minutes} mins remaining`;
            } else if (hours < 48) {
              timeRemaining = `${hours} hours remaining`;
            } else {
              const days = (diffMs / (1000 * 60 * 60 * 24)).toFixed(1);
              timeRemaining = `${days} days remaining`;
            }
          }
        } catch (e) {
          // ignore
        }

        return {
          id: t.id,
          title: t.title,
          notes: t.notes || "",
          estimatedEffort: `${t.estimatedEffort}h`,
          timeRemaining,
          isOverdue,
          hoursRemaining: isOverdue ? hoursRemainingNum : parseFloat(hoursRemainingNum.toFixed(1)),
          riskLevel: t.storedRisk?.level || t.aiAnalysis?.riskLevel || "Unknown",
          category: t.category || "General"
        };
      });

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          }
        }
      });

      const prompt = `You are an expert AI productivity assistant and executive coach. Your absolute focus is to help overwhelmed users immediately decide what to work on right now from their active tasks list by enforcing a rigorous prioritization hierarchy that never ignores overdue commitments.

Active tasks:
${JSON.stringify(formattedTasks, null, 2)}

Current Local Time: ${currentTime || new Date().toISOString()}

Your task is to analyze the active tasks and select the single ONE task the user must work on RIGHT NOW using this strict priority order:
1. Overdue and incomplete tasks (highest priority). Overdue status increases priority score significantly. Incomplete overdue tasks should generally outrank future tasks.
2. Tasks due within 24 hours (hoursRemaining <= 24).
3. High-risk tasks.
4. Medium-risk tasks.
5. Low-risk tasks.

Decision Rules & Priority logic:
- Never ignore overdue tasks.
- If overdue tasks exist, you MUST explicitly consider them first. You may only recommend a future task over an overdue task if there is a clearly higher risk of missing a critical impending deadline (e.g., a high-risk task due in 1 hour versus an overdue low-risk task). If you recommend a future task over an overdue task, you MUST explain that decision in the "whyThisTask" reason.
- Otherwise, if an overdue task is present, select the overdue task.
- "whyThisTask" must be one single high-impact sentence. For overdue tasks, make sure it matches this style: "This task is already overdue and remains incomplete. Resolving overdue work first reduces accumulated deadline risk and prevents backlog growth." or similar context-specific variant.

Select the ONE single active task that the user should absolutely work on RIGHT NOW to maximize momentum, reduce stress, and maintain deadline safety buffers.

Respond ONLY with a JSON object of this exact schema:
{
  "recommendedTask": "Title of the recommended task exactly matching one of the active tasks",
  "whyThisTask": "One single high-impact sentence explaining why this task is the priority now according to the decision rules.",
  "selectedBecause": [
    "A concise, transparent, factual reason (e.g., 'Task is overdue by X hours' or 'Due in less than 24 hours')",
    "Another concise, transparent, factual reason (e.g., 'High-risk level associated with potential delays')",
    "A third concise, transparent, factual reason (e.g., 'Requires 2 hours of effort but starts with a quick action')"
  ],
  "nextAction": "A highly specific, physical, micro-action the user can start in 2 seconds (e.g. 'Open slide deck and write the first paragraph' or 'Locate your source material files')",
  "estimatedFocusTime": "Time duration for an initial focus session, e.g., '25 mins' or '45 mins'",
  "riskIfDelayed": "Low" | "Medium" | "High"
}

Ensure all text is concise, actionable, and strictly conforms to JSON format. Avoid conversational fillers, markdown outside the JSON, or preambles.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      const text = response.text || "{}";
      try {
        const parsedData = JSON.parse(text);
        res.json(parsedData);
      } catch (parseError) {
        console.error("Failed to parse recommend-next response text as JSON, falling back:", text);
        const fallback = generateDeterministicRecommendNext(tasks, currentTime);
        res.json(fallback);
      }
    } catch (error: any) {
      console.error("Gemini recommendation API Error, falling back:", error);
      const fallback = generateDeterministicRecommendNext(tasks, currentTime);
      res.json(fallback);
    }
  });

  // Server-side Smart Rescue Plan analyzer
  app.post("/api/smart-rescue-plan", async (req, res) => {
    const { tasks, currentTime } = req.body || {};
    try {
      if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
        return res.json({
          recommendedTask: "No active tasks",
          reason: "All of your tasks are completed or you haven't created any yet.",
          nextAction: "Create a new task to generate a Smart Rescue Plan.",
          estimatedFocusTime: "0 mins",
          riskIfIgnored: "Low"
        });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.warn("GEMINI_API_KEY is not configured. Falling back to offline deterministic logic.");
        const fallback = generateDeterministicRecommendation(tasks, currentTime);
        return res.json(fallback);
      }

      // Format active tasks for Gemini prompt
      const formattedTasks = tasks.map((t: any) => {
        let timeRemaining = "Unknown";
        let isOverdue = false;
        let hoursRemainingNum = 999999;
        try {
          const nowMs = currentTime ? new Date(currentTime).getTime() : Date.now();
          const deadlineMs = new Date(t.deadline).getTime();
          const diffMs = deadlineMs - nowMs;
          if (diffMs < 0) {
            timeRemaining = "Overdue (deadline passed)";
            isOverdue = true;
            hoursRemainingNum = diffMs / (1000 * 60 * 60);
          } else {
            const hours = Math.floor(diffMs / (1000 * 60 * 60));
            hoursRemainingNum = diffMs / (1000 * 60 * 60);
            if (hours < 1) {
              const minutes = Math.floor(diffMs / (1000 * 60));
              timeRemaining = `${minutes} mins remaining`;
            } else if (hours < 48) {
              timeRemaining = `${hours} hours remaining`;
            } else {
              const days = (diffMs / (1000 * 60 * 60 * 24)).toFixed(1);
              timeRemaining = `${days} days remaining`;
            }
          }
        } catch (e) {
          // ignore
        }

        return {
          id: t.id,
          title: t.title,
          notes: t.notes || "",
          estimatedEffort: `${t.estimatedEffort}h`,
          timeRemaining,
          isOverdue,
          hoursRemaining: isOverdue ? hoursRemainingNum : parseFloat(hoursRemainingNum.toFixed(1)),
          riskLevel: t.storedRisk?.level || t.aiAnalysis?.riskLevel || "Unknown",
          category: t.category || "General"
        };
      });

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          }
        }
      });

      const prompt = `You are an expert AI productivity assistant and executive coach. Your absolute focus is to help overwhelmed users immediately decide what to work on right now by building a "Smart Rescue Plan".
Analyze the following active tasks:
${JSON.stringify(formattedTasks, null, 2)}

Current Local Time: ${currentTime || new Date().toISOString()}

Your task is to analyze the active tasks and select the single ONE task that is most critical or urgent.
Follow these priority rules:
1. Overdue tasks are highest priority.
2. Incomplete tasks due soonest.
3. Heavy estimated effort tasks due in the next 24-48 hours.

Based on this, generate a Smart Rescue Plan. Your response must be extremely action-oriented, concise, and formatted as a JSON object with these exact properties:
- recommendedTask: The title of the recommended task exactly matching one of the active tasks.
- reason: One single concise sentence explaining why this task is the priority now.
- nextAction: A highly specific, physical, micro-action the user can start in 2 seconds (e.g. 'Open document and write the first heading').
- estimatedFocusTime: A realistic initial focus duration (e.g., '25 mins', '45 mins', '50 mins').
- riskIfIgnored: 'Low' | 'Medium' | 'High'

Avoid conversational fillers, preamble, or markdown outside of the JSON block. Ensure the JSON is syntactically valid.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      const text = response.text || "{}";
      try {
        const parsedData = JSON.parse(text);
        res.json(parsedData);
      } catch (parseError) {
        console.error("Failed to parse smart-rescue response text as JSON, falling back:", text);
        const fallback = generateDeterministicRecommendation(tasks, currentTime);
        res.json(fallback);
      }
    } catch (error: any) {
      console.error("Gemini Smart Rescue API Error, falling back:", error);
      const fallback = generateDeterministicRecommendation(tasks, currentTime);
      res.json(fallback);
    }
  });

  // Server-side Workload Conflict Detection
  app.post("/api/workload-conflict", async (req, res) => {
    try {
      const { tasks, currentTime } = req.body;
      const nowMs = currentTime ? new Date(currentTime).getTime() : Date.now();
      
      if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
        return res.json({
          conflictDetected: false,
          conflictingTasks: [],
          explanation: "All quiet. You currently have no active tasks creating conflict.",
          prioritizedTask: "",
          prioritizedReason: ""
        });
      }

      // Check for local heuristics first to see if conflict exists, and also use it as fallback
      const active = tasks.filter((t: any) => !t.completed);
      
      // Let's compute some local statistics to see if we have conflicts
      const overdueTasks = active.filter((t: any) => new Date(t.deadline).getTime() < nowMs);
      const soonTasks = active.filter((t: any) => {
        const timeToDeadline = new Date(t.deadline).getTime() - nowMs;
        return timeToDeadline > 0 && timeToDeadline < 24 * 60 * 60 * 1000; // due in next 24 hours
      });
      
      const totalEstimatedEffort = active.reduce((sum: number, t: any) => sum + (Number(t.estimatedEffort) || 0), 0);
      const highRiskCount = active.filter((t: any) => {
        const risk = t.storedRisk?.level || t.aiAnalysis?.riskLevel;
        return risk === "High" || risk === "Overdue";
      }).length;

      // Overlap detection: find if there are multiple tasks with deadlines within 6 hours of each other
      let overlaps = false;
      const conflictingTitles: string[] = [];
      const sortedByDeadline = [...active].sort((a: any, b: any) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
      
      for (let i = 0; i < sortedByDeadline.length - 1; i++) {
        const first = sortedByDeadline[i];
        const second = sortedByDeadline[i + 1];
        const diff = Math.abs(new Date(second.deadline).getTime() - new Date(first.deadline).getTime());
        if (diff < 6 * 60 * 60 * 1000) { // within 6 hours
          overlaps = true;
          if (!conflictingTitles.includes(first.title)) conflictingTitles.push(first.title);
          if (!conflictingTitles.includes(second.title)) conflictingTitles.push(second.title);
        }
      }

      const exceedsAvailableTime = totalEstimatedEffort > 12 || (soonTasks.length > 0 && totalEstimatedEffort > 8);
      const competingHighRisk = highRiskCount >= 2 || (overdueTasks.length > 0 && soonTasks.length > 0);
      const localConflictDetected = overlaps || exceedsAvailableTime || competingHighRisk;

      // Fallback heuristic result generators
      const generateHeuristicResult = () => {
        const conflictingList = conflictingTitles.length > 0 ? conflictingTitles : active.slice(0, 3).map((t: any) => t.title);
        let explanationText = "";
        let primaryTask = active[0]?.title || "";
        let reasonText = "";

        if (overdueTasks.length > 0) {
          explanationText = `You have ${overdueTasks.length} overdue task(s) competing with upcoming commitments, causing immediate workload congestion.`;
          primaryTask = overdueTasks[0].title;
          reasonText = "This task has already passed its deadline and is causing critical bottleneck pressure.";
        } else if (overlaps) {
          explanationText = `Multiple deadlines overlap too closely (within 6 hours), creating a time-squeeze bottleneck for: "${conflictingList.join('" and "')}".`;
          primaryTask = sortedByDeadline[0].title;
          reasonText = "It is due first among your overlapping commitments. Completing it will immediately break the jam.";
        } else if (exceedsAvailableTime) {
          explanationText = `Your total active estimated effort of ${totalEstimatedEffort.toFixed(1)}h exceeds a healthy daily focus load limit, creating a deficit of available time.`;
          primaryTask = sortedByDeadline[0].title;
          reasonText = "It has the earliest deadline and represents the most immediate milestone to clear.";
        } else if (competingHighRisk) {
          explanationText = `Several high-risk tasks are competing for your attention simultaneously, risking task paralysis.`;
          primaryTask = sortedByDeadline[0].title;
          reasonText = "It is the highest risk task with the shortest buffer time remaining.";
        } else {
          explanationText = "No severe workload conflict detected. Your schedule and buffers are currently manageable.";
        }

        return {
          conflictDetected: localConflictDetected,
          conflictingTasks: localConflictDetected ? conflictingList : [],
          explanation: explanationText,
          prioritizedTask: localConflictDetected ? primaryTask : "",
          prioritizedReason: localConflictDetected ? reasonText : ""
        };
      };

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        // Safe heuristic fallback
        return res.json(generateHeuristicResult());
      }

      // If apiKey exists, invoke Gemini for highly tailored and smart reasoning
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          }
        }
      });

      const formattedTasks = active.map((t: any) => ({
        title: t.title,
        deadline: t.deadline,
        estimatedEffort: `${t.estimatedEffort} hours`,
        notes: t.notes || "",
        category: t.category || "General",
        riskLevel: t.storedRisk?.level || t.aiAnalysis?.riskLevel || "Unknown"
      }));

      const prompt = `You are a professional project coordinator and productivity risk assessor.
Analyze the following active, incomplete tasks for workload conflict:
${JSON.stringify(formattedTasks, null, 2)}

Current Reference Time: ${currentTime || new Date().toISOString()}

Your goal is to detect if there is an active workload conflict:
A conflict is defined by:
1. "Overlapping Deadlines": Tasks due within 6-8 hours of each other.
2. "Exceeded Capacity": The sum of estimated effort is larger than the actual buffer hours before the earliest deadlines.
3. "Competing Priorities": Two or more high-risk/overdue tasks demanding focus at once.

Heuristic assessment suggests conflictDetected is: ${localConflictDetected}.

Please return a single JSON object. Ensure the format is exactly:
{
  "conflictDetected": true or false,
  "conflictingTasks": ["Title of conflicting task 1", "Title of conflicting task 2"],
  "explanation": "A very concise single sentence describing which tasks conflict and why they conflict.",
  "prioritizedTask": "Title of the recommended task to work on first to resolve the conflict",
  "prioritizedReason": "A single concise sentence explaining why this task must be prioritized first."
}

Ensure all fields are concise, direct, and helpful. Do not output markdown code blocks except the valid raw JSON.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      const text = response.text || "{}";
      try {
        const parsedData = JSON.parse(text);
        res.json(parsedData);
      } catch (parseError) {
        console.error("Failed to parse workload-conflict response as JSON, falling back to heuristic:", text);
        res.json(generateHeuristicResult());
      }
    } catch (error: any) {
      console.error("Gemini Workload Conflict API Error, falling back to heuristic:", error);
      // Fallback seamlessly so the user never sees a failure
      try {
        const { tasks, currentTime } = req.body;
        const nowMs = currentTime ? new Date(currentTime).getTime() : Date.now();
        const active = (tasks || []).filter((t: any) => !t.completed);
        const overdueTasks = active.filter((t: any) => new Date(t.deadline).getTime() < nowMs);
        const totalEstimatedEffort = active.reduce((sum: number, t: any) => sum + (Number(t.estimatedEffort) || 0), 0);
        res.json({
          conflictDetected: active.length > 1,
          conflictingTasks: active.slice(0, 2).map((t: any) => t.title),
          explanation: overdueTasks.length > 0 
            ? `Workload Conflict: You have overdue tasks competing with upcoming deadlines.` 
            : `Workload Conflict: High density of tasks (${active.length} active tasks, ${totalEstimatedEffort.toFixed(1)}h work) exceeds available capacity.`,
          prioritizedTask: active[0]?.title || "",
          prioritizedReason: "This task represents the most urgent active milestone on your list."
        });
      } catch (innerErr) {
        res.status(500).json({ error: "An unexpected error occurred during conflict analysis." });
      }
    }
  });

  // Server-side Intelligent Task Queue Generator
  app.post("/api/intelligent-queue", async (req, res) => {
    let fallbackResult: any = null;
    try {
      const { tasks, currentTime } = req.body;
      const nowMs = currentTime ? new Date(currentTime).getTime() : Date.now();

      if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
        return res.json({
          recommendedOrder: [],
          analysisSummary: "You currently have no active tasks to arrange in a queue."
        });
      }

      const active = tasks.filter((t: any) => !t.completed);

      // Local heuristic-based sorting as fallback
      // Fallback ranking rules:
      // 1. Overdue tasks first.
      // 2. Among overdue tasks, earliest missed deadline first.
      // 3. Then High > Medium > Low risk.
      // 4. Then earliest upcoming deadline.
      // 5. Then shorter estimated work session.
      // 6. Then creation order.
      const sortHeuristically = () => {
        return [...active].sort((a: any, b: any) => {
          const aMs = new Date(a.deadline).getTime();
          const bMs = new Date(b.deadline).getTime();
          
          const aOverdue = aMs < nowMs;
          const bOverdue = bMs < nowMs;

          // 1. Overdue tasks first.
          if (aOverdue !== bOverdue) {
            return aOverdue ? -1 : 1;
          }

          // 2. Among overdue tasks, earliest missed deadline first.
          if (aOverdue && bOverdue) {
            if (aMs !== bMs) {
              return aMs - bMs;
            }
          }

          // 3. Then High > Medium > Low risk.
          const aRisk = a.storedRisk?.level || a.aiAnalysis?.riskLevel || "Low";
          const bRisk = b.storedRisk?.level || b.aiAnalysis?.riskLevel || "Low";
          const riskWeight = (r: string) => {
            const norm = r ? r.toLowerCase() : "";
            if (norm === "high") return 3;
            if (norm === "medium") return 2;
            if (norm === "low") return 1;
            return 0;
          };
          const aWeight = riskWeight(aRisk);
          const bWeight = riskWeight(bRisk);
          if (aWeight !== bWeight) {
            return bWeight - aWeight; // Descending: higher risk first
          }

          // 4. Then earliest upcoming deadline.
          if (aMs !== bMs) {
            return aMs - bMs; // Ascending: earliest upcoming deadline first
          }

          // 5. Then shorter estimated work session.
          const aEffort = Number(a.estimatedEffort) || 0;
          const bEffort = Number(b.estimatedEffort) || 0;
          if (aEffort !== bEffort) {
            return aEffort - bEffort; // Ascending: shorter effort first
          }

          // 6. Then creation order.
          const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          if (aCreated !== bCreated) {
            return aCreated - bCreated; // Ascending: earliest created first
          }

          return 0;
        });
      };

      const sortedHeuristically = sortHeuristically();
      let cumulativeHours = 0;
      const defaultOrderList = sortedHeuristically.map((t: any, idx: number) => {
        const aMs = new Date(t.deadline).getTime();
        const overdue = aMs < nowMs;
        const risk = t.storedRisk?.level || t.aiAnalysis?.riskLevel || "Low";
        const effort = Number(t.estimatedEffort) || 0;
        
        cumulativeHours += effort;
        const estimatedFinishDate = new Date(nowMs + cumulativeHours * 60 * 60 * 1000);
        
        const formatTime = (d: Date) => {
          return d.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          });
        };
        const isToday = estimatedFinishDate.toDateString() === new Date(nowMs).toDateString();
        const formattedFinish = isToday 
          ? `Today at ${formatTime(estimatedFinishDate)}` 
          : `${estimatedFinishDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} at ${formatTime(estimatedFinishDate)}`;

        let reason = "";
        if (overdue) {
          reason = `Overdue task with ${risk} Risk. Needs immediate focus. Estimated recovery completion: ${formattedFinish}.`;
        } else {
          const diffHrs = (aMs - nowMs) / (1000 * 60 * 60);
          reason = `Due in ${diffHrs.toFixed(1)}h with ${effort}h effort (${risk} Risk). Estimated completion: ${formattedFinish}.`;
        }

        return {
          id: t.id,
          title: t.title,
          reason
        };
      });

      const totalEffort = sortedHeuristically.reduce((sum, t) => sum + (Number(t.estimatedEffort) || 0), 0);
      const overallFinishDate = new Date(nowMs + totalEffort * 60 * 60 * 1000);
      const formatTime = (d: Date) => {
        return d.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        });
      };
      const isToday = overallFinishDate.toDateString() === new Date(nowMs).toDateString();
      const formattedOverallFinish = isToday 
        ? `Today at ${formatTime(overallFinishDate)}` 
        : `${overallFinishDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} at ${formatTime(overallFinishDate)}`;

      fallbackResult = {
        recommendedOrder: defaultOrderList,
        analysisSummary: `Deterministic queue optimized to clear overdue tasks first. Entire queue estimated to be completed by ${formattedOverallFinish} (${totalEffort}h total effort).`,
        isFallback: true
      };

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.json(fallbackResult);
      }

      // If key exists, let Gemini analyze and build the sequence
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          }
        }
      });

      const formattedTasks = active.map((t: any) => {
        const dMs = new Date(t.deadline).getTime();
        const hoursLeft = (dMs - nowMs) / (1000 * 60 * 60);
        return {
          id: t.id,
          title: t.title,
          notes: t.notes || "",
          estimatedEffort: `${t.estimatedEffort}h`,
          hoursLeft: dMs < nowMs ? `Overdue by ${Math.abs(hoursLeft).toFixed(1)}h` : `${hoursLeft.toFixed(1)}h remaining`,
          overdue: dMs < nowMs,
          riskLevel: t.storedRisk?.level || t.aiAnalysis?.riskLevel || "Unknown",
          category: t.category || "General"
        };
      });

      const prompt = `You are a world-class productivity engineer.
We need to create an "Intelligent Task Queue" for a user who is overwhelmed with tasks.
Analyze the following active tasks:
${JSON.stringify(formattedTasks, null, 2)}

Current Reference Time: ${new Date(nowMs).toISOString()}

Your objective is to order all active tasks into a recommended sequential order (1st, 2nd, 3rd, etc.) to minimize missed deadlines and maximize cognitive momentum.
Use these criteria:
- Overdue tasks must generally go first to clear pressure.
- High-risk / low-buffer items must go ahead of safer tasks.
- For similar deadlines, order smaller/easier tasks first (low effort) to gain psychological wins, OR a heavy blocker if it's high impact.

Your response must be a single, valid JSON object containing exactly:
- recommendedOrder: An array of objects, each containing:
  - id: The exact task id.
  - title: The exact task title.
  - reason: A single concise sentence explaining why this task is in this specific queue position.
- analysisSummary: A single, punchy overview sentence summarizing the queue strategy. Keep the explanation under 40 words (e.g. 'This order mitigates overdue risk while securing quick wins to build momentum.').

Do not include markdown outside of the raw JSON code. Return only the valid JSON structure.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      const text = response.text || "{}";
      try {
        const parsedData = JSON.parse(text);
        if (parsedData && Array.isArray(parsedData.recommendedOrder)) {
          const taskMap = new Map(active.map(t => [t.id, t]));
          parsedData.recommendedOrder.sort((a: any, b: any) => {
            const taskA = taskMap.get(a.id);
            const taskB = taskMap.get(b.id);
            if (!taskA && !taskB) return 0;
            if (!taskA) return 1;
            if (!taskB) return -1;
            
            const aMs = new Date(taskA.deadline).getTime();
            const bMs = new Date(taskB.deadline).getTime();
            
            const aOverdue = aMs < nowMs;
            const bOverdue = bMs < nowMs;

            // 1. Overdue tasks must always rank above non-overdue tasks.
            if (aOverdue !== bOverdue) {
              return aOverdue ? -1 : 1;
            }

            // 2. Among overdue tasks, the task with the earliest deadline (oldest missed deadline) must rank first.
            if (aMs !== bMs) {
              return aMs - bMs;
            }

            // 3. If deadlines are identical, sort by higher risk.
            const aRisk = taskA.storedRisk?.level || taskA.aiAnalysis?.riskLevel || "Low";
            const bRisk = taskB.storedRisk?.level || taskB.aiAnalysis?.riskLevel || "Low";
            const riskWeight = (r: string) => {
              const norm = r ? r.toLowerCase() : "";
              if (norm === "high") return 3;
              if (norm === "medium") return 2;
              if (norm === "low") return 1;
              return 0;
            };
            const aWeight = riskWeight(aRisk);
            const bWeight = riskWeight(bRisk);
            if (aWeight !== bWeight) {
              return bWeight - aWeight;
            }

            // 4. If risk is identical, sort by shortest estimated work time.
            const aEffort = Number(taskA.estimatedEffort) || 0;
            const bEffort = Number(taskB.estimatedEffort) || 0;
            if (aEffort !== bEffort) {
              return aEffort - bEffort;
            }

            // 5. If still tied, preserve creation order.
            const aCreated = taskA.createdAt ? new Date(taskA.createdAt).getTime() : 0;
            const bCreated = taskB.createdAt ? new Date(taskB.createdAt).getTime() : 0;
            if (aCreated !== bCreated) {
              return aCreated - bCreated;
            }

            return 0;
          });
          res.json(parsedData);
        } else {
          res.json(fallbackResult);
        }
      } catch (e) {
        console.error("Failed to parse intelligent-queue JSON, falling back:", text);
        res.json(fallbackResult);
      }
    } catch (error: any) {
      console.error("Intelligent Task Queue Endpoint Error:", error);
      res.json(fallbackResult || { recommendedOrder: [], analysisSummary: "Unable to build recommended task order." });
    }
  });

  // Server-side AI Focus Session Planner
  app.post("/api/focus-session-plan", async (req, res) => {
    try {
      const { title, estimatedEffort, notes, category, deadlineInfo } = req.body;

      if (!title) {
        return res.status(400).json({ error: "Task title is required." });
      }

      const effort = Number(estimatedEffort) || 1;
      
      // Calculate logical number of focus sessions (e.g. 1 hour = 2 sessions of 25 min or 1 session of 50 min)
      const numSessions = Math.max(1, Math.min(4, Math.round(effort * 1.5)));

      // Fallback focus plan
      const sessions = [];
      for (let i = 1; i <= numSessions; i++) {
        let sessionDuration = "25 minutes";
        let breakDuration = "5 minutes";
        let goal = "";
        let sTask = "";

        if (numSessions === 1) {
          sessionDuration = "50 minutes";
          breakDuration = "10 minutes";
          sTask = `Establish foundation and complete primary components of "${title}"`;
          goal = "Draft setup checklist, map core elements, and execute high-priority functions.";
        } else if (i === 1) {
          sessionDuration = "45 minutes";
          breakDuration = "5 minutes";
          sTask = `Deconstruct requirements and prepare skeleton of "${title}"`;
          goal = "Set up workspace parameters, draft layout, and list subcomponents.";
        } else if (i === numSessions) {
          sessionDuration = "30 minutes";
          breakDuration = "15 minutes";
          sTask = `Perform quality sweep, fix edge cases, and polish "${title}"`;
          goal = "Review work completed, adjust layout/behavior, and verify against deadline constraints.";
        } else {
          sessionDuration = "50 minutes";
          breakDuration = "10 minutes";
          sTask = `Build and expand middle features of "${title}"`;
          goal = "Implement main operational elements and connect data flows sequentially.";
        }

        sessions.push({
          sessionNumber: i,
          task: sTask,
          duration: sessionDuration,
          goal,
          breakDuration,
        });
      }

      const fallbackResult = {
        sessions,
        lastUpdated: new Date().toISOString()
      };

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.json(fallbackResult);
      }

      // Initialize Gemini Client
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          }
        }
      });

      const prompt = `You are an elite productivity strategist and focus designer.
We need to generate a highly practical, easy-to-follow, and realistic "Focus Session Plan" for the following task:
- Task Title: ${title}
- Estimated Effort Required: ${effort} hours
- Optional Notes: ${notes || "None"}
- Category: ${category || "General"}
- Deadline Urgency Context: ${deadlineInfo || "Normal"}

Your response MUST be a single, valid JSON object containing exactly:
- sessions: An array of objects conforming to this schema:
  - sessionNumber: (integer) consecutive index starting at 1
  - task: (string) specific sub-task or actionable focus activity to work on during this block
  - duration: (string) duration of the focus session, e.g., '25 minutes', '45 minutes', '50 minutes'
  - goal: (string) a clear, high-impact, specific objective for this session
  - breakDuration: (string) duration of the break following the session, e.g., '5 minutes', '10 minutes', '15 minutes'

Ensure that:
1. The sub-tasks and goals are directly customized for the provided task "${title}" and any notes: "${notes || "None"}".
2. The durations are realistic (e.g. 25-minute Pomodoros or 50-minute deep work blocks).
3. The total duration of all sessions aligns reasonably with the estimated effort of ${effort} hours.
4. Keep the plans extremely practical, encouraging, and clear.

Do not include markdown outside of the raw JSON code. Return only the valid JSON structure.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      const text = response.text || "{}";
      try {
        const parsedData = JSON.parse(text);
        if (parsedData && Array.isArray(parsedData.sessions)) {
          res.json({
            sessions: parsedData.sessions,
            lastUpdated: new Date().toISOString()
          });
        } else {
          res.json(fallbackResult);
        }
      } catch (e) {
        console.error("Failed to parse focus session JSON, falling back:", text);
        res.json(fallbackResult);
      }
    } catch (error: any) {
      console.error("Focus Session Plan Endpoint Error:", error);
      res.status(500).json({ error: "Failed to generate focus session plan." });
    }
  });

  // Serve Vite or Static files depending on environment
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
