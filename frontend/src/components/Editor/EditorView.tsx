import { useState, useEffect } from 'react';
import { useAIEditor } from '../../hooks/useAIEditor';

interface EditorViewProps {
  initialText: string;
  onClose: () => void;
  projectId: number;
}

export default function EditorView({ initialText, onClose, projectId }: EditorViewProps) {
  const [text, setText] = useState(initialText);
  const [targetStyle, setTargetStyle] = useState('General');
  const [factCheckDomain, setFactCheckDomain] = useState('');
  const [exportFormat, setExportFormat] = useState('SRT');
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);

  const {
    useSemanticReconstruction,
    useStyleGeneration,
    useNlpAnalysis,
    useFactChecking,
    useTechnicalCheck,
  } = useAIEditor(projectId);

  const semanticReconstruction = useSemanticReconstruction();
  const styleGeneration = useStyleGeneration();
  const nlpAnalysis = useNlpAnalysis();
  const factChecking = useFactChecking();
  const technicalCheck = useTechnicalCheck();

  useEffect(() => {
    if (semanticReconstruction.isSuccess) {
      setText(semanticReconstruction.data.result);
    }
  }, [semanticReconstruction.isSuccess, semanticReconstruction.data]);

  useEffect(() => {
    if (styleGeneration.isSuccess) {
      setText(styleGeneration.data.result);
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

  useEffect(() => {
    if (technicalCheck.isSuccess) {
        // For file export, we could show a download link or copy-to-clipboard button
        setAnalysisResult(technicalCheck.data.result);
    }
  }, [technicalCheck.isSuccess, technicalCheck.data]);


  const handleSemanticReconstruction = () => {
    semanticReconstruction.mutate(text);
  };

  const handleStyleGeneration = () => {
    styleGeneration.mutate({ text, target_style: targetStyle });
  };

  const handleNlpAnalysis = () => {
    nlpAnalysis.mutate(text);
  };

  const handleFactChecking = () => {
    if (!factCheckDomain) {
        alert("Please provide a domain for fact-checking.");
        return;
    }
    factChecking.mutate({ text, domain: factCheckDomain });
  };

  const handleTechnicalCheck = () => {
    // For technical check, we need text with metadata.
    // The current `text` state does not have it.
    // This is a simplification for now. In a real scenario, we'd need to pass segments with timestamps.
    // We will use the plain text for demonstration.
    technicalCheck.mutate({ text_with_metadata: text, target_format: exportFormat });
  };

  const anyMutationPending =
    semanticReconstruction.isPending ||
    styleGeneration.isPending ||
    nlpAnalysis.isPending ||
    factChecking.isPending ||
    technicalCheck.isPending;

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">AI Text Editor</h2>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
          >
            Close Editor
          </button>
        </div>
        <div className="flex-grow flex gap-6 min-h-0"> {/* Added min-h-0 to prevent flexbox overflow */}
          {/* Main Text Area */}
          <div className="flex-grow h-full flex flex-col">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full flex-grow p-4 border border-gray-300 dark:border-gray-600 rounded-lg resize-none bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-200"
              placeholder="Your transcription text will appear here..."
              disabled={anyMutationPending}
            />
          </div>

          {/* AI Tools Panel */}
          <div className="w-1/3 h-full bg-gray-100 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700 overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">AI Editing Tools</h3>
            <div className="space-y-3">
              {/* R4: Semantic Reconstructor */}
              <div className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow">
                <h4 className="font-bold text-md text-purple-600 dark:text-purple-400">Meaning & Context Editor</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Clarifies ambiguities and normalizes language.</p>
                <button
                  onClick={handleSemanticReconstruction}
                  disabled={anyMutationPending}
                  className="w-full px-3 py-2 text-sm text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:bg-purple-400"
                >
                  {semanticReconstruction.isPending ? 'Processing...' : 'Reconstruct Text'}
                </button>
              </div>

              {/* R5: Style Generator */}
              <div className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow">
                <h4 className="font-bold text-md text-teal-600 dark:text-teal-400">Style Editor</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Rewrite text to a specific style.</p>
                <select
                  value={targetStyle}
                  onChange={e => setTargetStyle(e.target.value)}
                  disabled={anyMutationPending}
                  className="w-full mb-2 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50"
                >
                  <option>General</option>
                  <option>Academic</option>
                  <option>Blog Post</option>
                  <option>Formal</option>
                </select>
                <button
                  onClick={handleStyleGeneration}
                  disabled={anyMutationPending}
                  className="w-full px-3 py-2 text-sm text-white bg-teal-600 rounded-md hover:bg-teal-700 disabled:bg-teal-400"
                >
                  {styleGeneration.isPending ? 'Processing...' : 'Generate Style'}
                </button>
              </div>

              {/* R6: NLP Analyzer */}
              <div className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow">
                <h4 className="font-bold text-md text-indigo-600 dark:text-indigo-400">Content Summarizer</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Summarize, find themes, and extract structure.</p>
                <button
                  onClick={handleNlpAnalysis}
                  disabled={anyMutationPending}
                  className="w-full px-3 py-2 text-sm text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-indigo-400"
                >
                  {nlpAnalysis.isPending ? 'Processing...' : 'Analyze Content'}
                </button>
              </div>

              {/* R7: Fact Checker */}
              <div className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow">
                <h4 className="font-bold text-md text-red-600 dark:text-red-400">Fact Checker</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Verify facts, names, and terminology.</p>
                <input
                  type="text"
                  placeholder="Domain (e.g. History)"
                  value={factCheckDomain}
                  onChange={e => setFactCheckDomain(e.target.value)}
                  disabled={anyMutationPending}
                  className="w-full mb-2 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50"
                />
                <button
                  onClick={handleFactChecking}
                  disabled={anyMutationPending}
                  className="w-full px-3 py-2 text-sm text-white bg-red-600 rounded-md hover:bg-red-700 disabled:bg-red-400"
                >
                  {factChecking.isPending ? 'Processing...' : 'Check Facts'}
                </button>
              </div>

              {/* R8: Technical Checker */}
              <div className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow">
                <h4 className="font-bold text-md text-gray-600 dark:text-gray-400">Format Exporter</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Generate formatted files like .srt or .vtt.</p>
                <select
                  value={exportFormat}
                  onChange={e => setExportFormat(e.target.value)}
                  disabled={anyMutationPending}
                  className="w-full mb-2 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50"
                >
                  <option>SRT</option>
                  <option>VTT</option>
                </select>
                <button
                  onClick={handleTechnicalCheck}
                  disabled={anyMutationPending}
                  className="w-full px-3 py-2 text-sm text-white bg-gray-600 rounded-md hover:bg-gray-700 disabled:bg-gray-400"
                >
                  {technicalCheck.isPending ? 'Processing...' : 'Export'}
                </button>
              </div>

              {/* Analysis Result Area */}
              {(nlpAnalysis.isSuccess || factChecking.isSuccess || technicalCheck.isSuccess) && analysisResult && (
                <div className="mt-4 p-3 bg-white dark:bg-gray-800 rounded-lg shadow">
                    <h4 className="font-bold text-md mb-2">Analysis Result</h4>
                    <pre className="w-full text-xs bg-gray-100 dark:bg-gray-900 p-2 rounded overflow-x-auto">
                        {analysisResult}
                    </pre>
                     <button
                        onClick={() => setAnalysisResult(null)}
                        className="w-full mt-2 px-3 py-1 text-xs text-white bg-gray-500 rounded-md hover:bg-gray-600"
                    >
                        Clear Result
                    </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}