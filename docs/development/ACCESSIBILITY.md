# Accessibility Guidelines

## Overview

This document outlines the accessibility standards and practices for the Audio Transcription application, ensuring the app is usable by people with disabilities and complies with WCAG 2.1 AA standards.

## WCAG 2.1 AA Compliance

### Level AA Requirements

The application aims to meet all WCAG 2.1 Level AA success criteria:

1. **Perceivable** - Information must be presented in ways users can perceive
2. **Operable** - Interface components must be operable
3. **Understandable** - Information and operation must be understandable
4. **Robust** - Content must be robust enough to work with assistive technologies

## Color and Contrast

### Contrast Ratios

All text and interactive elements meet minimum contrast requirements:

| Element Type | Minimum Ratio | Our Standard |
|--------------|---------------|--------------|
| Normal text (< 18px) | 4.5:1 | 4.5:1+ |
| Large text (≥ 18px or 14px bold) | 3:1 | 4.5:1+ |
| UI components | 3:1 | 3:1+ |
| Focus indicators | 3:1 | 3:1+ |

### Color Usage

- ✅ Never use color alone to convey information
- ✅ Provide text labels alongside color indicators
- ✅ Use patterns or icons in addition to colors

```tsx
// ✅ Good - Uses both color and text
<div className="bg-green-100 text-green-900">
  <CheckIcon aria-hidden="true" />
  <span>Success: Operation completed</span>
</div>

// ❌ Bad - Color only
<div className="bg-green-100" />
```

### Dark Mode Accessibility

- All contrast ratios maintained in dark mode
- Semantic color tokens adapt automatically
- Focus indicators visible in both themes

## Keyboard Navigation

### Focus Management

All interactive elements must be keyboard accessible:

```tsx
// ✅ Good - Native button with focus styles
<button className="focus-ring" onClick={handleClick}>
  Click me
</button>

// ✅ Good - Custom interactive element with proper ARIA
<div
  role="button"
  tabIndex={0}
  className="focus-ring"
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleClick();
    }
  }}
>
  Custom button
</div>
```

### Focus Order

Logical tab order matches visual layout:

```tsx
// ✅ Good - Logical order
<form>
  <input name="name" />      {/* Tab 1 */}
  <input name="email" />     {/* Tab 2 */}
  <button type="submit">     {/* Tab 3 */}
    Submit
  </button>
</form>

// ❌ Bad - Illogical order with tabindex
<form>
  <input name="name" tabIndex={2} />
  <button type="submit" tabIndex={1} />
  <input name="email" tabIndex={3} />
</form>
```

### Focus Indicators

All focusable elements have visible focus indicators:

```css
.focus-ring {
  @apply focus-visible:outline-none
         focus-visible:ring-2
         focus-visible:ring-ring
         focus-visible:ring-offset-2;
}
```

### Focus Trapping

Modals trap focus to prevent keyboard users from tabbing outside:

```tsx
// Modal component automatically handles focus trapping
<Modal isOpen={isOpen} onClose={onClose}>
  {/* Focus is trapped within modal */}
  <button>First</button>
  <button>Last</button>
  {/* Tab wraps from Last to First */}
</Modal>
```

## Screen Reader Support

### ARIA Labels

Provide labels for all interactive elements:

```tsx
// ✅ Good - Icon button with label
<button aria-label="Close modal">
  <XIcon aria-hidden="true" />
</button>

// ✅ Good - Using aria-labelledby
<div role="dialog" aria-labelledby="modal-title">
  <h2 id="modal-title">Modal Title</h2>
</div>

// ❌ Bad - No label
<button>
  <XIcon />
</button>
```

### ARIA Roles

Use appropriate ARIA roles for custom components:

```tsx
// ✅ Good - Custom button with role
<div role="button" tabIndex={0} onClick={handleClick}>
  Custom Button
</div>

// ✅ Good - Alert for notifications
<div role="alert" aria-live="assertive">
  Error: Operation failed
</div>

// ✅ Good - Status for non-critical updates
<div role="status" aria-live="polite">
  Loading...
</div>
```

