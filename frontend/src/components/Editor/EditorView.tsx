import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAIEditor } from '../../hooks/useAIEditor';
import { useExportTemplates } from '../../hooks/useExportTemplates';
import ReactDiffViewer from '@alexbruf/react-diff-viewer';
import '@alexbruf/react-diff-viewer/index.css';

interface EditorViewProps {
  initialText: string;
  projectId: number;
}

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

  const { data: exportTemplates } = useExportTemplates();

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
    if (nlpAnalysis.isSuccess) {
      setAnalysisResult(JSON.stringify(nlpAnalysis.data, null, 2));
    }
  }, [nlpAnalysis.isSuccess, nlpAnalysis.data]);

  useEffect(() => {
    if (factChecking.isSuccess) {
      setAnalysisResult(JSON.stringify(factChecking.data, null, 2));
    }
  }, [factChecking.isSuccess, factChecking.data]);

  const handleSemanticReconstruction = () => semanticReconstruction.mutate(text);
  const handleStyleGeneration = () => styleGeneration.mutate({ text, target_style: targetStyle });
  const handleNlpAnalysis = () => nlpAnalysis.mutate(text);
  const handleFactChecking = () => {
    if (!factCheckDomain) {
      alert("Please provide a domain for fact-checking.");
      return;
    }
    factChecking.mutate({ text, domain: factCheckDomain });
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
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">AI Text Editor</h2>
          <button
            onClick={handleSaveVersion}
            disabled={text === draft}
            className="px-3 py-1 text-sm text-white bg-gray-600 rounded-md hover:bg-gray-700 disabled:bg-gray-400"
          >
            Save Manual Changes
          </button>
        </div>
        <Link
          to="/"
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          Back to Dashboard
        </Link>
      </div>
      <div className="flex-grow flex gap-6 min-h-0">
        <div className="flex-grow h-full flex flex-col">
          {aiSuggestion ? (
            <div className="flex-grow flex flex-col border border-gray-300 dark:border-gray-600 rounded-lg">
              <div className="flex justify-between items-center p-2 bg-gray-100 dark:bg-gray-900 border-b dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">AI Suggestion</h3>
                <div className="flex gap-2">
                  <button onClick={handleApproveSuggestion} className="px-3 py-1 text-sm text-white bg-green-600 rounded-md hover:bg-green-700">Approve</button>
                  <button onClick={handleRejectSuggestion} className="px-3 py-1 text-sm text-white bg-red-600 rounded-md hover:bg-red-700">Reject</button>
                </div>
              </div>
              <div className="flex-grow overflow-auto">
                <ReactDiffViewer oldValue={text} newValue={aiSuggestion} splitView={true} useDarkTheme={isDarkTheme} leftTitle="Current Text" rightTitle="AI Suggestion" />
              </div>
            </div>
          ) : (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full flex-grow p-4 border border-gray-300 dark:border-gray-600 rounded-lg resize-none bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-200"
              placeholder="Your transcription text will appear here..."
              disabled={anyMutationPending}
            />
          )}
        </div>

        <div className="w-1/3 h-full flex flex-col gap-4">
          <div className="flex-shrink-0 bg-gray-100 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700 overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">AI Editing Tools</h3>
            <div className="space-y-3">
              <div className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow">
                <h4 className="font-bold text-md text-purple-600 dark:text-purple-400">Meaning & Context Editor</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Clarifies ambiguities and normalizes language.</p>
                <button onClick={handleSemanticReconstruction} disabled={anyMutationPending || !!aiSuggestion} className="w-full px-3 py-2 text-sm text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:bg-purple-400">
                  {semanticReconstruction.isPending ? 'Processing...' : 'Reconstruct Text'}
                </button>
              </div>
              <div className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow">
                <h4 className="font-bold text-md text-teal-600 dark:text-teal-400">Style Editor</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Rewrite text to a specific style.</p>
                <select value={targetStyle} onChange={e => setTargetStyle(e.target.value)} disabled={anyMutationPending || !!aiSuggestion} className="w-full mb-2 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50">
                  <option>General</option>
                  <option>Academic</option>
                  <option>Blog Post</option>
                  <option>Formal</option>
                </select>
                <button onClick={handleStyleGeneration} disabled={anyMutationPending || !!aiSuggestion} className="w-full px-3 py-2 text-sm text-white bg-teal-600 rounded-md hover:bg-teal-700 disabled:bg-teal-400">
                  {styleGeneration.isPending ? 'Processing...' : 'Generate Style'}
                </button>
              </div>
              <div className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow">
                <h4 className="font-bold text-md text-indigo-600 dark:text-indigo-400">Content Summarizer</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Summarize, find themes, and extract structure.</p>
                <button onClick={handleNlpAnalysis} disabled={anyMutationPending || !!aiSuggestion} className="w-full px-3 py-2 text-sm text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-indigo-400">
                  {nlpAnalysis.isPending ? 'Processing...' : 'Analyze Content'}
                </button>
              </div>
              <div className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow">
                <h4 className="font-bold text-md text-red-600 dark:text-red-400">Fact Checker</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Verify facts, names, and terminology.</p>
                <input type="text" placeholder="Domain (e.g. History)" value={factCheckDomain} onChange={e => setFactCheckDomain(e.target.value)} disabled={anyMutationPending || !!aiSuggestion} className="w-full mb-2 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50" />
                <button onClick={handleFactChecking} disabled={anyMutationPending || !!aiSuggestion} className="w-full px-3 py-2 text-sm text-white bg-red-600 rounded-md hover:bg-red-700 disabled:bg-red-400">
                  {factChecking.isPending ? 'Processing...' : 'Check Facts'}
                </button>
              </div>
              <div className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow">
                <h4 className="font-bold text-md text-gray-600 dark:text-gray-400">Export with Template</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Export the current text using a custom template.</p>
                <select
                  value={selectedTemplateId || ''}
                  onChange={e => setSelectedTemplateId(Number(e.target.value))}
                  disabled={anyMutationPending || !!aiSuggestion}
                  className="w-full mb-2 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50"
                >
                  <option value="">Select a template...</option>
                  {exportTemplates?.map(template => (
                    <option key={template.id} value={template.id}>{template.name}</option>
                  ))}
                </select>
                <button
                  onClick={handleExportWithTemplate}
                  disabled={anyMutationPending || !!aiSuggestion || !selectedTemplateId}
                  className="w-full px-3 py-2 text-sm text-white bg-gray-600 rounded-md hover:bg-gray-700 disabled:bg-gray-400"
                >
                  Export
                </button>
              </div>
              {analysisResult && (
                <div className="mt-4 p-3 bg-white dark:bg-gray-800 rounded-lg shadow">
                    <h4 className="font-bold text-md mb-2">Analysis Result</h4>
                    <pre className="w-full text-xs bg-gray-100 dark:bg-gray-900 p-2 rounded overflow-x-auto">{analysisResult}</pre>
                     <button onClick={() => setAnalysisResult(null)} className="w-full mt-2 px-3 py-1 text-xs text-white bg-gray-500 rounded-md hover:bg-gray-600">Clear Result</button>
                </div>
              )}
            </div>
          </div>
          <div className="flex-grow bg-gray-100 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700 overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Edit History</h3>
            <div className="space-y-2">
              {history.length > 0 ? (
                history.slice().reverse().map((pastText, reverseIndex) => {
                  const originalIndex = history.length - 1 - reverseIndex;
                  return (
                    <div key={originalIndex} className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow flex justify-between items-center">
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
  );
}