import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Trash2, ShieldAlert, CheckCircle2, ListFilter, SlidersHorizontal, Search, RefreshCw, Layers, Flame, Target, Clock, Check, X, ChevronRight, Coffee, Edit3 } from "lucide-react";
import { Task, CategoryType } from "./types";
import { analyzeTaskDeadline, isTaskPanicQualifying, computeStoredRiskForTasks, generateLocalDefaultFocusPlan } from "./utils";
import Dashboard from "./components/Dashboard";
import TaskForm from "./components/TaskForm";
import TaskCard from "./components/TaskCard";
import PanicMode from "./components/PanicMode";
import AiCommandCenter from "./components/AiCommandCenter";

// Helper to parse duration minutes from string like "25 minutes", "25m", "45 mins" or "30"
const parseDurationMinutes = (durationStr: string): number => {
  if (!durationStr) return 25;
  const match = durationStr.match(/(\d+)/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return 25;
};

// Initial seed tasks to provide immediate context on empty startup
const SEED_TASKS = (): Task[] => {
  const d1 = new Date();
  d1.setHours(d1.getHours() + 3); // 3 hours from now

  const d2 = new Date();
  d2.setHours(d2.getHours() + 18); // 18 hours from now

  const d3 = new Date();
  d3.setDate(d3.getDate() + 2); // 2 days from now

  const d4 = new Date();
  d4.setDate(d4.getDate() - 1); // Completed yesterday

  return [
    {
      id: "seed-1",
      title: "Urgent: Final Physics Lab Report Submission",
      deadline: d1.toISOString(),
      estimatedEffort: 4, // 4 hours effort but only 3 hours left! Will trigger Critical Panic
      completed: false,
      category: "School",
      notes: "Upload PDF directly to the portal. Remember to double-check error margins and graphs.",
      resourceLink: "https://canvas.stanford.edu/courses/physics-lab",
      createdAt: new Date(Date.now() - 3.5 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "seed-2",
      title: "Renew Domain & Host Security Certificate",
      deadline: d2.toISOString(),
      estimatedEffort: 2, // 2 hours effort with 18 hours left (16h buffer) - High Pressure/Warning line
      completed: false,
      category: "Work",
      notes: "Use organizational credit card. Keep the approval code in Slack.",
      resourceLink: "https://godaddy.com/domains",
      createdAt: new Date(Date.now() - 4.2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "seed-3",
      title: "Prepare Slide Deck for Weekly Standup",
      deadline: d3.toISOString(),
      estimatedEffort: 1.5,
      completed: false,
      category: "Work",
      notes: "Need key statistics for Q2 growth rate. Keep slides under 8 pages.",
      createdAt: new Date().toISOString(),
    },
    {
      id: "seed-4",
      title: "Book Flight Tickets for Tech Summit",
      deadline: d4.toISOString(),
      estimatedEffort: 0.5,
      completed: true,
      category: "Other",
      notes: "Delta Airlines preferred. Confirm budget before checkout.",
      createdAt: new Date().toISOString(),
    },
  ];
};

const getInitialDemoTasks = (curNow: Date): Task[] => {
  const d1 = new Date(curNow);
  d1.setMinutes(d1.getMinutes() + 150); // 2.5 hours from now

  const d2 = new Date(curNow);
  d2.setHours(d2.getHours() + 14); // 14 hours from now

  const d3 = new Date(curNow);
  d3.setHours(d3.getHours() - 3); // 3 hours overdue

  const d4 = new Date(curNow);
  d4.setHours(d4.getHours() + 32); // 32 hours from now

  const d5 = new Date(curNow);
  d5.setDate(d5.getDate() + 4);
  d5.setHours(d5.getHours() + 12); // 4.5 days from now

  const d6 = new Date(curNow);
  d6.setDate(d6.getDate() - 1); // 1 day overdue (completed yesterday)

  return [
    {
      id: "demo-1",
      title: "CS106B Final Project: ThreadSafe Queue Submission",
      deadline: d1.toISOString(),
      estimatedEffort: 4.5,
      completed: false,
      category: "School",
      notes: "Must upload source code zip file. Complete the stress test with 100 concurrent workers. Ensure no memory leaks are present.",
      resourceLink: "https://web.stanford.edu/class/cs106b",
      createdAt: new Date(curNow.getTime() - 3.8 * 24 * 60 * 60 * 1000).toISOString(),
      aiAnalysis: {
        breakdown: [
          "Identify the race condition in the enqueue/dequeue critical section (30 mins)",
          "Implement fine-grained locking or conditional variables (45 mins)",
          "Run the stress-test suite with 100 concurrent threads (30 mins)",
          "Package files, write the brief design README, and upload (25 mins)"
        ],
        recommendedNextAction: "Run the lock tester script immediately to locate the deadlock line.",
        suggestedStartTime: "Immediate start required (15 minutes ago)",
        riskLevel: "High",
        productivityAdvice: "Turn off all notifications, isolate your workspace, and work in 45-minute sprint blocks without looking at social media."
      }
    },
    {
      id: "demo-2",
      title: "Deliver Quarterly Budget Forecast Slides to VP",
      deadline: d2.toISOString(),
      estimatedEffort: 6.0,
      completed: false,
      category: "Work",
      notes: "Include the Q3 revenue metrics. Ensure the cost-reduction options are detailed on slide 5. Check calculations with Sarah before presenting.",
      resourceLink: "https://docs.google.com/presentation/d/budget-slides",
      createdAt: new Date(curNow.getTime() - 2.5 * 24 * 60 * 60 * 1000).toISOString(),
      aiAnalysis: {
        breakdown: [
          "Consolidate Q1 and Q2 actual spend figures from Sarah's spreadsheet (1.5 hours)",
          "Build the forecast formulas for revenue lines and cost lines in Excel (1.5 hours)",
          "Design the summary visual charts for the slides (1 hour)",
          "Draft slide commentary and practice the talk track (1 hour)"
        ],
        recommendedNextAction: "Ping Sarah to confirm she finalized her department's spend metrics.",
        suggestedStartTime: "Start within the next 2 hours",
        riskLevel: "High",
        productivityAdvice: "Keep slide formatting simple. Do not waste time making perfect transitions; prioritize data accuracy and executive-level summaries."
      }
    },
    {
      id: "demo-3",
      title: "Fix Production OAuth Login Timeout Error",
      deadline: d3.toISOString(),
      estimatedEffort: 1.5,
      completed: false,
      category: "Work",
      notes: "Users are reporting 504 Gateway errors when signing in via Google Auth. Check container logs in Google Cloud Console.",
      resourceLink: "https://console.cloud.google.com/logs/oauth",
      createdAt: new Date(curNow.getTime() - 1.8 * 24 * 60 * 60 * 1000).toISOString(),
      aiAnalysis: {
        breakdown: [
          "Check proxy configurations and token validation endpoint response times (30 mins)",
          "Verify client ID secret matches environment values (15 mins)",
          "Deploy a lightweight restart of the auth microservice (20 mins)"
        ],
        recommendedNextAction: "Open Google Cloud Logs console and filter by 504 response codes.",
        suggestedStartTime: "Overdue - Start Immediately",
        riskLevel: "High",
        productivityAdvice: "Treat this as a live incident. Post an update in the Slack status channel first to notify stakeholders."
      }
    },
    {
      id: "demo-4",
      title: "Finalize Lease Agreement Signatures & Security Deposit",
      deadline: d4.toISOString(),
      estimatedEffort: 4.0,
      completed: false,
      category: "Personal",
      notes: "Review lease clauses on pet policy and subletting. Send wire transfer confirmation copy to landlord.",
      createdAt: new Date().toISOString(),
      aiAnalysis: {
        breakdown: [
          "Read the full PDF lease agreement thoroughly, noting any questionable fees (1.5 hours)",
          "Initiate the security deposit ACH wire transfer from banking portal (30 mins)",
          "Electronically sign the DocuSign agreement (15 mins)",
          "Email the signed document and wire confirmation to the agent (30 mins)"
        ],
        recommendedNextAction: "Login to tenant portal to double-check routing numbers for wire transfer.",
        suggestedStartTime: "Start early tomorrow morning",
        riskLevel: "Medium",
        productivityAdvice: "Do not rush lease agreements. Highlight any discrepancies or hidden utility clauses before signing."
      }
    },
    {
      id: "demo-5",
      title: "Schedule Dentist Checkup & Submit Claim",
      deadline: d5.toISOString(),
      estimatedEffort: 2.0,
      completed: false,
      category: "Personal",
      notes: "Need to schedule a routine cleaning. Submit claim for the custom mouthguard from last month.",
      createdAt: new Date().toISOString(),
      aiAnalysis: {
        breakdown: [
          "Call local family dental clinic to check appointment openings (20 mins)",
          "Log in to MetLife portal and fill out the dental claim form (40 mins)",
          "Upload PDF receipt of the mouthguard and submit (15 mins)"
        ],
        recommendedNextAction: "Locate the MetLife dental insurance ID card in your wallet.",
        suggestedStartTime: "Start anytime this week",
        riskLevel: "Low",
        productivityAdvice: "Perfect task to do in between high-stress work. It requires low mental energy and can clear easily."
      }
    },
    {
      id: "demo-6",
      title: "Assemble Standing Desk & Route Monitor Cables",
      deadline: d6.toISOString(),
      estimatedEffort: 3.0,
      completed: true,
      category: "Other",
      notes: "Make sure dual-monitor mounts are tightly clamped. Route power strips underneath using velcro straps.",
      createdAt: new Date().toISOString(),
    }
  ];
};

const LOCAL_STORAGE_KEY = "last_minute_life_saver_tasks_v1";

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filterType, setFilterType] = useState<"all" | "upcoming" | "overdue" | "panic" | "completed">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"deadline" | "urgency" | "effort" | "created" | "intelligent-queue">("deadline");
  const [appliedQueueIds, setAppliedQueueIds] = useState<string[]>([]);
  const [panicModeActive, setPanicModeActive] = useState(false);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  
  // Isolated Workspace State & Bulk Selection State
  const [isDemoWorkspaceActive, setIsDemoWorkspaceActive] = useState(false);
  const [demoTasks, setDemoTasks] = useState<Task[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // High accuracy ticking clock to keep countdowns accurate
  const [now, setNow] = useState<Date>(new Date());
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);
  const [brieflyHighlightedTaskId, setBrieflyHighlightedTaskId] = useState<string | null>(null);
  const [pulseAllPanic, setPulseAllPanic] = useState(false);
  const [toasts, setToasts] = useState<{ id: string; message: string; taskTitle?: string }[]>([]);

  // Hyper Focus Mode State
  const [activeFocusTaskId, setActiveFocusTaskId] = useState<string | null>(null);
  const [isFocusMinimized, setIsFocusMinimized] = useState<boolean>(false);
  const [focusFromPanic, setFocusFromPanic] = useState<boolean>(false);
  const [focusTimeRemaining, setFocusTimeRemaining] = useState<number>(45 * 60);
  const [focusSessionDuration, setFocusSessionDuration] = useState<number>(45 * 60);
  const [isFocusPaused, setIsFocusPaused] = useState<boolean>(false);
  const [showFocusModal, setShowFocusModal] = useState<boolean>(false);
  const [focusModalTaskId, setFocusModalTaskId] = useState<string | null>(null);
  const [showFocusCompleteDialog, setShowFocusCompleteDialog] = useState<boolean>(false);
  const [showFocusContinueOffer, setShowFocusContinueOffer] = useState<boolean>(false);
  const [showSuccessCelebration, setShowSuccessCelebration] = useState<boolean>(false);
  const [focusSetupOption, setFocusSetupOption] = useState<"recommended" | "custom" | "skip">("recommended");
  const [focusSetupCustomDuration, setFocusSetupCustomDuration] = useState<number>(25);
  const [activePlanSessionNumber, setActivePlanSessionNumber] = useState<number | null>(null);
  const [isFocusBreakActive, setIsFocusBreakActive] = useState<boolean>(false);
  const [isEditingModalPlan, setIsEditingModalPlan] = useState<boolean>(false);
  const [modalEditedSessions, setModalEditedSessions] = useState<any[]>([]);
  const [isFocusPlanPanelExpanded, setIsFocusPlanPanelExpanded] = useState<boolean>(true);
  const [isUpcomingSessionsExpanded, setIsUpcomingSessionsExpanded] = useState<boolean>(false);
  const [showCompleteEarlyConfirm, setShowCompleteEarlyConfirm] = useState<boolean>(false);
  const [showBreakOfferDialog, setShowBreakOfferDialog] = useState<boolean>(false);
  const [showNextSessionPrepareDialog, setShowNextSessionPrepareDialog] = useState<boolean>(false);
  const [showReturnToDashboardConfirm, setShowReturnToDashboardConfirm] = useState<boolean>(false);
  const [isEditingPrepareSession, setIsEditingPrepareSession] = useState<boolean>(false);
  const [prepareSessionTask, setPrepareSessionTask] = useState<string>("");
  const [prepareSessionGoal, setPrepareSessionGoal] = useState<string>("");
  const [prepareSessionDuration, setPrepareSessionDuration] = useState<string>("25 minutes");
  const [editingFocusSessionNumber, setEditingFocusSessionNumber] = useState<number | null>(null);
  const [editedFocusSessionTask, setEditedFocusSessionTask] = useState<string>("");
  const [editedFocusSessionGoal, setEditedFocusSessionGoal] = useState<string>("");
  const [editedFocusSessionDuration, setEditedFocusSessionDuration] = useState<string>("");
  const [editedFocusSessionBreak, setEditedFocusSessionBreak] = useState<string>("");

  // Computed active task collection
  const currentTasks = isDemoWorkspaceActive ? demoTasks : tasks;

  const addToast = (message: string, taskTitle?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, taskTitle }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const handleFocusTask = (id: string) => {
    const taskObj = currentTasks.find(t => t.id === id);
    if (!taskObj) return;

    // Reset filters and search so the targeted task is guaranteed to be visible in the DOM
    if (taskObj.completed) {
      setFilterType("completed");
    } else {
      setFilterType("all");
    }
    
    // Clear search keyword
    setSearchTerm("");

    // Set highlighted state
    setHighlightedTaskId(id);

    // Smooth scroll directly to card element with proper delay for layout calculation
    setTimeout(() => {
      const el = document.getElementById(`task-card-${id}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 150);

    // Clean highlight style indicator after a comfortable absorption duration
    setTimeout(() => {
      setHighlightedTaskId(prev => prev === id ? null : prev);
    }, 6000);
  };

  // Load initially
  useEffect(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      try {
        const loadedTasks = JSON.parse(saved);
        setTasks(computeStoredRiskForTasks(loadedTasks, new Date()));
      } catch (e) {
        setTasks(computeStoredRiskForTasks(SEED_TASKS(), new Date()));
      }
    } else {
      setTasks(computeStoredRiskForTasks(SEED_TASKS(), new Date()));
    }
  }, []);

  // Sync to local storage or demo state
  const saveTasks = (newTasks: Task[]) => {
    if (isDemoWorkspaceActive) {
      setDemoTasks(newTasks);
    } else {
      setTasks(newTasks);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newTasks));
    }
  };

  // Run dynamic ticker every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Countdown Timer for Hyper Focus Mode
  useEffect(() => {
    let interval: any = null;
    if (activeFocusTaskId && !isFocusPaused && focusTimeRemaining > 0) {
      interval = setInterval(() => {
        setFocusTimeRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            handleFocusTimerExpiry();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeFocusTaskId, isFocusPaused, focusTimeRemaining]);

  // Automatically reset minimized state when focus session completes/ends
  useEffect(() => {
    if (!activeFocusTaskId) {
      setIsFocusMinimized(false);
      setFocusFromPanic(false);
    }
  }, [activeFocusTaskId]);

  // Refresh clock manually for immediate sync
  const handleForceRefreshClock = () => {
    setNow(new Date());
  };

  // Handle Operations
  const handleAddTask = (newTask: {
    title: string;
    deadline: string;
    estimatedEffort: number;
    category: CategoryType;
    notes: string;
    resourceLink?: string;
  }) => {
    const created: Task = {
      id: "task-" + Date.now().toString(),
      ...newTask,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    const updated = [created, ...currentTasks];
    saveTasks(computeStoredRiskForTasks(updated, new Date()));
    addToast("📝 Task added successfully!", created.title);
  };

  const handleUpdateTask = (updatedTask: Task) => {
    const updated = currentTasks.map((t) => (t.id === updatedTask.id ? updatedTask : t));
    saveTasks(computeStoredRiskForTasks(updated, new Date()));
  };

  const handleFocusTimerExpiry = () => {
    const taskObj = currentTasks.find((t) => t.id === activeFocusTaskId);
    if (!taskObj) {
      setShowFocusCompleteDialog(true);
      return;
    }

    if (taskObj.aiFocusPlan && activePlanSessionNumber !== null) {
      const { sessions, completedSessions = [] } = taskObj.aiFocusPlan;
      const currentSession = sessions.find(s => s.sessionNumber === activePlanSessionNumber);
      
      if (currentSession) {
        if (!isFocusBreakActive) {
          // Work period ended.
          const newCompletedSessions = Array.from(new Set([...completedSessions, activePlanSessionNumber]));
          const updatedTask: Task = {
            ...taskObj,
            aiFocusPlan: {
              ...taskObj.aiFocusPlan,
              completedSessions: newCompletedSessions,
            }
          };
          const updated = currentTasks.map((t) => (t.id === updatedTask.id ? updatedTask : t));
          saveTasks(computeStoredRiskForTasks(updated, new Date()));
          addToast(`🎉 Work session ${activePlanSessionNumber} complete!`, currentSession.goal);

          // Pause timer and offer break options to user
          setIsFocusPaused(true);
          setShowBreakOfferDialog(true);
        } else {
          // Break period ended.
          addToast(`🔔 Break ended! Let's prepare for your next session.`, `Rest Complete`);
          
          const nextSession = sessions.find(s => s.sessionNumber === activePlanSessionNumber + 1);
          if (nextSession) {
            // Automatically load the next session but paused
            setActivePlanSessionNumber(nextSession.sessionNumber);
            setIsFocusBreakActive(false);
            const nextMins = parseDurationMinutes(nextSession.duration);
            const nextSeconds = nextMins * 60;
            setFocusTimeRemaining(nextSeconds);
            setFocusSessionDuration(nextSeconds);
            setIsFocusPaused(true); // Keep it paused for review/prep
            
            // Populate prep states
            setPrepareSessionTask(nextSession.task || "");
            setPrepareSessionGoal(nextSession.goal || "");
            setPrepareSessionDuration(nextSession.duration || "25 minutes");
            setIsEditingPrepareSession(false);
            
            setShowNextSessionPrepareDialog(true);
          } else {
            // No next session! Focus plan complete.
            setActivePlanSessionNumber(null);
            setIsFocusBreakActive(false);
            setShowFocusCompleteDialog(true);
          }
        }
      } else {
        setShowFocusCompleteDialog(true);
      }
    } else {
      setShowFocusCompleteDialog(true);
    }
  };

  const handleSaveEditedFocusSession = () => {
    if (editingFocusSessionNumber === null) return;
    
    const activeTask = currentTasks.find(t => t.id === activeFocusTaskId);
    if (!activeTask) return;
    
    const plan = activeTask.aiFocusPlan || generateLocalDefaultFocusPlan(activeTask);
    
    // Update the edited session in the plan
    const updatedSessions = plan.sessions.map(s => {
      if (s.sessionNumber === editingFocusSessionNumber) {
        return {
          ...s,
          task: editedFocusSessionTask,
          goal: editedFocusSessionGoal,
          duration: editedFocusSessionDuration,
          breakDuration: editedFocusSessionBreak,
        };
      }
      return s;
    });

    const updatedTask: Task = {
      ...activeTask,
      aiFocusPlan: {
        ...plan,
        sessions: updatedSessions,
      }
    };

    const updated = currentTasks.map((t) => (t.id === updatedTask.id ? updatedTask : t));
    saveTasks(computeStoredRiskForTasks(updated, new Date()));

    // If we just edited the CURRENT active session, update the active timer values as well!
    if (editingFocusSessionNumber === activePlanSessionNumber) {
      const nextMins = parseDurationMinutes(editedFocusSessionDuration);
      const nextSeconds = nextMins * 60;
      setFocusTimeRemaining(nextSeconds);
      setFocusSessionDuration(nextSeconds);
    }

    setEditingFocusSessionNumber(null);
    addToast("✓ Plan Updated Successfully", activeTask.title);
  };

  const handleToggleComplete = (id: string) => {
    const taskObj = currentTasks.find((t) => t.id === id);
    const updated = currentTasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t));
    saveTasks(computeStoredRiskForTasks(updated, new Date()));

    if (taskObj && !taskObj.completed) {
      const ENCOURAGING_MESSAGES = [
        "Great work! One less deadline to worry about.",
        "Task completed successfully.",
        "Fantastic job! You're breaking through the backlog.",
        "That's how it's done! Focus power unlocked.",
        "One more hurdle cleared. Keep this momentum going!"
      ];
      const randomMsg = ENCOURAGING_MESSAGES[Math.floor(Math.random() * ENCOURAGING_MESSAGES.length)];
      addToast(randomMsg, taskObj.title);
    }
  };

  const handleDeleteTask = (id: string) => {
    const updated = currentTasks.filter((t) => t.id !== id);
    saveTasks(computeStoredRiskForTasks(updated, new Date()));
    setSelectedTaskIds((prev) => prev.filter((tid) => tid !== id));
    addToast("🗑️ Task deleted successfully.");
  };

  const handleClearAllTasks = () => {
    setShowClearAllConfirm(true);
  };

  // Demo Workspace Handlers
  const handleEnterDemoWorkspace = () => {
    setIsDemoWorkspaceActive(true);
    setSelectedTaskIds([]); // Clear selections when changing workspaces
    if (demoTasks.length === 0) {
      const curNow = new Date();
      const list = getInitialDemoTasks(curNow);
      setDemoTasks(computeStoredRiskForTasks(list, curNow));
    }
    addToast("🎭 Entered Demo Workspace. Your real tasks are safely hidden.", "Demo Mode");
  };

  const handleExitDemoWorkspace = () => {
    setIsDemoWorkspaceActive(false);
    setSelectedTaskIds([]); // Clear selections when changing workspaces
    addToast("🏠 Returned to your personal workspace.", "My Tasks");
  };

  const handleResetDemoWorkspace = () => {
    const curNow = new Date();
    const list = getInitialDemoTasks(curNow);
    setDemoTasks(computeStoredRiskForTasks(list, curNow));
    setSelectedTaskIds([]);
    addToast("🔄 Demo data has been restored to default.", "Demo Mode");
  };

  // Bulk Selection Handlers
  const handleSelectAll = () => {
    const visibleIds = sortedTasks.map((t) => t.id);
    setSelectedTaskIds(visibleIds);
  };

  const handleClearSelection = () => {
    setSelectedTaskIds([]);
  };

  const handleToggleSelectTask = (id: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(id) ? prev.filter((tid) => tid !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = () => {
    if (selectedTaskIds.length === 0) return;
    setShowBulkDeleteConfirm(true);
  };

  const handleConfirmBulkDelete = () => {
    const updated = currentTasks.filter((t) => !selectedTaskIds.includes(t.id));
    saveTasks(computeStoredRiskForTasks(updated, new Date()));
    addToast(`🗑️ Successfully deleted ${selectedTaskIds.length} tasks.`, "Bulk Action");
    setSelectedTaskIds([]);
    setShowBulkDeleteConfirm(false);
  };

  const handleUrgentTaskCountClick = () => {
    setFilterType("panic");
    setSearchTerm("");
    setPulseAllPanic(true);

    // Fade out pulse highlight after 4 seconds
    setTimeout(() => {
      setPulseAllPanic(false);
    }, 4000);

    // Smooth scroll down to tasks grid/list wrapper
    setTimeout(() => {
      const el = document.getElementById("tasks-grid-list") || document.getElementById("app-main-content");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 80);
  };

  const handleSelectCategoryFilter = (catType: "all" | CategoryType) => {
    // optional categorization filtering can be integrated smoothly
  };

  const handleApplyQueue = (taskIds: string[]) => {
    setAppliedQueueIds(taskIds);
    setSortBy("intelligent-queue");

    // Reset filters and search so the targeted first task is guaranteed to be visible in the DOM
    setFilterType("all");
    setSearchTerm("");

    // Highlight the first recommended task with a soft glow for exactly 3 seconds
    if (taskIds && taskIds.length > 0) {
      const firstId = taskIds[0];
      setBrieflyHighlightedTaskId(firstId);
      
      setTimeout(() => {
        setBrieflyHighlightedTaskId((prev) => (prev === firstId ? null : prev));
      }, 3000);

      // Smoothly scroll to the first recommended task card
      setTimeout(() => {
        const el = document.getElementById(`task-card-${firstId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 150);
    }
  };

  const handleResetQueue = () => {
    setAppliedQueueIds([]);
    if (sortBy === "intelligent-queue") {
      setSortBy("deadline");
    }
  };

  const handleStartWorkingTask = (id: string) => {
    const taskObj = currentTasks.find((t) => t.id === id);
    if (!taskObj) return;

    // Stay on current dashboard and trigger the setup dialog
    handleOpenFocusSetup(id);
  };

  const handleOpenFocusSetup = (id: string) => {
    if (activeFocusTaskId) {
      setIsFocusMinimized(false);
      setShowFocusModal(false);
      setFocusModalTaskId(null);
      return;
    }
    setFocusModalTaskId(id);
    setFocusSetupOption("recommended");
    setFocusSetupCustomDuration(25);
    setIsEditingModalPlan(false);
    setModalEditedSessions([]);
    setShowFocusModal(true);
  };

  const handleStartFocusSession = (id: string, durationSeconds: number = 45 * 60, customTask?: Task) => {
    const taskObj = customTask || currentTasks.find((t) => t.id === id);
    if (!taskObj) return;

    // Reset filters and search so the targeted task is guaranteed to be visible in the DOM
    if (taskObj.completed) {
      setFilterType("completed");
    } else {
      setFilterType("all");
    }
    setSearchTerm("");

    // Start focus session: check if the task is panic qualifying and enter Panic Mode if so
    const isCurrentlyPanic = panicModeActive || isTaskPanicQualifying(taskObj, now);
    if (isCurrentlyPanic && !panicModeActive) {
      setPanicModeActive(true);
    }
    setFocusFromPanic(isCurrentlyPanic);
    setIsFocusMinimized(false);

    // Ensure a Focus Plan exists (Check if an accepted Focus Plan exists)
    let finalTaskObj = taskObj;
    const hasPlan = taskObj.aiFocusPlan && taskObj.aiFocusPlan.sessions && taskObj.aiFocusPlan.sessions.length > 0;
    
    if (!hasPlan) {
      const defaultPlan = generateLocalDefaultFocusPlan(taskObj);
      const updatedTask = {
        ...taskObj,
        aiFocusPlan: defaultPlan
      };
      
      const updated = currentTasks.map((t) => (t.id === taskObj.id ? updatedTask : t));
      saveTasks(computeStoredRiskForTasks(updated, new Date()));
      finalTaskObj = updatedTask;
      addToast("⚡ Default Focus Plan Generated", `${defaultPlan.sessions.length}-session roadmap built using task effort.`);
    }

    // Set countdown timer and duration, then activate
    let finalDuration = durationSeconds;
    if (finalTaskObj.aiFocusPlan && finalTaskObj.aiFocusPlan.sessions && finalTaskObj.aiFocusPlan.sessions.length > 0) {
      const completedList = finalTaskObj.aiFocusPlan.completedSessions || [];
      const sessionToStart = finalTaskObj.aiFocusPlan.sessions.find(s => !completedList.includes(s.sessionNumber)) || finalTaskObj.aiFocusPlan.sessions[0];
      
      setActivePlanSessionNumber(sessionToStart.sessionNumber);
      setIsFocusBreakActive(false);
      const sessionMins = parseDurationMinutes(sessionToStart.duration);
      finalDuration = sessionMins * 60;
    } else {
      setActivePlanSessionNumber(null);
      setIsFocusBreakActive(false);
    }

    setFocusTimeRemaining(finalDuration);
    setFocusSessionDuration(finalDuration);
    setIsFocusPaused(false);
    setActiveFocusTaskId(id);
    
    // Ensure all dialog/setup states are fully cleared
    setShowFocusModal(false);
    setFocusModalTaskId(null);
    setShowFocusContinueOffer(false);

    // Set brieflyHighlightedTaskId for visual glow on start
    setBrieflyHighlightedTaskId(id);

    // Smooth scroll directly to the correct card element with proper delay for layout/render calculation
    setTimeout(() => {
      const isCurrentlyPanic = panicModeActive || isTaskPanicQualifying(taskObj, now);
      const cardId = isCurrentlyPanic ? `panic-task-card-${id}` : `task-card-${id}`;
      const el = document.getElementById(cardId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 150);

    // Keep the highlighted state for a few seconds
    setTimeout(() => {
      setBrieflyHighlightedTaskId((prev) => (prev === id ? null : prev));
    }, 5000);
  };

  const handleEndFocusSession = () => {
    // 1. Clear the active focus task and exit Hyper Focus Mode
    setActiveFocusTaskId(null);
    
    // 2. Stop and reset the timer values
    setFocusTimeRemaining(0);
    setFocusSessionDuration(0);
    setIsFocusPaused(false);
    setIsFocusBreakActive(false);
    setActivePlanSessionNumber(null);
    
    // 3. Clear minimized, panic-source, and editing states
    setIsFocusMinimized(false);
    setFocusFromPanic(false);
    setIsEditingModalPlan(false);
    setIsUpcomingSessionsExpanded(false);
    
    // 4. Hide all related dialogs / modals
    setShowFocusModal(false);
    setFocusModalTaskId(null);
    setShowFocusCompleteDialog(false);
    setShowFocusContinueOffer(false);
    setShowCompleteEarlyConfirm(false);
    setShowBreakOfferDialog(false);
    setShowNextSessionPrepareDialog(false);
    setShowReturnToDashboardConfirm(false);
    setIsEditingPrepareSession(false);
    setEditingFocusSessionNumber(null);
    
    // 5. Ensure panic mode is exited so the user returns to the Dashboard
    setPanicModeActive(false);
  };

  // Find critical tasks with deadlines under 24 hours / high pressure (for triggers and indicators)
  const criticalTasksCount = currentTasks.filter(t => isTaskPanicQualifying(t, now)).length;

  // Filter tasks
  const filteredTasks = currentTasks.filter((task) => {
    // Search keyword match
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    // Filter type categorizer
    if (filterType === "all") return true;
    if (filterType === "completed") return task.completed;
    
    // Active tasks only for remaining statuses
    if (task.completed) return false;

    const isOverdue = new Date(task.deadline).getTime() < now.getTime();
    if (filterType === "overdue") {
      return isOverdue;
    }
    if (filterType === "upcoming") {
      return true;
    }
    if (filterType === "panic") {
      return isTaskPanicQualifying(task, now);
    }

    return true;
  });

  // Sort tasks
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (sortBy === "intelligent-queue") {
      const idxA = appliedQueueIds.indexOf(a.id);
      const idxB = appliedQueueIds.indexOf(b.id);
      
      if (idxA !== -1 && idxB !== -1) {
        return idxA - idxB;
      }
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      
      // Fallback
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    }
    if (sortBy === "created") {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    if (sortBy === "effort") {
      return b.estimatedEffort - a.estimatedEffort;
    }
    if (sortBy === "deadline") {
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    }
    if (sortBy === "urgency") {
      const bAna = analyzeTaskDeadline(b, now);
      const aAna = analyzeTaskDeadline(a, now);
      
      // Order: overdue or panic first
      const statusWeight = (status: string) => {
        switch (status) {
          case "overdue": return 10;
          case "panic": return 9;
          case "high": return 8;
          case "medium": return 5;
          case "safe": return 1;
          case "completed": return 0;
          default: return 0;
        }
      };
      
      const weightDiff = statusWeight(bAna.status) - statusWeight(aAna.status);
      if (weightDiff !== 0) return weightDiff;
      
      // Secondary sort by buffer hours (smallest buffer first)
      return aAna.bufferHours - bAna.bufferHours;
    }
    return 0;
  });

  const renderFocusModal = () => {
    if (!showFocusModal || activeFocusTaskId) return null;
    const taskObj = currentTasks.find((t) => t.id === focusModalTaskId);
    if (!taskObj) return null;

    const plan = taskObj.aiFocusPlan || generateLocalDefaultFocusPlan(taskObj);
    const completedList = plan.completedSessions || [];
    const currentSession = plan.sessions.find(s => !completedList.includes(s.sessionNumber)) || plan.sessions[0];
    const totalSessions = plan.sessions.length;
    const currentSessionNum = currentSession ? currentSession.sessionNumber : 1;

    // Check if it's a fallback/local plan
    const isLocalPlan = !taskObj.aiFocusPlan || taskObj.aiFocusPlan.isDefaultLocal;

    const handleStartSessionAction = () => {
      // Ensure the plan is saved to the task if it doesn't already exist
      let finalTaskObj = taskObj;
      if (!taskObj.aiFocusPlan) {
        const defaultPlan = generateLocalDefaultFocusPlan(taskObj);
        const updatedTask = {
          ...taskObj,
          aiFocusPlan: defaultPlan
        };
        const updated = currentTasks.map((t) => (t.id === taskObj.id ? updatedTask : t));
        saveTasks(computeStoredRiskForTasks(updated, new Date()));
        finalTaskObj = updatedTask;
      }

      setShowFocusModal(false);
      setFocusModalTaskId(null);

      const activePlan = finalTaskObj.aiFocusPlan || plan;
      const activeCompletedList = activePlan.completedSessions || [];
      const sessionToStart = activePlan.sessions.find(s => !activeCompletedList.includes(s.sessionNumber)) || activePlan.sessions[0];

      if (sessionToStart) {
        const sessionMins = parseDurationMinutes(sessionToStart.duration);
        handleStartFocusSession(finalTaskObj.id, sessionMins * 60, finalTaskObj);
        addToast(`🚀 Starting Session ${sessionToStart.sessionNumber}: ${sessionToStart.task}`, sessionToStart.goal);
      } else {
        handleStartFocusSession(finalTaskObj.id, 25 * 60, finalTaskObj);
        addToast("🚀 Starting focus session: " + finalTaskObj.title, "25 Minutes Timer");
      }
    };

    const handleUpdateModalSessionField = (index: number, field: string, value: any) => {
      const updated = [...modalEditedSessions];
      updated[index] = {
        ...updated[index],
        [field]: value
      };
      setModalEditedSessions(updated);
    };

    const handleSaveModalPlan = () => {
      const updatedTask = {
        ...taskObj,
        aiFocusPlan: {
          ...plan,
          sessions: modalEditedSessions,
          isCustomized: true,
          isDefaultLocal: false, // It is now a customized plan
          lastUpdated: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
        }
      };
      const updated = currentTasks.map((t) => (t.id === taskObj.id ? updatedTask : t));
      saveTasks(computeStoredRiskForTasks(updated, new Date()));
      setIsEditingModalPlan(false);
      addToast("✍️ Focus Plan Customized & Saved", taskObj.title);
    };

    const startEditingModalPlan = () => {
      setModalEditedSessions(JSON.parse(JSON.stringify(plan.sessions)));
      setIsEditingModalPlan(true);
    };

    return (
      <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4 z-55 animate-fadeIn animate-duration-200" id="focus-initiation-modal">
        <div className="bg-white border border-slate-150 rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl text-left space-y-6 overflow-hidden relative">
          
          {/* Background elegant gradient glow */}
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>

          {/* Header with Title and Icon */}
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl text-indigo-600 shadow-3xs">
              <Target className="w-5.5 h-5.5 shrink-0 animate-pulse" />
            </div>
            <div>
              <h3 className="font-display font-black text-lg text-slate-900 tracking-tight leading-none">
                {isEditingModalPlan ? "Edit Focus Plan" : "Hyper Focus Setup"}
              </h3>
              <p className="text-[11px] font-medium text-slate-500 mt-1">
                {isEditingModalPlan 
                  ? "Customize session goals, titles, and intervals." 
                  : "Designate your session settings before launching flow state."}
              </p>
            </div>
          </div>
          
          {/* Task Details Display */}
          <div className="bg-slate-50/70 border border-slate-150/85 rounded-2xl p-4.5 space-y-1.5 shadow-3xs">
            <span className="text-[10px] font-extrabold font-mono text-slate-400 uppercase tracking-widest block leading-none">
              TARGET TASK
            </span>
            <span className="text-sm font-black text-slate-800 leading-snug block">
              {taskObj.title}
            </span>
          </div>

          {isEditingModalPlan ? (
            /* Editing Focus Plan State */
            <div className="space-y-4">
              <span className="text-[10px] font-extrabold font-mono text-slate-400 uppercase tracking-widest block leading-none">
                EDIT SESSION SEQUENCES
              </span>

              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                {modalEditedSessions.map((session, idx) => (
                  <div key={idx} className="p-3.5 rounded-2xl border border-indigo-100 bg-slate-50/50 text-left space-y-3 shadow-3xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-[11px] font-mono font-black text-indigo-600 uppercase tracking-wide">
                        Session {session.sessionNumber} Settings
                      </span>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold font-mono text-slate-400 uppercase tracking-wider block">
                        Session Title / Task
                      </label>
                      <input
                        type="text"
                        value={session.task}
                        onChange={(e) => handleUpdateModalSessionField(idx, "task", e.target.value)}
                        className="w-full px-3 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 shadow-3xs"
                        placeholder="e.g. Setting up development workspace"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold font-mono text-slate-400 uppercase tracking-wider block">
                        Goal
                      </label>
                      <textarea
                        value={session.goal}
                        onChange={(e) => handleUpdateModalSessionField(idx, "goal", e.target.value)}
                        className="w-full px-3 py-2 text-xs text-slate-700 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 shadow-3xs h-16 resize-none leading-relaxed"
                        placeholder="Describe the target outcome of this session block"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-extrabold font-mono text-slate-400 uppercase tracking-wider block">
                          Work Duration
                        </label>
                        <select
                          value={session.duration}
                          onChange={(e) => handleUpdateModalSessionField(idx, "duration", e.target.value)}
                          className="w-full px-3 py-2 text-xs font-mono font-bold text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-3xs"
                        >
                          {["15 minutes", "20 minutes", "25 minutes", "30 minutes", "45 minutes", "50 minutes", "60 minutes", "90 minutes"].map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-extrabold font-mono text-slate-400 uppercase tracking-wider block">
                          Break Duration
                        </label>
                        <select
                          value={session.breakDuration}
                          onChange={(e) => handleUpdateModalSessionField(idx, "breakDuration", e.target.value)}
                          className="w-full px-3 py-2 text-xs font-mono font-bold text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-3xs"
                        >
                          {["3 minutes", "5 minutes", "10 minutes", "15 minutes", "20 minutes"].map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Setup / Current Focus Plan Display State */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black font-mono text-indigo-600 uppercase tracking-widest">
                  {isLocalPlan ? "Using Local Focus Plan" : "Current Focus Plan"}
                </span>
                <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                  Session {currentSessionNum} of {totalSessions}
                </span>
              </div>

              {isLocalPlan && (
                <p className="text-[11px] text-slate-500 bg-amber-50 border border-amber-100/50 p-2.5 rounded-xl leading-normal">
                  💡 No AI plan was generated yet. A local fallback plan based on your task's estimated effort has been loaded.
                </p>
              )}

              <div className="bg-slate-50/80 border border-slate-150 rounded-2xl p-4.5 space-y-3.5 shadow-3xs">
                <div>
                  <span className="text-[10px] font-extrabold font-mono text-slate-400 uppercase tracking-widest block leading-none mb-1">
                    Task
                  </span>
                  <span className="text-sm font-bold text-slate-800 block">
                    {currentSession.task}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-extrabold font-mono text-slate-400 uppercase tracking-widest block leading-none mb-1">
                    Goal
                  </span>
                  <span className="text-xs text-slate-600 block leading-relaxed">
                    {currentSession.goal}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3.5 pt-2 border-t border-slate-100">
                  <div>
                    <span className="text-[10px] font-extrabold font-mono text-slate-400 uppercase tracking-widest block leading-none mb-1.5">
                      Recommended Duration
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-mono font-extrabold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">
                      <Clock className="w-3.5 h-3.5 text-indigo-500" />
                      {currentSession.duration}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-extrabold font-mono text-slate-400 uppercase tracking-widest block leading-none mb-1.5">
                      Break Duration
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-mono font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                      <Coffee className="w-3.5 h-3.5 text-emerald-500" />
                      {currentSession.breakDuration}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            {isEditingModalPlan ? (
              /* Buttons in Edit Mode */
              <>
                <button
                  type="button"
                  onClick={() => setIsEditingModalPlan(false)}
                  className="px-4.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer hover:shadow-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveModalPlan}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 cursor-pointer active:scale-97 flex items-center gap-2 font-sans"
                >
                  <Check className="w-3.5 h-3.5 text-indigo-100" />
                  <span>Save Focus Plan</span>
                </button>
              </>
            ) : (
              /* Buttons in Setup Mode */
              <>
                <button
                  type="button"
                  onClick={() => {
                    setShowFocusModal(false);
                    setFocusModalTaskId(null);
                  }}
                  className="px-4.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer hover:shadow-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={startEditingModalPlan}
                  className="px-4.5 py-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Plan</span>
                </button>
                <button
                  type="button"
                  onClick={handleStartSessionAction}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 cursor-pointer active:scale-97 flex items-center gap-2 font-sans"
                >
                  <Target className="w-3.5 h-3.5 text-indigo-100" />
                  <span>Start Session</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (panicModeActive) {
    return (
      <>
        <PanicMode
          tasks={currentTasks}
          now={now}
          onToggleComplete={handleToggleComplete}
          onDeleteTask={handleDeleteTask}
          onExit={() => setPanicModeActive(false)}
          activeFocusTaskId={activeFocusTaskId}
          focusTimeRemaining={focusTimeRemaining}
          isFocusPaused={isFocusPaused}
          focusSessionDuration={focusSessionDuration}
          onStartFocusSession={handleOpenFocusSetup}
          onToggleFocusPause={() => setIsFocusPaused(!isFocusPaused)}
          onEndFocusSession={() => {
            setShowReturnToDashboardConfirm(true);
          }}
          onMinimizeFocus={() => {
            setIsFocusMinimized(true);
            setFocusFromPanic(true);
            setPanicModeActive(false);
            addToast("📌 Focus session minimized to background.");
          }}
        />
        {renderFocusModal()}

        {/* Return to Dashboard Confirmation Dialog */}
        {showReturnToDashboardConfirm && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-55 animate-fadeIn animate-duration-200" id="return-to-dashboard-confirm-modal-panic">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-left space-y-4">
              <div className="flex items-center gap-3 text-indigo-650">
                <div className="p-2.5 bg-indigo-50 rounded-xl">
                  <Target className="w-5 h-5 shrink-0" />
                </div>
                <h3 className="font-display font-black text-base text-slate-900">
                  Return to Dashboard
                </h3>
              </div>
              
              <p className="text-xs text-slate-500 leading-relaxed font-sans">
                Are you sure you want to pause or end your focus session and return to the main dashboard? Your progress will be saved.
              </p>
              
              <div className="flex items-center justify-end gap-2 pt-1 font-sans">
                <button
                  onClick={() => setShowReturnToDashboardConfirm(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Continue Working
                </button>
                <button
                  onClick={() => {
                    handleEndFocusSession();
                    addToast("⏹ Focus session ended early.");
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 cursor-pointer active:scale-97"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Satisfying Toast Notifications */}
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none px-4 sm:px-0">
          <AnimatePresence>
            {toasts.map((toast) => (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: 30, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2 } }}
                className="bg-slate-900 border border-slate-800 text-white p-4 rounded-2xl shadow-2xl flex items-start gap-3 pointer-events-auto select-none text-left"
              >
                <div className="shrink-0 p-1.5 bg-emerald-500/15 rounded-xl text-emerald-400 mt-0.5">
                  <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-slate-400 font-mono uppercase tracking-wider">
                    Success Checklist
                  </h4>
                  <p className="text-sm font-sans font-black text-white mt-1 leading-snug">
                    {toast.message}
                  </p>
                  {toast.taskTitle && (
                    <p className="text-[11px] font-mono text-emerald-300 mt-1.5 line-clamp-1 bg-emerald-950/45 px-2 py-0.5 rounded border border-emerald-900/30 inline-block max-w-full">
                      Completed: {toast.taskTitle}
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased font-sans flex flex-col" id="app-root">
      
      {/* Top Main Navigation Header Banner */}
      <header className="bg-slate-900 text-white border-b border-slate-950 pb-5 pt-5 shrink-0" id="app-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-rose-600 rounded-lg text-white font-mono flex items-center justify-center animate-pulse shadow-md shadow-rose-900/30">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <h1 className="text-xl md:text-2xl font-display font-extrabold tracking-tight">
                  Last Minute Life Saver
                </h1>
                <span className="bg-rose-500/10 text-rose-600 border border-rose-500/15 text-[10px] font-bold font-mono px-2 py-0.5 rounded-full select-none">
                  V1.0 LIVE
                </span>
              </div>
              <p className="text-xs text-slate-500 max-w-lg leading-relaxed">
                Calculate real-time stress buffers & time-estimation gaps to proactively conquer task crunches before they conquer you.
              </p>
            </div>

            {/* Header Interactive clocks */}
            <div className="flex flex-wrap items-center gap-2.5 sm:self-center bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
              {isDemoWorkspaceActive ? (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold font-mono tracking-wider bg-amber-500/20 border border-amber-500/30 text-amber-300 select-none animate-pulse">
                  <span>🎭 DEMO WORKSPACE ACTIVE</span>
                </span>
              ) : (
                <button
                  onClick={handleEnterDemoWorkspace}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold font-mono tracking-wider bg-indigo-650 hover:bg-indigo-600 border border-indigo-700 text-white hover:scale-[1.02] active:scale-98 transition-all cursor-pointer shadow-md shadow-indigo-950/20"
                  title="Explore the application with rich sample data without touching your real tasks"
                >
                  <span>🎭 EXPLORE DEMO WORKSPACE</span>
                </button>
              )}

              <div className="h-4 w-px bg-slate-700 mx-0.5"></div>

              <button
                onClick={() => setPanicModeActive(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold font-mono tracking-wider cursor-pointer border transition-all ${
                  criticalTasksCount > 0
                    ? "bg-red-600 border-red-700 hover:bg-red-500 text-white animate-pulse"
                    : "bg-slate-800 border-slate-700 hover:border-slate-600 hover:bg-slate-700 text-slate-400 hover:text-white"
                }`}
                title="Launch hyper-focused Panic Mode Dashboard"
              >
                <Flame className={`w-3.5 h-3.5 ${criticalTasksCount > 0 ? "fill-white animate-bounce" : ""}`} />
                <span>PANIC MODE</span>
              </button>

              <div className="h-4 w-px bg-slate-700 mx-0.5"></div>

              <div className="text-left">
                <span className="text-[9px] font-bold text-slate-500 font-mono block uppercase">Dynamic Ref Clock</span>
                <span className="text-xs font-mono font-medium text-slate-350">
                  {now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              </div>
              <button
                onClick={handleForceRefreshClock}
                className="p-1 px-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer"
                title="Force refresh calculations"
              >
                <RefreshCw className="w-4 h-4 hover:rotate-45 transition-transform" />
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* Main Core View Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6" id="app-main-content">
        
        {/* Urgent Panic Mode Banner Alert */}
        {criticalTasksCount > 0 && (
          <div className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-200/80 p-4.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-pulse-slow">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-red-600 rounded-xl text-white shadow-md shadow-red-500/10">
                <Flame className="w-5 h-5 fill-white" />
              </div>
              <div className="text-left">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 font-mono uppercase tracking-wide">
                  🔥 PANIC MODE PRE-ACTIVATED
                </h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  You have{" "}
                  <button
                    onClick={handleUrgentTaskCountClick}
                    className="font-bold underline text-red-600 hover:text-red-800 cursor-pointer inline-block text-left transition-colors font-sans focus:outline-hidden"
                    title="Click to view and highlight these urgent tasks"
                  >
                    {criticalTasksCount} active task(s)
                  </button>{" "}
                  with deadlines less than 24 hours away.
                </p>
              </div>
            </div>
            
            <button
              onClick={() => setPanicModeActive(true)}
              className="w-full sm:w-auto shrink-0 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold tracking-wider transition-all shadow-md shadow-red-500/10 hover:shadow-lg hover:scale-[1.01] cursor-pointer uppercase font-mono"
            >
              LAUNCH HYPER-FOCUS ➔
            </button>
          </div>
        )}

        {/* Isolated Demo Workspace Banner */}
        {isDemoWorkspaceActive && (
          <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/15 to-amber-500/10 border border-amber-500/20 p-4 rounded-2xl text-amber-900 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4 animate-fadeIn">
            <div className="flex items-center gap-3 text-left">
              <span className="text-2xl">🎭</span>
              <div>
                <h3 className="text-xs font-bold font-mono tracking-wider text-amber-800 uppercase">
                  EXPLORING DEMO WORKSPACE
                </h3>
                <p className="text-xs text-amber-700 font-medium mt-0.5">
                  You are currently in an isolated, safe demo space. Any modifications here will not affect your real workspace tasks.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto shrink-0">
              <button
                onClick={handleResetDemoWorkspace}
                className="flex-1 md:flex-none px-3.5 py-2 bg-white/90 hover:bg-white text-amber-900 border border-amber-200 rounded-xl text-xs font-bold transition-all cursor-pointer hover:scale-[1.01] active:scale-99"
                title="Restore all demo tasks to their original initial state"
              >
                Reset Demo Data
              </button>
              <button
                onClick={handleExitDemoWorkspace}
                className="flex-1 md:flex-none px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black transition-all shadow-sm hover:shadow-md cursor-pointer hover:scale-[1.01] active:scale-99"
              >
                Return to My Tasks ➔
              </button>
            </div>
          </div>
        )}

        {/* Hyper Focus Active Session Banner */}
        {activeFocusTaskId && !isFocusMinimized && (() => {
            const activeTask = currentTasks.find(t => t.id === activeFocusTaskId);
            if (!activeTask) return null;
            
            const minutes = Math.floor(focusTimeRemaining / 60);
            const seconds = focusTimeRemaining % 60;
            const progressPercent = (focusTimeRemaining / focusSessionDuration) * 100;

            const isPlanActive = activeTask.aiFocusPlan && activePlanSessionNumber !== null;
            const currentSessionObj = isPlanActive 
              ? activeTask.aiFocusPlan.sessions.find(s => s.sessionNumber === activePlanSessionNumber)
              : null;
            
            const plan = activeTask.aiFocusPlan || generateLocalDefaultFocusPlan(activeTask);
            const completedList = plan.completedSessions || [];
            const activeSessionNum = activePlanSessionNumber !== null ? activePlanSessionNumber : 1;
            const currentSession = plan.sessions.find(s => s.sessionNumber === activeSessionNum) || plan.sessions[0];
            const totalSessions = plan.sessions.length;

            return (
              <div className="space-y-4 animate-fadeIn" id="hyper-focus-timer-container">
                {/* 1. Active Timer Header */}
                <div className="bg-linear-to-r from-indigo-950 via-slate-900 to-indigo-950 border border-indigo-500/40 p-5 rounded-3xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-5 text-white relative overflow-hidden" id="hyper-focus-timer-banner">
                  {/* Visual Accent Glows */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>
                  
                  <div className="flex items-center gap-4 text-left w-full md:w-auto relative z-10">
                    <div className="relative flex items-center justify-center w-12 h-12 shrink-0 bg-slate-950/60 rounded-full border border-indigo-500/30">
                      {!isFocusPaused && (
                        <span className={`absolute inset-0 rounded-full border-2 ${isFocusBreakActive ? 'border-amber-400' : 'border-indigo-500'} border-t-transparent animate-spin`}></span>
                      )}
                      <span className="text-xl">{isFocusBreakActive ? "☕" : "🎯"}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[9px] font-bold font-mono tracking-widest text-indigo-400 uppercase flex items-center gap-1.5 leading-none">
                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${isFocusBreakActive ? 'bg-amber-400 animate-pulse' : 'bg-indigo-500 animate-ping'}`}></span>
                        {isFocusBreakActive ? "BREAK INTERVAL ACTIVE" : "DEEP FOCUS SPRINT"}
                      </span>
                      <h3 className="text-sm font-black text-white truncate mt-1">
                        {isFocusBreakActive ? "Time to Rest & Recharge" : "Concentrating on Current Objective"}
                      </h3>
                      <p className="text-[10px] text-indigo-300 mt-1">
                        {isFocusBreakActive 
                          ? "Take a deep breath and step away briefly." 
                          : "Keep distractions isolated. Your workspace is secured."}
                      </p>
                    </div>
                  </div>

                  {/* Countdown Timer */}
                  <div className="flex flex-col items-start md:items-end shrink-0 relative z-10">
                    <span className="text-[9px] font-bold font-mono text-indigo-400 tracking-wider">TIME REMAINING</span>
                    <div className="text-2xl font-mono font-black tracking-widest text-indigo-300">
                      {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                    </div>
                    {/* Horizontal progress bar for current session */}
                    <div className="w-28 bg-slate-950/50 h-1.5 rounded-full overflow-hidden mt-1 border border-indigo-950">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ${isFocusBreakActive ? 'bg-amber-500' : 'bg-indigo-500'}`}
                        style={{ width: `${progressPercent}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* 2. Compact Focus Roadmap Panel (Middle) */}
                <div className="bg-slate-900/60 border border-indigo-500/20 rounded-2xl p-4 text-left space-y-3.5 relative overflow-hidden" id="compact-focus-roadmap">
                  {/* Session X of Y & Roadmap Progress Bar */}
                  <div className="flex items-center justify-between text-xs font-bold font-mono">
                    <span className="text-indigo-300">Session {activeSessionNum} of {totalSessions}</span>
                    <span className="text-slate-400">Roadmap: {completedList.length} / {totalSessions} Complete</span>
                  </div>
                  
                  {/* Progress bar of completed sessions */}
                  <div className="w-full h-1.5 bg-slate-950/70 border border-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="bg-linear-to-r from-indigo-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${(completedList.length / totalSessions) * 100}%` }}
                    ></div>
                  </div>

                  {/* Current Session Info */}
                  <div className="bg-slate-950/45 border border-indigo-500/10 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <span className="text-[9px] font-bold font-mono text-emerald-400 uppercase tracking-widest">CURRENT OBJECTIVE</span>
                        <h4 className="text-sm font-black text-white mt-0.5 truncate" title={currentSession?.task || activeTask.title}>
                          {currentSession?.task || activeTask.title}
                        </h4>
                      </div>
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/25 text-[10px] font-mono font-bold text-indigo-300 shrink-0">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{currentSession?.duration || "25 min"}</span>
                      </div>
                    </div>

                    {currentSession?.goal && (
                      <div className="text-xs text-indigo-200 font-medium leading-relaxed italic flex items-center gap-1.5">
                        <span className="text-indigo-400 shrink-0">🎯</span>
                        <span className="truncate" title={currentSession.goal}>Goal: {currentSession.goal}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono mt-1 pt-2 border-t border-slate-900/40">
                      <Coffee className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Break Duration: <strong className="text-amber-300">{currentSession?.breakDuration || "5 min"}</strong></span>
                    </div>
                  </div>

                  {/* Collapsible Upcoming Sessions */}
                  {plan.sessions.filter(s => s.sessionNumber > activeSessionNum).length > 0 && (() => {
                    const upcomingSessions = plan.sessions.filter(s => s.sessionNumber > activeSessionNum);
                    return (
                      <div className="pt-1 border-t border-slate-900/20">
                        <button
                          onClick={() => setIsUpcomingSessionsExpanded(!isUpcomingSessionsExpanded)}
                          className="flex items-center gap-1.5 text-xs font-bold text-indigo-300 hover:text-indigo-200 transition-colors focus:outline-hidden cursor-pointer w-full text-left"
                        >
                          <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${isUpcomingSessionsExpanded ? "rotate-90" : ""}`} />
                          <span>Upcoming Sessions ({upcomingSessions.length})</span>
                        </button>

                        {isUpcomingSessionsExpanded && (
                          <div className="mt-2 pl-3.5 border-l border-indigo-500/15 space-y-2 animate-fadeIn max-h-40 overflow-y-auto">
                            {upcomingSessions.map((session) => {
                              const isCompleted = completedList.includes(session.sessionNumber);
                              return (
                                <div key={session.sessionNumber} className="flex items-start justify-between gap-3 text-xs py-1 hover:bg-slate-950/20 px-1.5 rounded-lg transition-colors">
                                  <div className="min-w-0 flex-1">
                                    <div className="font-bold text-slate-200 truncate flex items-center gap-1.5">
                                      <span className="text-[9px] text-slate-500 font-mono shrink-0">#{session.sessionNumber}</span>
                                      <span className={`truncate ${isCompleted ? 'line-through text-slate-500 font-normal' : ''}`}>{session.task}</span>
                                    </div>
                                    {session.goal && (
                                      <p className="text-[10px] text-slate-400 truncate mt-0.5 pl-4">Goal: {session.goal}</p>
                                    )}
                                  </div>
                                  <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-950/40 border border-slate-800/60 px-1.5 py-0.5 rounded-md shrink-0">
                                    {session.duration}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* 3. Session Action Buttons (Bottom) */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1" id="hyper-focus-actions">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsFocusPaused(!isFocusPaused)}
                      className={`px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 rounded-xl text-xs font-bold tracking-wider cursor-pointer transition-all flex items-center gap-1.5`}
                    >
                      {isFocusPaused ? "▶ Resume" : "⏸ Pause"}
                    </button>
                    {!isFocusBreakActive && (
                      <button
                        onClick={() => {
                          setIsFocusPaused(true);
                          setShowCompleteEarlyConfirm(true);
                        }}
                        className="px-4 py-2 bg-emerald-650 hover:bg-emerald-700 border border-emerald-550/40 text-emerald-100 rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-650/10 hover:shadow-emerald-650/20 cursor-pointer active:scale-97 flex items-center gap-1.5 font-sans"
                      >
                        <span>✓ Complete Session Early</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setIsFocusMinimized(true);
                        setFocusFromPanic(panicModeActive);
                        if (panicModeActive) {
                          setPanicModeActive(false);
                        }
                        addToast("📌 Focus session minimized to background.");
                      }}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-indigo-350 hover:text-indigo-200 border border-indigo-500/25 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      ← Return to Workspace
                    </button>
                    <button
                      onClick={() => {
                        setShowReturnToDashboardConfirm(true);
                      }}
                      className="px-4 py-2 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 hover:border-rose-500/50 text-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      ⏹ End Session
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

        {/* Prominent Dashboard Section: Consolidated AI Command Center */}
        {(!activeFocusTaskId || isFocusMinimized) && (
          <div className="mb-6" id="dashboard-intelligence-grid">
            <AiCommandCenter
              tasks={currentTasks}
              now={now}
              onApplyQueue={handleApplyQueue}
              onResetQueue={handleResetQueue}
              isQueueApplied={sortBy === "intelligent-queue"}
              onFocusTask={handleFocusTask}
              onStartWorkingTask={handleStartWorkingTask}
            />
          </div>
        )}

        {/* Statistics & Advice Dash wrapper */}
        {(!activeFocusTaskId || isFocusMinimized) && (
          <Dashboard
            tasks={currentTasks}
            filterType={filterType}
            setFilterType={setFilterType}
            now={now}
            onFocusTask={handleFocusTask}
          />
        )}

        {/* Task Manipulation Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="task-layout-grid">
          
          {/* Left Column Form panel (span 4/12) */}
          {!(activeFocusTaskId && !isFocusMinimized) && (
            <div className="lg:col-span-4 lg:self-start space-y-4" id="left-form-column">
              <TaskForm
                onAddTask={handleAddTask}
              />
            </div>
          )}

          {/* Right Column Tasks Board panel (span 8/12, or 12/12 in focus mode) */}
          <div className={`${(activeFocusTaskId && !isFocusMinimized) ? "lg:col-span-12" : "lg:col-span-8"} flex flex-col space-y-6`} id="right-board-column">
            
            {/* Filter & Controls menu bar */}
            <div id="tasks-board-section" className="bg-white border border-slate-200/85 p-5 sm:p-6 rounded-2xl flex flex-col gap-4.5 shadow-2xs scroll-mt-6">
              
              {(activeFocusTaskId && !isFocusMinimized) ? (
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-2 animate-fadeIn">
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
                    <Target className="w-5 h-5 shrink-0 animate-pulse" />
                  </div>
                  <div className="text-left">
                    <span className="text-[10px] font-mono font-bold text-indigo-500 uppercase tracking-widest leading-none block">
                      ACTIVE DEEP WORK STACK
                    </span>
                    <h3 className="text-base font-black text-slate-800 mt-1">
                      Focusing on Your Top Priority Task
                    </h3>
                  </div>
                </div>
              ) : (
                <>
                  {/* Top Row: Dynamic Filter Title & Sorting Selector */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                    
                    {/* Dynamic status count heading */}
                    <div className="flex items-center gap-2.5 shrink-0">
                      <div className="p-2 bg-slate-100 rounded-xl text-slate-500">
                        <ListFilter className="w-4 h-4 shrink-0" />
                      </div>
                      <div className="text-left">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono block leading-none">
                          WORKSPACE FILTER
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm font-black text-slate-800 uppercase tracking-wide">
                            {filterType === "all" && "All Logged Deadlines"}
                            {filterType === "upcoming" && "Active Upcoming Deadlines"}
                            {filterType === "overdue" && "Overdue Deadlines"}
                            {filterType === "panic" && "High Alert & Panic Deadlines"}
                            {filterType === "completed" && "Completed Logs"}
                          </span>
                          <span className="bg-slate-900 text-white font-mono font-black text-xs px-2.5 py-0.5 rounded-full shadow-2xs">
                            {sortedTasks.length}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Sort selector dropdown */}
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/60 rounded-xl px-3 py-1 text-slate-600 self-start sm:self-center shrink-0">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-[10px] text-slate-400 font-mono font-bold tracking-wider uppercase">SORT</span>
                      <select
                        className="text-xs bg-transparent border-0 py-1.5 pr-1 focus:outline-hidden font-bold text-slate-800 cursor-pointer"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                      >
                        <option value="deadline">⏰ Soonest Deadline</option>
                        <option value="urgency">⚡ Urgent Priority</option>
                        <option value="effort">💪 Work Effort</option>
                        <option value="created">🆕 Date Created</option>
                        {appliedQueueIds.length > 0 && (
                          <option value="intelligent-queue">🧠 Intelligent Queue</option>
                        )}
                      </select>
                    </div>

                  </div>

                  {/* Bottom Row: Full-width high prominence search bar */}
                  <div className="relative w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      className="w-full text-sm border border-slate-200 hover:border-slate-350 focus:border-slate-800 focus:ring-2 focus:ring-slate-100 outline-hidden rounded-xl pl-11 pr-14 py-2.5 sm:py-3 transition-all shadow-2xs placeholder-slate-400"
                      placeholder="Search task titles, details or URLs..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={() => setSearchTerm("")}
                        className="absolute right-4.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </>
              )}

            </div>

            {/* Clean empty state if zero tasks matched */}
            {sortedTasks.length === 0 ? (
              <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-5 shadow-2xs">
                {(() => {
                  if (currentTasks.length === 0) {
                    return (
                      <>
                        <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl animate-bounce-subtle border border-indigo-100">
                          <Sparkles className="w-8 h-8" />
                        </div>
                        <div className="space-y-1.5 max-w-md">
                          <h4 className="font-display font-black text-gray-900 text-lg">
                            Your Timeline is Safely Clear!
                          </h4>
                          <p className="text-xs text-slate-500 leading-relaxed px-2">
                            Welcome to Deadline Buffer. Log your first incoming milestone to start calculating real-time safety buffers, monitoring total workload stress, and getting AI executive recommendations.
                          </p>
                        </div>
                        <div className="flex flex-col sm:flex-row items-center gap-3 mt-2">
                          <button
                            onClick={() => {
                              const el = document.getElementById("task-form-panel");
                              if (el) {
                                el.scrollIntoView({ behavior: "smooth", block: "center" });
                                setTimeout(() => {
                                  const input = document.getElementById("task-title");
                                  if (input) {
                                    input.focus();
                                  }
                                }, 500);
                              }
                            }}
                            className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white font-sans font-black text-xs tracking-wider rounded-xl shadow-md hover:shadow-lg hover:scale-[1.02] cursor-pointer transition-all active:scale-97"
                          >
                            <span>✍️ Create Custom Task</span>
                          </button>
                          
                          <button
                            onClick={handleEnterDemoWorkspace}
                            className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 px-5 py-3 bg-indigo-650 hover:bg-indigo-700 text-white font-sans font-black text-xs tracking-wider rounded-xl shadow-md hover:shadow-lg hover:scale-[1.02] cursor-pointer transition-all active:scale-97 font-mono animate-pulse"
                          >
                            <span>🎭 Explore Demo Workspace</span>
                          </button>
                        </div>
                      </>
                    );
                  }

                  if (filterType === "overdue") {
                    return (
                      <>
                        <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 animate-pulse-slow">
                          <CheckCircle2 className="w-8 h-8" />
                        </div>
                        <div className="space-y-1.5 max-w-md">
                          <h4 className="font-display font-black text-emerald-900 text-base">
                            🎉 No overdue tasks. Great job staying on track.
                          </h4>
                          <p className="text-xs text-slate-500 leading-relaxed px-4">
                            All of your active commitments are currently ahead of schedule. Your safety buffer is fully protected!
                          </p>
                        </div>
                      </>
                    );
                  }

                  if (filterType === "panic") {
                    return (
                      <>
                        <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100">
                          <ShieldAlert className="w-8 h-8" />
                        </div>
                        <div className="space-y-1.5 max-w-md">
                          <h4 className="font-display font-black text-emerald-900 text-base">
                            ✅ No immediate deadline risks detected.
                          </h4>
                          <p className="text-xs text-slate-500 leading-relaxed px-4">
                            No high-threat deadlines or buffer overflows require emergency focus right now. Your work-life load is fully stable!
                          </p>
                        </div>
                      </>
                    );
                  }

                  return (
                    <>
                      <div className="p-3.5 bg-slate-50 text-slate-400 rounded-2xl">
                        <Layers className="w-8 h-8" />
                      </div>
                      <div className="space-y-1.5 max-w-md">
                        <h4 className="font-display font-bold text-gray-900 text-base">
                          {searchTerm ? "No matching search results" : "No deadlines found in this category"}
                        </h4>
                        <p className="text-xs text-slate-500 leading-relaxed pl-4 pr-4">
                          {searchTerm
                            ? `No logged actions matched "${searchTerm}". Try broadening your search keywords.`
                            : "Everything looks incredibly calm in this channel! Standard systems are offline, or all items in this segment are completed."}
                        </p>
                      </div>
                      {searchTerm && (
                        <button
                          onClick={() => setSearchTerm("")}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer transition-colors"
                        >
                          Clear Search Query
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="space-y-4" id="tasks-grid-list-wrapper">
                {/* Bulk Actions Panel */}
                {sortedTasks.length > 0 && (
                  <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <input
                          id="bulk-select-all-checkbox"
                          type="checkbox"
                          className="w-4 h-4 text-indigo-600 border-slate-300 rounded-sm focus:ring-indigo-550 cursor-pointer"
                          checked={selectedTaskIds.length === sortedTasks.length && sortedTasks.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              handleSelectAll();
                            } else {
                              handleClearSelection();
                            }
                          }}
                        />
                        <label htmlFor="bulk-select-all-checkbox" className="font-bold text-slate-700 cursor-pointer select-none">
                          Select All Visible ({sortedTasks.length})
                        </label>
                      </div>
                      {selectedTaskIds.length > 0 && (
                        <>
                          <span className="text-slate-300">|</span>
                          <button
                            onClick={handleClearSelection}
                            className="text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer font-bold"
                          >
                            Clear Selection ({selectedTaskIds.length})
                          </button>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleBulkDelete}
                        disabled={selectedTaskIds.length === 0}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black transition-all ${
                          selectedTaskIds.length > 0
                            ? "bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 cursor-pointer active:scale-98"
                            : "bg-slate-100 border border-slate-100 text-slate-400 cursor-not-allowed"
                        }`}
                        title={selectedTaskIds.length > 0 ? "Delete all selected tasks" : "Select tasks to delete"}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Selected ({selectedTaskIds.length})</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Task Display cards container (Modern Responsive Bento Grid) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="tasks-grid-list">
                  <AnimatePresence mode="popLayout">
                    {(() => {
                      const activeTasks = currentTasks.filter(t => !t.completed);
                      const activeTasksCount = activeTasks.length;
                      const totalActiveEffort = activeTasks.reduce((sum, t) => sum + (Number(t.estimatedEffort) || 0), 0);
                      
                      const tasksToRender = activeFocusTaskId
                        ? sortedTasks.filter(t => t.id === activeFocusTaskId)
                        : sortedTasks;

                      return tasksToRender.map((task) => {
                        const otherActiveTasks = activeTasks
                          .filter(t => t.id !== task.id)
                          .map(t => t.title);
                          
                        return (
                          <motion.div
                            key={task.id}
                            layout
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96, y: -12 }}
                            transition={{
                              type: "spring",
                              stiffness: 280,
                              damping: 30,
                              mass: 1,
                              opacity: { duration: 0.2 }
                            }}
                            className="w-full h-full"
                          >
                            <TaskCard
                              task={task}
                              now={now}
                              isHighlighted={
                                task.id === highlightedTaskId ||
                                (pulseAllPanic && isTaskPanicQualifying(task, now))
                              }
                              isBriefGlow={task.id === brieflyHighlightedTaskId}
                              activeTasksCount={activeTasksCount}
                              totalActiveEffort={totalActiveEffort}
                              otherActiveTasks={otherActiveTasks}
                              isSelected={selectedTaskIds.includes(task.id)}
                              onSelectToggle={handleToggleSelectTask}
                              onToggleComplete={handleToggleComplete}
                              onEdit={handleUpdateTask}
                              onDelete={handleDeleteTask}
                              isFocusedSessionActive={!!activeFocusTaskId}
                              isActiveFocused={task.id === activeFocusTaskId}
                              onAddToast={addToast}
                            />
                          </motion.div>
                        );
                      });
                    })()}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Clear All / Quick actions row */}
            {currentTasks.length > 0 && (
              <div className="pt-2 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2 text-xs text-gray-400">
                <p className="font-mono text-center sm:text-left">
                  Showing {sortedTasks.length} of {currentTasks.length} logged tasks
                </p>
                <div className="flex items-center justify-center sm:justify-end gap-3">
                  {isDemoWorkspaceActive ? (
                    <>
                      <button
                        onClick={handleResetDemoWorkspace}
                        className="text-gray-400 hover:text-amber-600 flex items-center gap-1.5 transition-colors cursor-pointer py-1 px-2 hover:bg-amber-50 rounded"
                        title="Restore all demo tasks to original defaults"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>Reset Demo Data</span>
                      </button>
                      <span className="text-slate-200">|</span>
                    </>
                  ) : null}
                  <button
                    onClick={handleClearAllTasks}
                    className="text-gray-400 hover:text-rose-600 flex items-center gap-1.5 transition-colors cursor-pointer py-1 px-2 hover:bg-rose-50 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear Entire Board
                  </button>
                </div>
              </div>
            )}

          </div>

        </div>

      </main>

      {/* Humble human-centric Footer */}
      <footer className="bg-white border-t border-gray-150 py-5 text-center mt-12 shrink-0 font-mono text-[11px] text-gray-400" id="app-footer">
        <div className="max-w-7xl mx-auto px-4">
          <p>Last Minute Life Saver — Master the crunch window. Designed to prevent stress-exhaustion.</p>
          <p className="mt-1 text-gray-300">Engineered with high contrast light canvas layout and real-time buffer analysis.</p>
        </div>
      </footer>

      {/* Premium custom overlay modal for resetting board */}
      {showClearAllConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-55 animate-fadeIn animate-duration-200" id="clear-all-modal">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-left space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 bg-rose-50 rounded-xl">
                <Trash2 className="w-5 h-5 shrink-0" />
              </div>
              <h3 className="font-display font-black text-base text-slate-900">
                Reset Current Board?
              </h3>
            </div>
            
            <p className="text-xs text-slate-500 leading-relaxed font-sans">
              This will permanently scrub all custom logged deadlines from your dynamic stack. This action is irreversible.
            </p>
            
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setShowClearAllConfirm(false)}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  saveTasks([]);
                  setSelectedTaskIds([]);
                  setShowClearAllConfirm(false);
                  addToast("🧹 Board scrubbed completely clean.");
                }}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition-all shadow-xs cursor-pointer active:scale-97"
              >
                Reset Board
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Premium custom overlay modal for bulk deletion */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-55 animate-fadeIn animate-duration-200" id="bulk-delete-modal">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-left space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 bg-rose-50 rounded-xl">
                <Trash2 className="w-5 h-5 shrink-0" />
              </div>
              <h3 className="font-display font-black text-base text-slate-900">
                Delete Selected Tasks?
              </h3>
            </div>
            
            <p className="text-xs text-slate-500 leading-relaxed font-sans">
              Are you sure you want to delete the <strong>{selectedTaskIds.length}</strong> selected tasks? This action is irreversible.
            </p>
            
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBulkDelete}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition-all shadow-xs cursor-pointer active:scale-97"
              >
                Delete {selectedTaskIds.length} Tasks
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hyper Focus Session Initiation Modal */}
      {renderFocusModal()}

      {/* Hyper Focus Session Completion Dialog */}
      {showFocusCompleteDialog && (() => {
        const taskObj = currentTasks.find((t) => t.id === activeFocusTaskId);
        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-55 animate-fadeIn animate-duration-200" id="focus-complete-modal">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl text-left space-y-4">
              <div className="flex items-center gap-3 text-emerald-600">
                <div className="p-2.5 bg-emerald-50 rounded-xl animate-bounce">
                  <Sparkles className="w-5 h-5 shrink-0" />
                </div>
                <h3 className="font-display font-black text-base text-slate-900">
                  🎉 Focus Session Complete!
                </h3>
              </div>
              
              <div className="space-y-3 font-sans">
                <p className="text-sm font-bold text-slate-700">
                  Did you finish this task?
                </p>
                {taskObj && (
                  <div className="bg-emerald-50/40 border border-emerald-100 rounded-2xl p-4">
                    <span className="text-[9px] font-bold font-mono text-emerald-600 uppercase tracking-wider block">TARGET TASK</span>
                    <span className="text-sm font-black text-slate-800 mt-1 block">{taskObj.title}</span>
                  </div>
                )}
              </div>
              
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={() => {
                    setShowFocusCompleteDialog(false);
                    if (taskObj) {
                      handleStartFocusSession(taskObj.id, 25 * 60, taskObj);
                      addToast("⏳ Focus session continued for 25 more minutes!", taskObj.title);
                    }
                  }}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 font-sans"
                >
                  <span>⏳ Continue Working</span>
                </button>
                <button
                  onClick={() => {
                    setShowFocusCompleteDialog(false);
                    if (taskObj) {
                      handleToggleComplete(taskObj.id);
                    }
                    handleEndFocusSession();
                    setShowSuccessCelebration(true);
                  }}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-emerald-600/10 hover:shadow-emerald-600/20 cursor-pointer active:scale-97 flex items-center gap-1.5 font-sans"
                >
                  <span>✓ Mark Task Complete</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Complete Session Early Confirmation Dialog */}
      {showCompleteEarlyConfirm && (() => {
        const activeTask = currentTasks.find(t => t.id === activeFocusTaskId);
        if (!activeTask) return null;
        const plan = activeTask.aiFocusPlan || generateLocalDefaultFocusPlan(activeTask);
        const activeSessionNum = activePlanSessionNumber !== null ? activePlanSessionNumber : 1;
        const currentSession = plan.sessions.find(s => s.sessionNumber === activeSessionNum) || plan.sessions[0];

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-55 animate-fadeIn animate-duration-200" id="complete-early-confirm-modal">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl text-left space-y-4">
              <div className="flex items-center gap-3 text-emerald-600">
                <div className="p-2.5 bg-emerald-50 rounded-xl animate-bounce">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                </div>
                <h3 className="font-display font-black text-base text-slate-900">
                  Did you complete this session?
                </h3>
              </div>
              
              <div className="space-y-3 font-sans">
                <p className="text-xs text-slate-500 leading-relaxed">
                  You are about to complete the current session block early. This will stop the countdown timer immediately and proceed to the scheduled break.
                </p>
                {currentSession && (
                  <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4">
                    <span className="text-[9px] font-bold font-mono text-slate-400 uppercase tracking-wider block">CURRENT WORK BLOCK</span>
                    <span className="text-xs font-black text-slate-800 mt-1 block">Session {activeSessionNum}: {currentSession.task}</span>
                    {currentSession.goal && (
                      <p className="text-[11px] text-slate-500 mt-1">Goal: {currentSession.goal}</p>
                    )}
                  </div>
                )}
              </div>
              
              <div className="flex items-center justify-end gap-2 pt-1 font-sans">
                <button
                  onClick={() => {
                    setShowCompleteEarlyConfirm(false);
                    setIsFocusPaused(false); // Resume timer
                  }}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  No, Resume Timer
                </button>
                <button
                  onClick={() => {
                    setShowCompleteEarlyConfirm(false);
                    // Mark completed, stop timer, and proceed to break
                    handleFocusTimerExpiry();
                  }}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 cursor-pointer active:scale-97"
                >
                  Yes, Continue
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Break Offer Dialog */}
      {showBreakOfferDialog && (() => {
        const activeTask = currentTasks.find(t => t.id === activeFocusTaskId);
        if (!activeTask) return null;
        const plan = activeTask.aiFocusPlan || generateLocalDefaultFocusPlan(activeTask);
        const activeSessionNum = activePlanSessionNumber !== null ? activePlanSessionNumber : 1;
        const currentSession = plan.sessions.find(s => s.sessionNumber === activeSessionNum) || plan.sessions[0];

        const handleStartBreak = () => {
          setShowBreakOfferDialog(false);
          setIsFocusBreakActive(true);
          const breakMins = parseDurationMinutes(currentSession.breakDuration);
          const breakSeconds = breakMins * 60;
          setFocusTimeRemaining(breakSeconds);
          setFocusSessionDuration(breakSeconds);
          setIsFocusPaused(false);
          addToast(`☕ Break started: ${breakMins} minutes of rest.`, `Session ${activeSessionNum} Break`);
        };

        const handleSkipBreak = () => {
          setShowBreakOfferDialog(false);
          const nextSession = plan.sessions.find(s => s.sessionNumber === activeSessionNum + 1);
          if (nextSession) {
            // Automatically load the next session
            setActivePlanSessionNumber(nextSession.sessionNumber);
            setIsFocusBreakActive(false);
            const nextMins = parseDurationMinutes(nextSession.duration);
            const nextSeconds = nextMins * 60;
            setFocusTimeRemaining(nextSeconds);
            setFocusSessionDuration(nextSeconds);
            setIsFocusPaused(false);
            addToast(`🚀 Starting Session ${nextSession.sessionNumber}: ${nextSession.task}`, nextSession.goal);
          } else {
            // No next session! Focus plan complete.
            setActivePlanSessionNumber(null);
            setIsFocusBreakActive(false);
            setShowFocusCompleteDialog(true);
          }
        };

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-55 animate-fadeIn animate-duration-200" id="break-offer-modal">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl text-left space-y-4">
              <div className="flex items-center gap-3 text-indigo-600">
                <div className="p-2.5 bg-indigo-50 rounded-xl animate-bounce">
                  <span className="text-xl">🎉</span>
                </div>
                <h3 className="font-display font-black text-base text-slate-900">
                  🎉 Session Complete!
                </h3>
              </div>
              
              <div className="space-y-3 font-sans">
                <div>
                  <span className="text-[10px] font-extrabold font-mono text-slate-400 uppercase tracking-widest block leading-none mb-1">
                    You completed:
                  </span>
                  <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4">
                    <span className="text-xs font-black text-slate-800 block">Session {activeSessionNum}: {currentSession.task}</span>
                    {currentSession.goal ? (
                      <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">🎯 {currentSession.goal}</p>
                    ) : (
                      <p className="text-[11px] text-slate-500 mt-1 italic">No specific goal specified for this session.</p>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed font-bold">
                  Would you like to take your scheduled break?
                </p>
              </div>
              
              <div className="flex items-center justify-end gap-2.5 pt-1 font-sans">
                <button
                  onClick={handleSkipBreak}
                  className="px-4.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <span>➡ Skip Break</span>
                </button>
                <button
                  onClick={handleStartBreak}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 cursor-pointer active:scale-97 flex items-center gap-1.5"
                >
                  <span>☕ Start Break</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Next Session Preparation Dialog */}
      {showNextSessionPrepareDialog && (() => {
        const activeTask = currentTasks.find(t => t.id === activeFocusTaskId);
        if (!activeTask) return null;
        const plan = activeTask.aiFocusPlan || generateLocalDefaultFocusPlan(activeTask);
        const activeSessionNum = activePlanSessionNumber !== null ? activePlanSessionNumber : 1;
        const totalSessions = plan.sessions.length;

        const handleSaveAndStart = () => {
          // If we edited the session, let's update it in the focus plan and save it
          let updatedSessions = [...plan.sessions];
          const sessionIndex = updatedSessions.findIndex(s => s.sessionNumber === activeSessionNum);
          if (sessionIndex !== -1) {
            updatedSessions[sessionIndex] = {
              ...updatedSessions[sessionIndex],
              task: prepareSessionTask,
              goal: prepareSessionGoal,
              duration: prepareSessionDuration,
            };
          }

          const updatedTask: Task = {
            ...activeTask,
            aiFocusPlan: {
              ...plan,
              sessions: updatedSessions,
            }
          };

          const updated = currentTasks.map((t) => (t.id === updatedTask.id ? updatedTask : t));
          saveTasks(computeStoredRiskForTasks(updated, new Date()));

          // Set the timer duration
          const nextMins = parseDurationMinutes(prepareSessionDuration);
          const nextSeconds = nextMins * 60;
          setFocusTimeRemaining(nextSeconds);
          setFocusSessionDuration(nextSeconds);

          setShowNextSessionPrepareDialog(false);
          setIsFocusPaused(false); // START the timer now!
          addToast(`🚀 Starting Session ${activeSessionNum}: ${prepareSessionTask}`, prepareSessionGoal);
        };

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-55 animate-fadeIn animate-duration-200" id="next-session-prepare-modal">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl text-left space-y-4">
              <div className="flex items-center gap-3 text-indigo-600 border-b border-slate-100 pb-3">
                <div className="p-2 bg-indigo-50 rounded-lg">
                  <span className="text-xl">🚀</span>
                </div>
                <div>
                  <h3 className="font-display font-black text-base text-slate-900 leading-none">
                    Session {activeSessionNum} of {totalSessions}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium font-sans mt-1">Prepare your next focus block</p>
                </div>
              </div>

              <div className="space-y-4 font-sans text-slate-700">
                {!isEditingPrepareSession ? (
                  <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4.5 space-y-3.5 text-left">
                    <div>
                      <span className="text-[10px] font-extrabold font-mono text-slate-400 uppercase tracking-wider block">Today's Goal</span>
                      <span className="text-sm font-black text-slate-850 mt-1 block">
                        {prepareSessionTask}
                      </span>
                      {prepareSessionGoal && (
                        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed italic">
                          🎯 {prepareSessionGoal}
                        </p>
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] font-extrabold font-mono text-slate-400 uppercase tracking-wider block">Estimated Duration</span>
                      <span className="text-sm font-mono font-bold text-slate-700 mt-1 block">
                        ⏱ {prepareSessionDuration}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4.5 space-y-3.5 text-left animate-fadeIn">
                    <span className="text-[10px] font-extrabold font-mono text-indigo-600 uppercase tracking-widest block mb-1">
                      Edit Session Details
                    </span>
                    <div className="space-y-2.5">
                      <div>
                        <label className="text-[10px] font-extrabold text-slate-400 uppercase block tracking-wider mb-1">Session Title</label>
                        <input
                          type="text"
                          value={prepareSessionTask}
                          onChange={(e) => setPrepareSessionTask(e.target.value)}
                          className="w-full bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold focus:outline-hidden focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-extrabold text-slate-400 uppercase block tracking-wider mb-1">Session Goal</label>
                        <input
                          type="text"
                          value={prepareSessionGoal}
                          onChange={(e) => setPrepareSessionGoal(e.target.value)}
                          className="w-full bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-xs focus:outline-hidden focus:border-indigo-500"
                          placeholder="e.g. Code 3 API routes"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-extrabold text-slate-400 uppercase block tracking-wider mb-1">Duration</label>
                        <select
                          value={prepareSessionDuration}
                          onChange={(e) => setPrepareSessionDuration(e.target.value)}
                          className="w-full bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold focus:outline-hidden focus:border-indigo-500"
                        >
                          <option value="15 minutes">15 minutes</option>
                          <option value="25 minutes">25 minutes</option>
                          <option value="30 minutes">30 minutes</option>
                          <option value="45 minutes">45 minutes</option>
                          <option value="60 minutes">60 minutes</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-1 font-sans">
                {isEditingPrepareSession ? (
                  <button
                    onClick={() => setIsEditingPrepareSession(false)}
                    className="px-4.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-100 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Done Editing
                  </button>
                ) : (
                  <button
                    onClick={() => setIsEditingPrepareSession(true)}
                    className="px-4.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Edit Session
                  </button>
                )}
                <button
                  onClick={handleSaveAndStart}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 cursor-pointer active:scale-97"
                >
                  Start Next Session
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Return to Dashboard Confirmation Dialog */}
      {showReturnToDashboardConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-55 animate-fadeIn animate-duration-200" id="return-to-dashboard-confirm-modal">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-left space-y-4">
            <div className="flex items-center gap-3 text-indigo-650">
              <div className="p-2.5 bg-indigo-50 rounded-xl">
                <Target className="w-5 h-5 shrink-0" />
              </div>
              <h3 className="font-display font-black text-base text-slate-900">
                Return to Dashboard
              </h3>
            </div>
            
            <p className="text-xs text-slate-500 leading-relaxed font-sans">
              Are you sure you want to pause or end your focus session and return to the main dashboard? Your progress will be saved.
            </p>
            
            <div className="flex items-center justify-end gap-2 pt-1 font-sans">
              <button
                onClick={() => setShowReturnToDashboardConfirm(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Continue Working
              </button>
              <button
                onClick={() => {
                  handleEndFocusSession();
                  addToast("⏹ Focus session ended early.");
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 cursor-pointer active:scale-97"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Active Focus Session Modal */}
      {editingFocusSessionNumber !== null && (() => {
        const activeTask = currentTasks.find(t => t.id === activeFocusTaskId);
        if (!activeTask) return null;
        
        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-55 animate-fadeIn animate-duration-200" id="edit-focus-session-modal">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl text-left space-y-4">
              <div className="flex items-center gap-3 text-indigo-600 border-b border-slate-100 pb-3">
                <div className="p-2 bg-indigo-50 rounded-lg">
                  <span className="text-xl">✍️</span>
                </div>
                <div>
                  <h3 className="font-display font-black text-base text-slate-900 leading-none">
                    Edit Session {editingFocusSessionNumber}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium font-sans mt-1">Update this work block's target specifications</p>
                </div>
              </div>

              <div className="space-y-4 font-sans text-slate-700">
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase block tracking-wider mb-1">Session Title</label>
                    <input
                      type="text"
                      value={editedFocusSessionTask}
                      onChange={(e) => setEditedFocusSessionTask(e.target.value)}
                      className="w-full bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold text-slate-850 focus:outline-hidden focus:border-indigo-500 shadow-3xs"
                      placeholder="e.g. Code feature A"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase block tracking-wider mb-1">Goal</label>
                    <textarea
                      value={editedFocusSessionGoal}
                      onChange={(e) => setEditedFocusSessionGoal(e.target.value)}
                      className="w-full bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs text-slate-700 focus:outline-hidden focus:border-indigo-500 shadow-3xs h-16 resize-none leading-relaxed"
                      placeholder="Describe the target outcome of this block"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-extrabold text-slate-400 uppercase block tracking-wider mb-1">Session Duration</label>
                      <select
                        value={editedFocusSessionDuration}
                        onChange={(e) => setEditedFocusSessionDuration(e.target.value)}
                        className="w-full bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-indigo-500 shadow-3xs cursor-pointer"
                      >
                        {["15 minutes", "20 minutes", "25 minutes", "30 minutes", "45 minutes", "50 minutes", "60 minutes", "90 minutes"].map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-extrabold text-slate-400 uppercase block tracking-wider mb-1">Break Duration</label>
                      <select
                        value={editedFocusSessionBreak}
                        onChange={(e) => setEditedFocusSessionBreak(e.target.value)}
                        className="w-full bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-indigo-500 shadow-3xs cursor-pointer"
                      >
                        {["3 minutes", "5 minutes", "10 minutes", "15 minutes", "20 minutes"].map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1 font-sans border-t border-slate-100 pt-3">
                <button
                  onClick={() => setEditingFocusSessionNumber(null)}
                  className="px-4.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEditedFocusSession}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 cursor-pointer active:scale-97"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 25-Minute Focus Continuation Offer Dialog */}
      {showFocusContinueOffer && (() => {
        const taskObj = currentTasks.find((t) => t.id === activeFocusTaskId);
        if (!taskObj) return null;
        
        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-55 animate-fadeIn animate-duration-200" id="focus-continue-offer-modal">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl text-left space-y-4">
              <div className="flex items-center gap-3 text-indigo-600">
                <div className="p-2.5 bg-indigo-50 rounded-xl">
                  <Target className="w-5 h-5 shrink-0 animate-pulse" />
                </div>
                <h3 className="font-display font-black text-base text-slate-900">
                  Keep the Momentum Going! 🚀
                </h3>
              </div>
              
              <div className="space-y-3 font-sans">
                <p className="text-sm font-bold text-slate-700">
                  You are in the flow state. Would you like to launch another 25-minute focus block?
                </p>
                <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4">
                  <span className="text-[9px] font-bold font-mono text-slate-400 uppercase tracking-wider block">TARGET TASK</span>
                  <span className="text-sm font-black text-slate-800 mt-1 block">{taskObj.title}</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  A 25-minute Pomodoro-style block is a powerful way to wrap up or make major progress while your mind is already primed!
                </p>
              </div>
              
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={() => {
                    handleEndFocusSession();
                    addToast("Focus session ended. Great effort!");
                  }}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  No, I'm Done
                </button>
                <button
                  onClick={() => {
                    handleStartFocusSession(taskObj.id, 25 * 60, taskObj);
                  }}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 cursor-pointer active:scale-97 flex items-center gap-1 font-sans"
                >
                  <span>🚀 Start 25-Min Session</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Full-Screen Success Celebration Overlay */}
      <AnimatePresence>
        {showSuccessCelebration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-55 overflow-hidden"
            onClick={() => setShowSuccessCelebration(false)}
          >
            {/* Particle simulation for confetti */}
            <div className="absolute inset-0 pointer-events-none">
              {[...Array(40)].map((_, i) => {
                const randomX = Math.random() * 100;
                const randomDelay = Math.random() * 2;
                const randomDuration = 2 + Math.random() * 3;
                const randomSize = 8 + Math.random() * 12;
                const colors = [
                  "bg-emerald-400", "bg-indigo-400", "bg-amber-400", 
                  "bg-pink-400", "bg-sky-400", "bg-violet-400"
                ];
                const randomColor = colors[Math.floor(Math.random() * colors.length)];
                
                return (
                  <motion.div
                    key={i}
                    initial={{ y: -50, x: `${randomX}%`, rotate: 0, opacity: 1 }}
                    animate={{ 
                      y: "110vh", 
                      x: `${randomX + (Math.random() * 20 - 10)}%`, 
                      rotate: 360 * (Math.random() > 0.5 ? 1 : -1) 
                    }}
                    transition={{ 
                      duration: randomDuration, 
                      repeat: Infinity, 
                      delay: randomDelay,
                      ease: "linear"
                    }}
                    style={{ width: randomSize, height: randomSize }}
                    className={`absolute rounded-xs ${randomColor} shadow-md`}
                  />
                );
              })}
            </div>

            <motion.div
              initial={{ scale: 0.8, y: 50, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.8, y: 50, opacity: 0 }}
              transition={{ type: "spring", damping: 15 }}
              className="bg-white border border-slate-200 rounded-3xl p-8 max-w-md w-full shadow-2xl text-center space-y-6 relative z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col items-center gap-3">
                <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-4xl shadow-xs border border-emerald-100 animate-bounce">
                  🏆
                </div>
                <h3 className="font-display font-black text-2xl text-slate-900 tracking-tight mt-2">
                  Incredible Work!
                </h3>
                <p className="text-slate-500 text-sm font-sans max-w-xs leading-relaxed">
                  You stayed fully locked in and crushed your focus block. This task is officially completed!
                </p>
              </div>

              {/* Reward stats banner */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4.5 grid grid-cols-2 gap-4 text-center">
                <div>
                  <span className="text-[9px] font-bold font-mono text-slate-400 uppercase tracking-widest block">FOCUS EARNED</span>
                  <span className="text-lg font-black text-indigo-600 mt-1 block">
                    {focusSessionDuration === 25 * 60 ? "25 mins" : "45 mins"}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] font-bold font-mono text-slate-400 uppercase tracking-widest block">DIFFICULTY DEFEATED</span>
                  <span className="text-lg font-black text-emerald-600 mt-1 block">Level Up!</span>
                </div>
              </div>

              <button
                onClick={() => setShowSuccessCelebration(false)}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer active:scale-97"
              >
                Return to Workspace
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamic Satisfying Toast Notifications */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2 } }}
              className="bg-slate-900 border border-slate-800 text-white p-4 rounded-2xl shadow-2xl flex items-start gap-3 pointer-events-auto select-none text-left"
            >
              <div className="shrink-0 p-1.5 bg-emerald-500/15 rounded-xl text-emerald-400 mt-0.5">
                <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-slate-400 font-mono uppercase tracking-wider">
                  Success Checklist
                </h4>
                <p className="text-sm font-sans font-black text-white mt-1 leading-snug">
                  {toast.message}
                </p>
                {toast.taskTitle && (
                  <p className="text-[11px] font-mono text-emerald-300 mt-1.5 line-clamp-1 bg-emerald-950/45 px-2 py-0.5 rounded border border-emerald-900/30 inline-block max-w-full">
                    Completed: {toast.taskTitle}
                  </p>
                )}
              </div>
              <button
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                className="shrink-0 text-slate-500 hover:text-white p-0.5 transition-colors cursor-pointer rounded-lg hover:bg-slate-800"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Compact Floating Timer (visible only when focus session is minimized to background) */}
      <AnimatePresence>
        {activeFocusTaskId && isFocusMinimized && (() => {
          const activeTask = currentTasks.find(t => t.id === activeFocusTaskId);
          if (!activeTask) return null;

          const minutes = Math.floor(focusTimeRemaining / 60);
          const seconds = focusTimeRemaining % 60;
          const progressPercent = (focusTimeRemaining / focusSessionDuration) * 100;

          const isPlanActive = activeTask.aiFocusPlan && activePlanSessionNumber !== null;
          const currentSessionObj = isPlanActive 
            ? activeTask.aiFocusPlan.sessions.find(s => s.sessionNumber === activePlanSessionNumber)
            : null;

          return (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8, x: -50 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.8, x: -50 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setIsFocusMinimized(false);
                if (focusFromPanic) {
                  setPanicModeActive(true);
                }
                addToast("🚀 Focus workspace reopened.");
              }}
              className="fixed bottom-6 left-6 z-50 bg-linear-to-r from-slate-900 to-indigo-950 border border-indigo-500/40 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3.5 text-white cursor-pointer select-none"
              id="compact-floating-timer"
              title="Click to reopen Hyper Focus Mode"
            >
              {/* Pulsing Visual Indicator */}
              <div className="relative flex items-center justify-center w-8 h-8 bg-slate-950/60 rounded-full border border-indigo-500/30">
                {!isFocusPaused ? (
                  <span className={`absolute inset-0 rounded-full border-2 ${isFocusBreakActive ? 'border-amber-400' : 'border-indigo-500'} border-t-transparent animate-spin`}></span>
                ) : (
                  <span className="absolute w-2 h-2 rounded-full bg-amber-500"></span>
                )}
                <span className="text-sm">{isFocusBreakActive ? "☕" : "🎯"}</span>
              </div>

              <div className="text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] font-bold font-mono tracking-wider text-indigo-400 uppercase leading-none">
                    {isPlanActive 
                      ? `Session ${activePlanSessionNumber} of ${activeTask.aiFocusPlan!.sessions.length}` 
                      : (isFocusPaused ? "PAUSED" : "FOCUS RUNNING")}
                  </span>
                  {!isFocusPaused && (
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${isFocusBreakActive ? 'bg-amber-400 animate-pulse' : 'bg-indigo-500 animate-ping'}`}></span>
                  )}
                </div>
                <div className="text-sm font-mono font-black text-indigo-300 tracking-wider leading-none mt-1">
                  {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                </div>
                <div className="text-[10px] text-slate-300 font-bold max-w-[120px] truncate mt-0.5" title={isPlanActive && currentSessionObj ? currentSessionObj.task : activeTask.title}>
                  {isPlanActive && currentSessionObj ? currentSessionObj.task : activeTask.title}
                </div>
              </div>

              {/* Expand Indicator icon */}
              <div className="pl-1 text-indigo-400">
                <span className="text-xs font-bold font-mono">⤢</span>
              </div>

              {/* Progress line at the bottom of the card */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-950/50 overflow-hidden rounded-b-2xl">
                <div 
                  className="bg-indigo-500 h-full transition-all duration-1000"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

    </div>
  );
}