### Live Regions

Announce dynamic content changes:

```tsx
// ✅ Good - Toast with live region
<div role="alert" aria-live="assertive" aria-atomic="true">
  <p>{toastMessage}</p>
</div>

// ✅ Good - Polite status updates
<div role="status" aria-live="polite" aria-atomic="true">
  <p>Loaded {itemCount} items</p>
</div>
```

### Semantic HTML

Use semantic HTML elements whenever possible:

```tsx
// ✅ Good - Semantic elements
<header>...</header>
<nav>...</nav>
<main>...</main>
<article>...</article>
<footer>...</footer>

// ❌ Bad - Divs everywhere
<div className="header">...</div>
<div className="nav">...</div>
<div className="main">...</div>
```

## Form Accessibility

### Labels

All form inputs must have associated labels:

```tsx
// ✅ Good - Visible label
<label htmlFor="email">
  Email
  <input id="email" type="email" />
</label>

// ✅ Good - aria-label for visually hidden label
<input
  type="search"
  aria-label="Search projects"
  placeholder="Search..."
/>

// ❌ Bad - No label
<input type="text" placeholder="Enter name" />
```

### Error Messages

Error messages must be accessible:

```tsx
// ✅ Good - Associated error message
<div>
  <label htmlFor="email">Email</label>
  <input
    id="email"
    type="email"
    aria-invalid={hasError}
    aria-describedby={hasError ? "email-error" : undefined}
  />
  {hasError && (
    <p id="email-error" role="alert">
      Please enter a valid email address
    </p>
  )}
</div>
```

### Required Fields

Indicate required fields clearly:

```tsx
// ✅ Good - Visual and programmatic indication
<label htmlFor="name">
  Name <span aria-label="required">*</span>
  <input id="name" required aria-required="true" />
</label>

// ❌ Bad - Visual only
<label htmlFor="name">
  Name *
  <input id="name" />
</label>
```

## Media Accessibility

### Audio Transcription

The app itself provides transcription for audio, which is a key accessibility feature. Additional considerations:

- Provide timestamps for navigation
- Enable keyboard shortcuts for audio control
- Display current playback position

### Alternative Text

Provide alt text for all images:

```tsx
// ✅ Good - Descriptive alt text
<img src="waveform.png" alt="Audio waveform visualization showing volume peaks" />

// ✅ Good - Decorative images
<img src="decoration.png" alt="" role="presentation" />

// ❌ Bad - No alt text
<img src="important.png" />
```

## Component-Specific Guidelines

### Button Component

```tsx
// ✅ Complete accessible button
<Button
  variant="primary"
  onClick={handleSave}
  aria-label="Save changes"
  disabled={isSaving}
  loading={isSaving}
>
  {isSaving ? 'Saving...' : 'Save'}
</Button>
```

### Modal Component

```tsx
// ✅ Accessible modal
<Modal
  isOpen={isOpen}
  onClose={onClose}
  title="Confirm Delete"
  description="This action cannot be undone"
>
  {/* Modal automatically handles:
      - Focus trapping
      - Escape key to close
      - Focus restoration
      - ARIA attributes
  */}
  <div>
    <Button onClick={onConfirm}>Confirm</Button>
    <Button onClick={onClose}>Cancel</Button>
  </div>
</Modal>
```

### Toast Component

```tsx
// ✅ Accessible toast
<Toast
  variant="success"
  title="Changes saved"
  description="Your changes have been saved successfully"
  action={{
    label: 'Undo',
    onClick: handleUndo
  }}
/>
// Automatically includes:
// - role="alert"
// - aria-live="assertive"
// - aria-atomic="true"
```

### Input Component

