import React from 'react';
import { Modal } from './ui/Modal';
import { type KeyboardShortcut, formatShortcut } from '../hooks/useKeyboardShortcuts';

interface KeyboardHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  shortcuts: KeyboardShortcut[];
}

const KeyboardHelpModal: React.FC<KeyboardHelpModalProps> = ({ isOpen, onClose, shortcuts }) => {
  // Group shortcuts by category
  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    // Extract category from description (e.g., "Audio: Play/Pause" -> "Audio")
    const match = shortcut.description.match(/^([^:]+):/);
    const category = match ? match[1].trim() : 'General';

    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(shortcut);
    return acc;
  }, {} as Record<string, KeyboardShortcut[]>);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Keyboard Shortcuts"
      description="Use these keyboard shortcuts to navigate and control the app"
      size="lg"
    >
      <div className="space-y-6">
        {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
          <div key={category}>
            <h3 className="text-lg font-semibold mb-3 text-foreground">{category}</h3>
            <div className="space-y-2">
              {categoryShortcuts.map((shortcut, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted transition-smooth"
                >
                  <span className="text-sm text-foreground">
                    {shortcut.description.replace(/^[^:]+:\s*/, '')}
                  </span>
                  <kbd className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold bg-secondary-100 text-secondary-900 dark:bg-secondary-800 dark:text-secondary-100 border border-border rounded">
                    {formatShortcut(shortcut)}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground">
            <strong>Tip:</strong> Press <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-secondary-100 text-secondary-900 dark:bg-secondary-800 dark:text-secondary-100 border border-border rounded">?</kbd> anytime to view this help
          </p>
        </div>
      </div>
    </Modal>
  );
};

export default KeyboardHelpModal;
