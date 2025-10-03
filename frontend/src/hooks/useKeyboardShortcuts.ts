import { useEffect, useCallback, useRef } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  description: string;
  action: () => void;
  enabled?: boolean;
}

interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
}

export const useKeyboardShortcuts = ({ shortcuts, enabled = true }: UseKeyboardShortcutsOptions) => {
  const shortcutsRef = useRef(shortcuts);

  // Update ref when shortcuts change
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const target = event.target as HTMLElement;

    // Don't trigger shortcuts when typing in inputs, textareas, or content-editable elements
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      return;
    }

    shortcutsRef.current.forEach((shortcut) => {
      if (shortcut.enabled === false) return;

      const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
      const ctrlMatches = !!shortcut.ctrl === (event.ctrlKey || event.metaKey);
      const shiftMatches = !!shortcut.shift === event.shiftKey;
      const altMatches = !!shortcut.alt === event.altKey;
      const metaMatches = !!shortcut.meta === event.metaKey;

      if (keyMatches && ctrlMatches && shiftMatches && altMatches && metaMatches) {
        event.preventDefault();
        shortcut.action();
      }
    });
  }, []);

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);
};

export const formatShortcut = (shortcut: KeyboardShortcut): string => {
  const parts: string[] = [];
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

  if (shortcut.ctrl) {
    parts.push(isMac ? '⌘' : 'Ctrl');
  }
  if (shortcut.shift) {
    parts.push(isMac ? '⇧' : 'Shift');
  }
  if (shortcut.alt) {
    parts.push(isMac ? '⌥' : 'Alt');
  }
  if (shortcut.meta && !isMac) {
    parts.push('Meta');
  }

  // Format key name
  const keyName = shortcut.key.length === 1
    ? shortcut.key.toUpperCase()
    : shortcut.key === ' '
    ? 'Space'
    : shortcut.key.charAt(0).toUpperCase() + shortcut.key.slice(1);

  parts.push(keyName);

  return parts.join(isMac ? '' : '+');
};