```tsx
// ✅ Accessible input with error state
<div>
  <label htmlFor="username">Username</label>
  <Input
    id="username"
    type="text"
    error={hasError}
    aria-invalid={hasError}
    aria-describedby={hasError ? "username-error" : undefined}
  />
  {hasError && (
    <p id="username-error" role="alert" className="text-red-600">
      Username is required
    </p>
  )}
</div>
```

## Testing for Accessibility

### Automated Testing

Use axe-core for automated accessibility testing:

```tsx
import { axe, toHaveNoViolations } from 'jest-axe';
expect.extend(toHaveNoViolations);

it('should have no accessibility violations', async () => {
  const { container } = render(<MyComponent />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### Manual Testing

1. **Keyboard Navigation**
   - Navigate entire app using Tab key
   - Ensure all functionality accessible via keyboard
   - Check focus indicators are visible

2. **Screen Reader Testing**
   - Test with NVDA (Windows), VoiceOver (Mac), or JAWS
   - Verify all content is announced correctly
   - Check for logical reading order

3. **Zoom Testing**
   - Test at 200% zoom
   - Ensure no content is cut off
   - Verify layout remains functional

4. **Color Contrast**
   - Use browser DevTools to check contrast ratios
   - Test in both light and dark modes

### Testing Tools

- **axe DevTools** - Browser extension for automated testing
- **WAVE** - Web accessibility evaluation tool
- **Lighthouse** - Built into Chrome DevTools
- **Screen Readers:**
  - **NVDA** (Windows) - Free screen reader
  - **VoiceOver** (Mac) - Built-in screen reader
  - **JAWS** (Windows) - Popular commercial screen reader

## Common Pitfalls

### 1. Unlabeled Form Controls

```tsx
// ❌ Bad
<input type="text" placeholder="Search" />

// ✅ Good
<label>
  Search
  <input type="text" placeholder="Enter search term" />
</label>
```

### 2. Non-semantic Markup

```tsx
// ❌ Bad
<div onClick={handleClick}>Click me</div>

// ✅ Good
<button onClick={handleClick}>Click me</button>
```

### 3. Missing Skip Links

```tsx
// ✅ Good - Add skip link for keyboard users
<a href="#main-content" className="sr-only focus:not-sr-only">
  Skip to main content
</a>
```

### 4. Images Without Alt Text

```tsx
// ❌ Bad
<img src="logo.png" />

// ✅ Good
<img src="logo.png" alt="Company Logo" />

// ✅ Good for decorative images
<img src="decoration.png" alt="" role="presentation" />
```

### 5. Poor Color Contrast

```tsx
// ❌ Bad - Low contrast
<p className="text-gray-400">Important text</p>

// ✅ Good - High contrast
<p className="text-foreground">Important text</p>
```

## Accessibility Checklist

### For Every New Feature

- [ ] All interactive elements are keyboard accessible
- [ ] Focus indicators are visible and meet 3:1 contrast ratio
- [ ] All images have alt text (or alt="" if decorative)
- [ ] All form inputs have associated labels
- [ ] Error messages are announced to screen readers
- [ ] Color is not the only means of conveying information
- [ ] All text meets 4.5:1 contrast ratio (or 3:1 for large text)
- [ ] Component works at 200% zoom
- [ ] Tested with keyboard navigation
- [ ] Tested with screen reader (at least one)
- [ ] Automated accessibility tests pass

### For Modals/Dialogs

- [ ] Focus is trapped within modal
- [ ] Escape key closes modal
- [ ] Focus returns to trigger element on close
- [ ] Has appropriate ARIA attributes (role, aria-labelledby, etc.)
- [ ] Backdrop click closes modal

### For Forms

- [ ] All inputs have labels
- [ ] Required fields are marked both visually and programmatically
- [ ] Error messages are associated with inputs
- [ ] Successful submission is announced
- [ ] Form can be completed using keyboard only

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [A11y Project Checklist](https://www.a11yproject.com/checklist/)
- [Deque axe DevTools](https://www.deque.com/axe/devtools/)
