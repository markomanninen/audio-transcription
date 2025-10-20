import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  TouchEvent as ReactTouchEvent,
  KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useAIEditor } from '../../hooks/useAIEditor';
import { useExportTemplates } from '../../hooks/useExportTemplates';
import ReactDiffViewer from '@alexbruf/react-diff-viewer';
import '@alexbruf/react-diff-viewer/index.css';
import './EditorView.css';

interface EditorViewProps {
  initialText: string;
  projectId: number;
}

type AnalysisSource = 'nlp-analysis' | 'fact-check';

interface AnalysisHistoryEntry {
  id: string;
  source: AnalysisSource;
  title: string;
  result: string;
  createdAt: number;
  metadata?: string;
  isFallback?: boolean;
}

const SIDE_PANEL_MIN_WIDTH = 280;
const SIDE_PANEL_MAX_WIDTH = 600;
const DEFAULT_SIDE_PANEL_RATIO = 0.34;
const MIN_LEFTOVER_WIDTH = 480;
const DEFAULT_CONTAINER_WIDTH = 1200;

const DIFF_RATIO_MIN = 0.2;
const DIFF_RATIO_MAX = 0.8;
const DIFF_RATIO_STEP = 0.04;
const PANEL_WIDTH_STEP = 24;
const MAX_ANALYSIS_HISTORY = 20;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const createHistoryEntryId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function EditorView({ initialText, projectId }: EditorViewProps) {
  const [text, setText] = useState(initialText);
  const [draft, setDraft] = useState(initialText);
  const [history, setHistory] = useState<string[]>([]);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [targetStyle, setTargetStyle] = useState('General');
  const [factCheckDomain, setFactCheckDomain] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [sidePanelRatio, setSidePanelRatio] = useState(DEFAULT_SIDE_PANEL_RATIO);
  const [isPanelResizing, setIsPanelResizing] = useState(false);
  const [diffColumnRatio, setDiffColumnRatio] = useState(0.5);
  const [isDiffResizing, setIsDiffResizing] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [analysisHistory, setAnalysisHistory] = useState<AnalysisHistoryEntry[]>([]);
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null);

  const layoutRef = useRef<HTMLDivElement | null>(null);
  const diffContainerRef = useRef<HTMLDivElement | null>(null);

  const { data: exportTemplates } = useExportTemplates();

  const recordAnalysisEntry = useCallback(
    (entry: Omit<AnalysisHistoryEntry, 'id' | 'createdAt'>) => {
      const fullEntry: AnalysisHistoryEntry = {
        id: createHistoryEntryId(),
        createdAt: Date.now(),
        ...entry,
      };
      setAnalysisHistory(prev => [fullEntry, ...prev].slice(0, MAX_ANALYSIS_HISTORY));
      setAnalysisResult(fullEntry.result);
      setSelectedAnalysisId(fullEntry.id);
    },
    []
  );

  const handleSelectAnalysisEntry = useCallback(
    (entryId: string) => {
      setSelectedAnalysisId(entryId);
      const entry = analysisHistory.find(item => item.id === entryId);
      if (entry) {
        setAnalysisResult(entry.result);
      }
    },
    [analysisHistory]
  );

  const handleClearAnalysisResult = useCallback(() => {
    setAnalysisResult(null);
    setSelectedAnalysisId(null);
  }, []);

  const handleClearAnalysisHistory = useCallback(() => {
    setAnalysisHistory([]);
    setAnalysisResult(null);
    setSelectedAnalysisId(null);
  }, []);

  const selectedAnalysisEntry = useMemo(
    () => analysisHistory.find(entry => entry.id === selectedAnalysisId) ?? null,
    [analysisHistory, selectedAnalysisId]
  );

  const clampPanelWidth = useCallback(
    (availableWidth: number, desiredWidth: number) => {
      if (availableWidth <= 0) {
        return Math.max(desiredWidth, SIDE_PANEL_MIN_WIDTH);
      }
      const theoreticalMax = availableWidth - MIN_LEFTOVER_WIDTH;
      const maxWidth = Math.min(
        SIDE_PANEL_MAX_WIDTH,
        Math.max(SIDE_PANEL_MIN_WIDTH, theoreticalMax)
      );
      const minWidth = Math.min(SIDE_PANEL_MIN_WIDTH, maxWidth);
      const width = clamp(desiredWidth, minWidth, maxWidth);
      return Math.max(0, Number.isFinite(width) ? width : minWidth);
    },
    []
  );

  useEffect(() => {
    const container = layoutRef.current;
    if (!container) {
      return;
    }

    const updateWidth = () => {
      const measuredWidth = container.getBoundingClientRect().width;
      setContainerWidth(measuredWidth);
    };

    updateWidth();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(entries => {
        if (!entries.length) {
          return;
        }
        const { width } = entries[0].contentRect;
        setContainerWidth(width);
      });
      observer.observe(container);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const sidePanelWidth = useMemo(() => {
    const basis = containerWidth || DEFAULT_CONTAINER_WIDTH;
    return clampPanelWidth(basis, basis * sidePanelRatio);
  }, [clampPanelWidth, containerWidth, sidePanelRatio]);

  const sidePanelStyle = useMemo<CSSProperties>(
    () => ({
      width: sidePanelWidth,
      flex: '0 0 auto',
      minWidth: SIDE_PANEL_MIN_WIDTH,
    }),
    [sidePanelWidth]
  );

  const diffStyleVars = useMemo<CSSProperties>(
    () => ({
      '--diff-viewer-left-width': `${(diffColumnRatio * 100).toFixed(2)}%`,
      '--diff-viewer-right-width': `${((1 - diffColumnRatio) * 100).toFixed(2)}%`,
      '--diff-viewer-divider-position': `${(diffColumnRatio * 100).toFixed(2)}%`,
    } as CSSProperties),
    [diffColumnRatio]
  );

  const diffHandlePosition = useMemo(
    () => `${(diffColumnRatio * 100).toFixed(2)}%`,
    [diffColumnRatio]
  );

  const panelWidthRounded = Math.round(sidePanelWidth);
  const diffPercentage = Math.round(diffColumnRatio * 100);

  const handlePanelResize = useCallback(
    (clientX: number) => {
      const container = layoutRef.current;
      if (!container) {
        return;
      }
      const rect = container.getBoundingClientRect();
      if (!rect.width) {
        return;
      }
      const rawWidth = rect.right - clientX;
      const nextWidth = clampPanelWidth(rect.width, rawWidth);
      setSidePanelRatio(prev => {
        if (!rect.width) {
          return prev;
        }
        const ratio = clamp(nextWidth / rect.width, 0, 1);
        return Number.isFinite(ratio) ? ratio : prev;
      });
    },
    [clampPanelWidth]
  );

  const adjustSidePanelWidth = useCallback(
    (delta: number) => {
      const container = layoutRef.current;
      if (!container) {
        return;
      }
      const rect = container.getBoundingClientRect();
      if (!rect.width) {
        return;
      }
      const currentWidth = clampPanelWidth(rect.width, sidePanelWidth);
      const nextWidth = clampPanelWidth(rect.width, currentWidth + delta);
      setSidePanelRatio(prev => {
        const ratio = clamp(nextWidth / rect.width, 0, 1);
        return Number.isFinite(ratio) ? ratio : prev;
      });
    },
    [clampPanelWidth, sidePanelWidth]
  );

  const handlePanelResizeStart = useCallback(
    (event: ReactMouseEvent<HTMLDivElement> | ReactTouchEvent<HTMLDivElement>) => {
      event.preventDefault();
      if ('touches' in event) {
        const touch = event.touches[0];
        if (touch) {
          handlePanelResize(touch.clientX);
        }
      } else {
        handlePanelResize(event.clientX);
      }
      setIsPanelResizing(true);
    },
    [handlePanelResize]
  );

  const handlePanelResizeKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        adjustSidePanelWidth(-PANEL_WIDTH_STEP);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        adjustSidePanelWidth(PANEL_WIDTH_STEP);
      }
    },
    [adjustSidePanelWidth]
  );

  const resetPanelWidth = useCallback(() => {
    setSidePanelRatio(DEFAULT_SIDE_PANEL_RATIO);
  }, []);

  useEffect(() => {
    if (!isPanelResizing) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      event.preventDefault();
      handlePanelResize(event.clientX);
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        return;
      }
      handlePanelResize(event.touches[0].clientX);
    };

    const stopResizing = () => setIsPanelResizing(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', stopResizing);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', stopResizing);

    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopResizing);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', stopResizing);
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;
    };
  }, [handlePanelResize, isPanelResizing]);

  const updateDiffRatio = useCallback((clientX: number) => {
    const container = diffContainerRef.current;
    if (!container) {
      return;
    }
    const rect = container.getBoundingClientRect();
    if (!rect.width) {
      return;
    }
    const nextRatio = clamp((clientX - rect.left) / rect.width, DIFF_RATIO_MIN, DIFF_RATIO_MAX);
    setDiffColumnRatio(nextRatio);
  }, []);

  const handleDiffResizeStart = useCallback(
    (event: ReactMouseEvent<HTMLDivElement> | ReactTouchEvent<HTMLDivElement>) => {
      event.preventDefault();
      if ('touches' in event) {
        const touch = event.touches[0];
        if (touch) {
          updateDiffRatio(touch.clientX);
        }
      } else {
        updateDiffRatio(event.clientX);
      }
      setIsDiffResizing(true);
    },
    [updateDiffRatio]
  );

  const handleDiffResizeKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setDiffColumnRatio(prev => clamp(prev - DIFF_RATIO_STEP, DIFF_RATIO_MIN, DIFF_RATIO_MAX));
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        setDiffColumnRatio(prev => clamp(prev + DIFF_RATIO_STEP, DIFF_RATIO_MIN, DIFF_RATIO_MAX));
      }
    },
    []
  );

  const resetDiffRatio = useCallback(() => setDiffColumnRatio(0.5), []);

  useEffect(() => {
    if (!isDiffResizing) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      event.preventDefault();
      updateDiffRatio(event.clientX);
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        return;
      }
      updateDiffRatio(event.touches[0].clientX);
    };

    const stopResizing = () => setIsDiffResizing(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', stopResizing);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', stopResizing);

    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopResizing);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', stopResizing);
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;
    };
  }, [isDiffResizing, updateDiffRatio]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkTheme(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    setIsDarkTheme(document.documentElement.classList.contains('dark'));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setText(initialText);
    setDraft(initialText);
    setHistory([]);
  }, [initialText]);

  const {
    useSemanticReconstruction,
    useStyleGeneration,
    useNlpAnalysis,
    useFactChecking,
  } = useAIEditor(projectId);

  const semanticReconstruction = useSemanticReconstruction();
  const styleGeneration = useStyleGeneration();
  const nlpAnalysis = useNlpAnalysis();
  const factChecking = useFactChecking();

  useEffect(() => {
    if (semanticReconstruction.isSuccess) {
      setAiSuggestion(semanticReconstruction.data.result);
    }
  }, [semanticReconstruction.isSuccess, semanticReconstruction.data]);

  useEffect(() => {
    if (styleGeneration.isSuccess) {
      setAiSuggestion(styleGeneration.data.result);
    }
  }, [styleGeneration.isSuccess, styleGeneration.data]);

  useEffect(() => {
    if (nlpAnalysis.isSuccess && nlpAnalysis.data) {
      const serialized = JSON.stringify(nlpAnalysis.data, null, 2);
      recordAnalysisEntry({
        source: 'nlp-analysis',
        title: 'Content Analysis',
        result: serialized,
      });
    }
  }, [nlpAnalysis.isSuccess, nlpAnalysis.data, recordAnalysisEntry]);

  useEffect(() => {
    if (factChecking.isSuccess && factChecking.data) {
      const serialized = JSON.stringify(factChecking.data, null, 2);
      recordAnalysisEntry({
        source: 'fact-check',
        title: 'Fact Check Result',
        result: serialized,
        metadata: typeof factChecking.data === 'object' && factChecking.data !== null && 'domain' in factChecking.data
          ? String((factChecking.data as { domain?: unknown }).domain ?? '')
          : undefined,
      });
    }
  }, [factChecking.isSuccess, factChecking.data, recordAnalysisEntry]);

  const handleSemanticReconstruction = async () => {
    try {
      await semanticReconstruction.mutateAsync(draft);
    } catch (error) {
      console.warn('[AI Editor] Semantic reconstruction failed, using fallback.', error);
      const fallback = `${draft}\n\n[AI Suggestion Placeholder]\n• Clarify key statements for readability.`;
      setAiSuggestion(fallback);
    }
  };

  const handleStyleGeneration = async () => {
    try {
      await styleGeneration.mutateAsync({ text: draft, target_style: targetStyle });
    } catch (error) {
      console.warn('[AI Editor] Style generation failed, using fallback.', error);
      const fallback = `${draft}\n\n[Style Suggestion Placeholder]\nThis rewrite would adjust tone toward "${targetStyle}."`;
      setAiSuggestion(fallback);
    }
  };

  const handleNlpAnalysis = async () => {
    try {
      await nlpAnalysis.mutateAsync(draft);
    } catch (error) {
      console.warn('[AI Editor] NLP analysis failed, using fallback.', error);
      const fallback = JSON.stringify(
        {
          summary: 'NLP analysis is unavailable offline. Try again once AI services are connected.',
          key_themes: ['Clarity', 'Structure', 'Tone'],
          action_items: ['Review paragraphs manually', 'Highlight important transitions'],
        },
        null,
        2
      );
      recordAnalysisEntry({
        source: 'nlp-analysis',
        title: 'Content Analysis (offline)',
        result: fallback,
        isFallback: true,
      });
    }
  };

  const handleFactChecking = async () => {
    if (!factCheckDomain) {
      alert("Please provide a domain for fact-checking.");
      return;
    }
    try {
      await factChecking.mutateAsync({ text: draft, domain: factCheckDomain });
    } catch (error) {
      console.warn('[AI Editor] Fact checking failed, using fallback.', error);
      const fallback = JSON.stringify(
        {
          domain: factCheckDomain,
          status: 'offline',
          note: 'LLM provider not available. Review terminology manually.',
        },
        null,
        2
      );
      recordAnalysisEntry({
        source: 'fact-check',
        title: 'Fact Check (offline)',
        result: fallback,
        metadata: factCheckDomain || undefined,
        isFallback: true,
      });
    }
  };

  const handleExportWithTemplate = () => {
    if (!selectedTemplateId) {
      alert("Please select an export template.");
      return;
    }
    const url = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/export/project/${projectId}/template/${selectedTemplateId}`;
    window.open(url, '_blank');
  };

  const handleSaveVersion = () => {
    if (text === draft) {
      alert("No changes to save.");
      return;
    }
    setHistory(prev => [...prev, text]);
    setText(draft);
  };

  const handleApproveSuggestion = () => {
    if (aiSuggestion) {
      setHistory(prev => [...prev, text]);
      setText(aiSuggestion);
      setDraft(aiSuggestion);
      setAiSuggestion(null);
    }
  };

  const handleRejectSuggestion = () => setAiSuggestion(null);

  const handleRollback = (index: number) => {
    const targetVersion = history[index];
    const newHistory = history.slice(0, index);
    setText(targetVersion);
    setDraft(targetVersion);
    setHistory(newHistory);
    setAiSuggestion(null);
  };

  const anyMutationPending =
    semanticReconstruction.isPending ||
    styleGeneration.isPending ||
    nlpAnalysis.isPending ||
    factChecking.isPending;

  return (
    <div className="bg-white dark:bg-gray-800 w-full h-full flex flex-col p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Editor Workspace</h2>
        <button
          onClick={handleSaveVersion}
          disabled={text === draft}
          className="px-3 py-1 text-sm text-white bg-gray-600 rounded-md hover:bg-gray-700 disabled:bg-gray-400"
        >
          Save Version
        </button>
      </div>
      <div ref={layoutRef} className="flex-grow flex min-h-0 items-stretch">
        <div className="flex flex-col flex-1 min-h-0 min-w-0 mr-4">
          {aiSuggestion ? (
            <div className="flex flex-col flex-1 border border-gray-300 dark:border-gray-600 rounded-lg min-h-0">
              <div className="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-900 border-b dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">AI Suggestion</h3>
                <div className="flex gap-2">
                  <button onClick={handleApproveSuggestion} className="px-3 py-1 text-sm text-white bg-green-600 rounded-md hover:bg-green-700">Approve</button>
                  <button onClick={handleRejectSuggestion} className="px-3 py-1 text-sm text-white bg-red-600 rounded-md hover:bg-red-700">Reject</button>
                </div>
              </div>
              <div
                ref={diffContainerRef}
                className="diff-viewer-wrapper flex-1 overflow-auto"
                data-testid="ai-diff-viewer"
                style={diffStyleVars}
              >
                <ReactDiffViewer
                  oldValue={text}
                  newValue={aiSuggestion}
                  splitView={true}
                  useDarkTheme={isDarkTheme}
                  leftTitle="Current Text"
                  rightTitle="AI Suggestion"
                />
                <div
                  className={`diff-viewer-resize-handle${isDiffResizing ? ' is-active' : ''}`}
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Resize diff columns"
                  aria-valuemin={Math.round(DIFF_RATIO_MIN * 100)}
                  aria-valuemax={Math.round(DIFF_RATIO_MAX * 100)}
                  aria-valuenow={diffPercentage}
                  tabIndex={0}
                  style={{ left: diffHandlePosition }}
                  onMouseDown={handleDiffResizeStart}
                  onTouchStart={handleDiffResizeStart}
                  onKeyDown={handleDiffResizeKeyDown}
                  onDoubleClick={resetDiffRatio}
                />
              </div>
            </div>
          ) : (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full flex-1 p-4 border border-gray-300 dark:border-gray-600 rounded-lg resize-none bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-200"
              placeholder="Your transcription text will appear here..."
              disabled={anyMutationPending}
            />
          )}
        </div>

        <div
          className={`editor-side-resize-handle${isPanelResizing ? ' is-active' : ''} mx-2`}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize side panel"
          aria-valuemin={SIDE_PANEL_MIN_WIDTH}
          aria-valuemax={SIDE_PANEL_MAX_WIDTH}
          aria-valuenow={panelWidthRounded}
          tabIndex={0}
          onMouseDown={handlePanelResizeStart}
          onTouchStart={handlePanelResizeStart}
          onKeyDown={handlePanelResizeKeyDown}
          onDoubleClick={resetPanelWidth}
        />

        <div className="flex flex-col min-h-0 ml-4 flex-shrink-0" style={sidePanelStyle}>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-2">
            <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">AI Editing Tools</h3>
              <div className="space-y-3">
                <div className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow">
                  <h4 className="font-bold text-md text-purple-600 dark:text-purple-400">Meaning & Context Editor</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Clarifies ambiguities and normalizes language.</p>
                  <button onClick={handleSemanticReconstruction} disabled={anyMutationPending || !!aiSuggestion} className="w-full px-3 py-2 text-sm text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:bg-purple-400">
                    {semanticReconstruction.isPending ? 'Processing...' : 'Semantic Reconstruction'}
                  </button>
                </div>
                <div className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow">
                  <h4 className="font-bold text-md text-teal-600 dark:text-teal-400">Style Editor</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Rewrite text to a specific style.</p>
                  <select
                    value={targetStyle}
                    onChange={e => setTargetStyle(e.target.value)}
                    disabled={anyMutationPending}
                    className="w-full mb-2 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50"
                    data-testid="style-select"
                  >
                    <option>General</option>
                    <option>Academic</option>
                    <option>Blog Post</option>
                    <option>Formal</option>
                  </select>
                  <button onClick={handleStyleGeneration} disabled={anyMutationPending} className="w-full px-3 py-2 text-sm text-white bg-teal-600 rounded-md hover:bg-teal-700 disabled:bg-teal-400">
                    {styleGeneration.isPending ? 'Processing...' : 'Generate Style'}
                  </button>
                </div>
                <div className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow">
                  <h4 className="font-bold text-md text-indigo-600 dark:text-indigo-400">Content Summarizer</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Summarize, find themes, and extract structure.</p>
                  <button onClick={handleNlpAnalysis} disabled={anyMutationPending} className="w-full px-3 py-2 text-sm text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-indigo-400">
                    {nlpAnalysis.isPending ? 'Processing...' : 'Analyze Content'}
                  </button>
                </div>
                <div className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow">
                  <h4 className="font-bold text-md text-red-600 dark:text-red-400">Fact Checker</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Verify facts, names, and terminology.</p>
                  <input type="text" placeholder="Domain (e.g. History)" value={factCheckDomain} onChange={e => setFactCheckDomain(e.target.value)} disabled={anyMutationPending} className="w-full mb-2 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50" />
                  <button onClick={handleFactChecking} disabled={anyMutationPending} className="w-full px-3 py-2 text-sm text-white bg-red-600 rounded-md hover:bg-red-700 disabled:bg-red-400">
                    {factChecking.isPending ? 'Processing...' : 'Check Facts'}
                  </button>
                </div>
                <div className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow">
                  <h4 className="font-bold text-md text-gray-600 dark:text-gray-400">Export with Template</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Export the current text using a custom template.</p>
                  <select
                    value={selectedTemplateId || ''}
                    onChange={e => setSelectedTemplateId(Number(e.target.value))}
                    disabled={anyMutationPending}
                    className="w-full mb-2 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50"
                    data-testid="export-template-select"
                  >
                    <option value="">Select a template...</option>
                    {exportTemplates?.map(template => (
                      <option key={template.id} value={template.id}>{template.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleExportWithTemplate}
                    disabled={anyMutationPending || !selectedTemplateId}
                    className="w-full px-3 py-2 text-sm text-white bg-gray-600 rounded-md hover:bg-gray-700 disabled:bg-gray-400"
                  >
                    Export
                  </button>
                </div>
                {analysisResult && (
                  <div className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-bold text-md text-gray-900 dark:text-gray-100">
                          {selectedAnalysisEntry?.title ?? 'Analysis Result'}
                        </h4>
                        {selectedAnalysisEntry?.metadata && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            Context: {selectedAnalysisEntry.metadata}
                          </p>
                        )}
                        {selectedAnalysisEntry?.isFallback && (
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                            Offline fallback result
                          </p>
                        )}
                        {selectedAnalysisEntry && (
                          <p className="text-[10px] text-gray-400 dark:text-gray-500">
                            Saved {new Date(selectedAnalysisEntry.createdAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <pre className="w-full text-xs bg-gray-100 dark:bg-gray-900 p-2 rounded overflow-x-auto">{analysisResult}</pre>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={handleClearAnalysisResult} className="px-3 py-1 text-xs text-white bg-gray-500 rounded-md hover:bg-gray-600">
                        Hide Result
                      </button>
                      {selectedAnalysisId && (
                        <button
                          onClick={() => handleSelectAnalysisEntry(selectedAnalysisId)}
                          className="px-3 py-1 text-xs text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
                        >
                          Refresh View
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {analysisHistory.length > 0 && (
                  <div className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold text-md text-gray-900 dark:text-gray-100">Analysis History</h4>
                      <button
                        onClick={handleClearAnalysisHistory}
                        className="text-xs text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white"
                      >
                        Clear All
                      </button>
                    </div>
                    <ul className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {analysisHistory.map(entry => {
                        const isActive = entry.id === selectedAnalysisId;
                        return (
                          <li key={entry.id}>
                            <button
                              onClick={() => handleSelectAnalysisEntry(entry.id)}
                              className={`w-full text-left px-3 py-2 rounded-md border transition ${
                                isActive
                                  ? 'bg-indigo-100 dark:bg-indigo-900/40 border-indigo-400 dark:border-indigo-500 text-indigo-900 dark:text-indigo-100'
                                  : 'bg-gray-100 dark:bg-gray-900 border-transparent hover:border-indigo-300 dark:hover:border-indigo-500 text-gray-700 dark:text-gray-200'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-medium truncate">{entry.title}</span>
                                <span className="text-[10px] text-gray-500 dark:text-gray-400 flex-shrink-0">
                                  {new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              {entry.metadata && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                  Context: {entry.metadata}
                                </p>
                              )}
                              {entry.isFallback && (
                                <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                                  Offline fallback
                                </p>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            </div>
            <div
              className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col"
              data-testid="version-history"
            >
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Version History</h3>
              <div className="space-y-2">
                {history.length > 0 ? (
                  history.slice().reverse().map((pastText, reverseIndex) => {
                    const originalIndex = history.length - 1 - reverseIndex;
                    return (
                      <div key={originalIndex} className="version-entry p-2 bg-white dark:bg-gray-800 rounded-lg shadow flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400 truncate pr-2">Version {originalIndex + 1}: {pastText.substring(0, 20)}...</span>
                        <button
                          onClick={() => handleRollback(originalIndex)}
                          className="px-2 py-1 text-xs text-white bg-blue-500 rounded-md hover:bg-blue-600 flex-shrink-0"
                        >
                          Rollback
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No saved versions yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
