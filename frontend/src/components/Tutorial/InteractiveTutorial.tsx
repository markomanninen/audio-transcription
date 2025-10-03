import { useState } from 'react'
import { Button } from '../ui/Button'

interface TutorialStep {
  title: string
  description: string
  action?: string
  visual: string
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: "Welcome to Audio Transcription! 🎙️",
    description: "This tool helps you transcribe audio files with AI-powered speaker recognition and smart editing. Let's get you started in just 5 steps.",
    visual: "🎯",
  },
  {
    title: "Step 1: Create a Project",
    description: "Projects help you organize related transcriptions (e.g., 'Interview Series', 'Podcast Episodes'). Click the 'New Project' button in the header to create your first project.",
    action: "Click 'New Project' in the top-right corner",
    visual: "📁",
  },
  {
    title: "Step 2: Choose Language",
    description: "Before uploading, select the transcription language from the dropdown. Choose 'Auto-detect' (default) to let AI figure it out, or select a specific language like Finnish, Swedish, or English for better accuracy.",
    action: "Select language from the dropdown above the upload area",
    visual: "🌍",
  },
  {
    title: "Step 3: Upload Audio File",
    description: "Drag and drop your audio file (MP3, WAV, M4A, etc.) or click to browse. Supported formats: MP3, WAV, M4A, WebM, OGG, FLAC. Maximum file size: 500MB.",
    action: "Drop your audio file in the upload box",
    visual: "📤",
  },
  {
    title: "Step 4: Start Transcription",
    description: "After uploading, click the 'Transcribe' button next to your file. The AI will process your audio (typically 1-3 minutes for a 3-minute audio). You'll see real-time progress updates.",
    action: "Click 'Transcribe' on your uploaded file",
    visual: "⚙️",
  },
  {
    title: "Step 5: Edit & Export",
    description: "Once complete, you can:\n• Click any segment to play from that point\n• Edit text by clicking the ✏️ button\n• Get AI suggestions with the ✨ button\n• Rename speakers\n• Export to SRT, HTML, or TXT",
    action: "Try editing and exporting your transcription",
    visual: "✨",
  },
  {
    title: "You're All Set! 🎉",
    description: "That's it! You now know how to transcribe audio files. The System Status (top-right) shows if all components are working. Need help? Check the troubleshooting section in the README.",
    visual: "🚀",
  },
]

interface InteractiveTutorialProps {
  onComplete: () => void
  onSkip: () => void
}

export default function InteractiveTutorial({ onComplete, onSkip }: InteractiveTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const step = TUTORIAL_STEPS[currentStep]
  const isLastStep = currentStep === TUTORIAL_STEPS.length - 1

  const handleNext = () => {
    if (isLastStep) {
      onComplete()
    } else {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-lg shadow-2xl max-w-2xl w-full overflow-hidden">
        {/* Progress Bar */}
        <div className="h-2 bg-muted">
          <div
            className="h-full bg-primary-600 transition-all duration-300"
            style={{ width: `${((currentStep + 1) / TUTORIAL_STEPS.length) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-8">
          {/* Step Indicator */}
          <div className="text-xs font-medium text-muted-foreground mb-4">
            Step {currentStep + 1} of {TUTORIAL_STEPS.length}
          </div>

          {/* Visual Icon */}
          <div className="text-6xl text-center mb-6">{step.visual}</div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-center mb-4">{step.title}</h2>

          {/* Description */}
          <p className="text-muted-foreground text-center mb-6 whitespace-pre-line leading-relaxed">
            {step.description}
          </p>

          {/* Action Callout */}
          {step.action && (
            <div className="bg-primary-50 dark:bg-primary-950/20 border border-primary-200 dark:border-primary-800 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <span className="text-xl">👉</span>
                <div>
                  <div className="font-medium text-sm mb-1">What to do next:</div>
                  <div className="text-sm">{step.action}</div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Dots */}
          <div className="flex justify-center gap-2 mb-6">
            {TUTORIAL_STEPS.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentStep
                    ? 'bg-primary-600 w-8'
                    : index < currentStep
                    ? 'bg-primary-400'
                    : 'bg-muted'
                }`}
                aria-label={`Go to step ${index + 1}`}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-between gap-4">
            <Button
              variant="ghost"
              onClick={onSkip}
              className="text-muted-foreground"
            >
              Skip Tutorial
            </Button>

            <div className="flex gap-2">
              {currentStep > 0 && (
                <Button variant="outline" onClick={handlePrevious}>
                  ← Previous
                </Button>
              )}
              <Button variant="primary" onClick={handleNext}>
                {isLastStep ? "Get Started! 🚀" : "Next →"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
