# Keyboard Shortcuts Documentation

## Overview

The application includes a comprehensive keyboard shortcuts system that enables power users to navigate and control the app efficiently using keyboard-only input.

## Available Shortcuts

### Audio Controls

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Space` | Play/Pause | Toggle audio playback |
| `→` (Right Arrow) | Skip forward | Skip 5 seconds forward in audio |
| `←` (Left Arrow) | Skip backward | Skip 5 seconds backward in audio |

### Navigation

| Shortcut | Action | Description |
|----------|--------|-------------|
| `↓` (Down Arrow) | Next segment | Navigate to next transcription segment |
| `↑` (Up Arrow) | Previous segment | Navigate to previous transcription segment |

### Editing

| Shortcut | Action | Description |
|----------|--------|-------------|
| `E` | Edit segment | Start editing the focused segment |
| `Ctrl+Enter` (Windows/Linux)<br>`Cmd+Enter` (Mac) | Save edit | Save the current edit |
| `Esc` | Cancel | Cancel current edit or close modal |

### General

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+S` (Windows/Linux)<br>`Cmd+S` (Mac) | Save | Save current state |
| `?` | Show help | Display keyboard shortcuts help modal |

## Implementation

### Using the Keyboard Shortcuts Hook

```tsx
import { useKeyboardShortcuts, type KeyboardShortcut } from '@/hooks/useKeyboardShortcuts';

const shortcuts: KeyboardShortcut[] = [
  {
    key: ' ',
    description: 'Audio: Play/Pause',
    action: () => handlePlayPause(),
    enabled: true,
  },
  {
    key: 's',
    ctrl: true,
    description: 'General: Save',
    action: () => handleSave(),
    enabled: true,
  },
];

useKeyboardShortcuts({ shortcuts, enabled: true });
```

### Keyboard Shortcut Interface

```ts
export interface KeyboardShortcut {
  key: string;           // The key to listen for
  ctrl?: boolean;        // Requires Ctrl (or Cmd on Mac)
  shift?: boolean;       // Requires Shift
  alt?: boolean;         // Requires Alt (or Option on Mac)
  meta?: boolean;        // Requires Meta (Cmd on Mac)
  description: string;   // Description for help modal
  action: () => void;    // Function to execute
  enabled?: boolean;     // Whether the shortcut is active
}
```

### App-level Shortcuts Hook

The `useAppKeyboardShortcuts` hook provides pre-configured shortcuts for common app actions:

```tsx
import { useAppKeyboardShortcuts } from '@/hooks/useAppKeyboardShortcuts';

const {
  shortcuts,
  showHelpModal,
  setShowHelpModal
} = useAppKeyboardShortcuts({
  onPlayPause: handlePlayPause,
  onSkipForward: skipForward,
  onSkipBackward: skipBackward,
  onNextSegment: nextSegment,
  onPreviousSegment: prevSegment,
  onEditSegment: editSegment,
  onSaveEdit: saveEdit,
  onSave: save,
  isAudioPlaying: isPlaying,
  enabled: true,
});
```

### Keyboard Help Modal

The `KeyboardHelpModal` component displays all available shortcuts in a user-friendly modal:

```tsx
import KeyboardHelpModal from '@/components/KeyboardHelpModal';

<KeyboardHelpModal
  isOpen={showHelpModal}
  onClose={() => setShowHelpModal(false)}
  shortcuts={shortcuts}
/>
```

## Features

### Automatic Shortcut Formatting

The `formatShortcut()` utility automatically formats shortcuts for display, with platform-specific symbols:

**macOS:**
- `⌘` for Cmd
- `⇧` for Shift
- `⌥` for Option (Alt)

**Windows/Linux:**
- `Ctrl` for Control
- `Shift` for Shift
- `Alt` for Alt

```tsx
import { formatShortcut } from '@/hooks/useKeyboardShortcuts';

const shortcut = { key: 's', ctrl: true, description: 'Save' };
formatShortcut(shortcut); // Returns "⌘S" on Mac, "Ctrl+S" on Windows/Linux
```

### Input Field Detection

Shortcuts are automatically disabled when typing in input fields, textareas, or content-editable elements to prevent conflicts:

```ts
// Shortcuts won't trigger when typing in these elements:
- <input>
- <textarea>
- Elements with contenteditable="true"
```

### Conditional Shortcuts

Shortcuts can be dynamically enabled/disabled:

```tsx
const shortcuts: KeyboardShortcut[] = [
  {
    key: 'e',
    description: 'Edit segment',
    action: () => editSegment(),
    enabled: !!selectedSegment, // Only enabled when segment is selected
  },
];
```

### Grouped Help Display

The help modal automatically groups shortcuts by category based on their description:

```tsx
// Shortcuts with "Audio:" prefix are grouped under "Audio"
{ key: ' ', description: 'Audio: Play/Pause', ... }
{ key: '→', description: 'Audio: Skip forward', ... }

// Shortcuts with "Editing:" prefix are grouped under "Editing"
{ key: 'e', description: 'Editing: Edit segment', ... }
```

