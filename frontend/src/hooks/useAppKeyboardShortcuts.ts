import { useState } from 'react'
import { useKeyboardShortcuts, type KeyboardShortcut } from './useKeyboardShortcuts';

interface UseAppKeyboardShortcutsProps {
  onPlayPause?: () => void;
  onSkipForward?: () => void;
  onSkipBackward?: () => void;
  onNextSegment?: () => void;
  onPreviousSegment?: () => void;
  onEditSegment?: () => void;
  onSaveEdit?: () => void;
  onSave?: () => void;
  enabled?: boolean;
}

export const useAppKeyboardShortcuts = ({
  onPlayPause,
  onSkipForward,
  onSkipBackward,
  onNextSegment,
  onPreviousSegment,
  onEditSegment,
  onSaveEdit,
  onSave,
  enabled = true,
}: UseAppKeyboardShortcutsProps) => {
  const [showHelpModal, setShowHelpModal] = useState(false);

  const shortcuts: KeyboardShortcut[] = [
    {
      key: ' ',
      description: 'Audio: Play/Pause',
      action: () => onPlayPause?.(),
      enabled: !!onPlayPause,
    },
    {
      key: 'ArrowRight',
      description: 'Audio: Skip forward 5s',
      action: () => onSkipForward?.(),
      enabled: !!onSkipForward,
    },
    {
      key: 'ArrowLeft',
      description: 'Audio: Skip backward 5s',
      action: () => onSkipBackward?.(),
      enabled: !!onSkipBackward,
    },
    {
      key: 'ArrowDown',
      description: 'Navigation: Next segment',
      action: () => onNextSegment?.(),
      enabled: !!onNextSegment,
    },
    {
      key: 'ArrowUp',
      description: 'Navigation: Previous segment',
      action: () => onPreviousSegment?.(),
      enabled: !!onPreviousSegment,
    },
    {
      key: 'e',
      description: 'Editing: Edit focused segment',
      action: () => onEditSegment?.(),
      enabled: !!onEditSegment,
    },
    {
      key: 'Enter',
      ctrl: true,
      description: 'Editing: Save current edit',
      action: () => onSaveEdit?.(),
      enabled: !!onSaveEdit,
    },
    {
      key: 's',
      ctrl: true,
      description: 'General: Save',
      action: () => onSave?.(),
      enabled: !!onSave,
    },
    {
      key: '?',
      description: 'General: Show keyboard shortcuts',
      action: () => setShowHelpModal(true),
      enabled: true,
    },
    {
      key: 'Escape',
      description: 'General: Close modal/cancel',
      action: () => setShowHelpModal(false),
      enabled: showHelpModal,
    },
  ];

  useKeyboardShortcuts({ shortcuts, enabled });

  return {
    shortcuts,
    showHelpModal,
    setShowHelpModal,
  };
};
