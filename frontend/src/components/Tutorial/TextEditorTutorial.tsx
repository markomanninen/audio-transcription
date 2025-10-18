import { useState } from 'react';
import { Button } from '../ui/Button';

interface TutorialStep {
  title: string;
  description: string;
  action?: string;
  visual: string;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: 'Welcome to the AI Text Editor ✨',
    description:
      'Transform raw transcripts or drafts into polished narratives. We will walk through project setup, AI tools, and version control in a few quick steps.',
    visual: '📖',
  },
  {
    title: 'Step 1: Create a Text Project',
    description:
      "Organize each document as a project. Click the 'New Text Project' button to create one, optionally seeding it with starter content.",
    action: "Click 'New Text Project'",
    visual: '🧰',
  },
  {
    title: 'Step 2: Write or Paste Drafts',
    description:
      'Use the central editor canvas to draft or paste content. Everything auto-saves as you work, and you can capture milestones with Saved Versions.',
    action: 'Start typing in the editor canvas',
    visual: '⌨️',
  },
  {
    title: 'Step 3: Use AI Tools',
    description:
      'Try Semantic Reconstruction for clarity, Style Generation for voice changes, and NLP Analysis for themes. Each tool logs to the LLM console for review.',
    action: 'Trigger an AI tool from the sidebar',
    visual: '🤖',
  },
  {
    title: 'Step 4: Compare & Approve Suggestions',
    description:
      'AI suggestions appear side-by-side. Approve, reject, or roll back to previous versions at any time—your original text is always preserved.',
    action: 'Review the diff viewer controls',
    visual: '🪞',
  },
  {
    title: 'Step 5: Export with Templates',
    description:
      'Use export templates for reports, social posts, or newsletters. Templates live under Settings → Export Templates and are available from the editor.',
    action: 'Open Settings → Export Templates',
    visual: '📦',
  },
  {
    title: 'You’re ready to create! 🚀',
    description:
      'Keep an eye on the top menu for quick navigation, tutorials, and LLM logs. Happy writing!',
    visual: '🎉',
  },
];

interface TextEditorTutorialProps {
  onComplete: () => void;
  onSkip: () => void;
}

export default function TextEditorTutorial({ onComplete, onSkip }: TextEditorTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const step = TUTORIAL_STEPS[currentStep];
  const isLastStep = currentStep === TUTORIAL_STEPS.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
        <div className="h-2 bg-muted">
          <div
            className="h-full bg-primary-600 transition-all duration-300"
            style={{ width: `${((currentStep + 1) / TUTORIAL_STEPS.length) * 100}%` }}
          />
        </div>

        <div className="p-8">
          <div className="mb-4 text-xs font-medium text-muted-foreground">
            Step {currentStep + 1} of {TUTORIAL_STEPS.length}
          </div>

          <div className="mb-6 text-center text-6xl">{step.visual}</div>
          <h2 className="mb-4 text-center text-2xl font-bold">{step.title}</h2>
          <p className="mb-6 whitespace-pre-line text-center leading-relaxed text-muted-foreground">
            {step.description}
          </p>

          {step.action && (
            <div className="mb-6 rounded-lg border border-primary-200 bg-primary-50 p-4 dark:border-primary-800 dark:bg-primary-950/20">
              <div className="flex items-start gap-3">
                <span className="text-xl">👉</span>
                <div>
                  <div className="mb-1 text-sm font-medium">What to do next:</div>
                  <div className="text-sm">{step.action}</div>
                </div>
              </div>
            </div>
          )}

          <div className="mb-6 flex justify-center gap-2">
            {TUTORIAL_STEPS.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={`h-2 rounded-full transition-all ${index === currentStep ? 'w-8 bg-primary-600' : index < currentStep ? 'w-2 bg-primary-400' : 'w-2 bg-muted'}`}
                aria-label={`Go to step ${index + 1}`}
              />
            ))}
          </div>

          <div className="flex items-center justify-between gap-4">
            <Button variant="ghost" onClick={onSkip} className="text-muted-foreground">
              Skip Tutorial
            </Button>
            <div className="flex gap-2">
              {currentStep > 0 && (
                <Button variant="outline" onClick={handlePrevious}>
                  ← Previous
                </Button>
              )}
              <Button variant="primary" onClick={handleNext}>
                {isLastStep ? 'Start Writing 🚀' : 'Next →'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