## Best Practices

### 1. Use Descriptive Categories

Group related shortcuts using category prefixes in descriptions:

```tsx
// ✅ Good
{ description: 'Audio: Play/Pause', ... }
{ description: 'Audio: Skip forward', ... }

// ❌ Bad
{ description: 'Play/Pause', ... }
{ description: 'Skip forward', ... }
```

### 2. Avoid Conflicts

Check for conflicts with browser shortcuts:

```tsx
// ⚠️ These may conflict with browser defaults:
- Ctrl+T (new tab)
- Ctrl+W (close tab)
- Ctrl+N (new window)
- Ctrl+R (refresh)

// ✅ Safe shortcuts:
- Ctrl+S (often overridable)
- Ctrl+K
- Ctrl+J
- Single letters (e, ?, etc.)
```

### 3. Provide Visual Feedback

Show visual feedback when shortcuts are triggered:

```tsx
const handlePlayPause = () => {
  togglePlay();
  toast.success('Audio ' + (isPlaying ? 'paused' : 'playing'));
};
```

### 4. Document Custom Shortcuts

Always add custom shortcuts to the help modal:

```tsx
// ✅ Good - Shortcut will appear in help
{
  key: 'k',
  ctrl: true,
  description: 'Navigation: Open search',
  action: openSearch,
}

// ❌ Bad - Undiscoverable shortcut
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'k') openSearch();
});
```

### 5. Handle Edge Cases

Consider different keyboard layouts and accessibility:

```tsx
// ✅ Good - Use key names, not symbols
{ key: '/', ... }  // Works on all layouts

// ❌ Bad - Symbol-dependent
{ key: '?', shift: true, ... }  // May not work on all layouts
```

## Accessibility Considerations

### Keyboard-Only Navigation

Ensure all interactive elements are accessible via keyboard:

```tsx
// All buttons should be focusable
<button className="focus-ring" onClick={handleClick}>
  Click me
</button>

// Custom interactive elements need tabindex
<div role="button" tabIndex={0} onClick={handleClick} onKeyDown={handleKeyDown}>
  Custom button
</div>
```

### Skip Links

Provide skip navigation for keyboard users:

```tsx
<a href="#main-content" className="sr-only focus:not-sr-only">
  Skip to main content
</a>
```

### Focus Management

Manage focus appropriately when using shortcuts:

```tsx
const handleEditSegment = () => {
  setEditingSegmentId(segmentId);
  // Focus the edit input after state update
  setTimeout(() => {
    document.getElementById('segment-edit-input')?.focus();
  }, 0);
};
```

## Testing

### Unit Tests

```tsx
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

it('triggers shortcut on key press', () => {
  const action = vi.fn();
  const shortcuts = [{ key: 's', ctrl: true, description: 'Save', action }];

  renderHook(() => useKeyboardShortcuts({ shortcuts }));

  // Simulate Ctrl+S
  window.dispatchEvent(new KeyboardEvent('keydown', {
    key: 's',
    ctrlKey: true,
  }));

  expect(action).toHaveBeenCalledTimes(1);
});
```

### E2E Tests

```ts
// Playwright example
test('keyboard shortcuts work correctly', async ({ page }) => {
  await page.goto('/');

  // Press Space to play audio
  await page.keyboard.press('Space');
  await expect(page.getByLabel('Pause')).toBeVisible();

  // Press ? to open help
  await page.keyboard.press('?');
  await expect(page.getByRole('dialog')).toContainText('Keyboard Shortcuts');
});
```

## Troubleshooting

### Shortcuts Not Working

1. **Check if element has focus:**
   - Shortcuts are disabled when typing in inputs
   - Ensure the page/component has focus

2. **Check enabled state:**
   ```tsx
   {
     key: 's',
     action: save,
     enabled: canSave, // Must be true
   }
   ```

3. **Check for conflicts:**
   - Browser extensions may intercept shortcuts
   - Check browser console for errors

### Platform-Specific Issues

**Mac:**
- Use `metaKey` instead of `ctrlKey` for Cmd shortcuts
- The hook automatically handles this with `ctrl` option

**Linux:**
- Some window managers intercept certain shortcuts
- Consider alternative shortcuts for these cases

## Future Enhancements

Potential improvements for the keyboard shortcuts system:

1. **Customizable Shortcuts**
   - Allow users to customize keyboard shortcuts
   - Store preferences in localStorage

2. **Shortcut Sequences**
   - Support for multi-key sequences (e.g., "g" then "h" for home)

3. **Shortcut Conflicts Detection**
   - Warn developers about conflicting shortcuts

4. **Shortcut Recording**
   - UI for recording custom shortcuts

5. **Global vs Local Shortcuts**
   - Different shortcuts for different contexts/pages

## References

- [Web Keyboard Shortcuts Best Practices](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)
- [ARIA Keyboard Patterns](https://www.w3.org/WAI/ARIA/apg/patterns/)
- [MDN KeyboardEvent](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent)
