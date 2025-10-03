# Design System Documentation

## Overview

This document describes the design system for the Audio Transcription application, including colors, typography, spacing, components, and usage guidelines.

## Color Palette

### Primary Colors (Blue)
Used for primary actions, links, and focus states.

```css
--color-primary-50: 239 246 255
--color-primary-100: 219 234 254
--color-primary-200: 191 219 254
--color-primary-300: 147 197 253
--color-primary-400: 96 165 250
--color-primary-500: 59 130 246   /* Main brand color */
--color-primary-600: 37 99 235    /* Primary buttons */
--color-primary-700: 29 78 216    /* Hover states */
--color-primary-800: 30 64 175
--color-primary-900: 30 58 138
```

### Secondary Colors (Slate)
Used for text, borders, and neutral UI elements.

```css
--color-secondary-50: 248 250 252
--color-secondary-100: 241 245 249
--color-secondary-200: 226 232 240
--color-secondary-300: 203 213 225
--color-secondary-400: 148 163 184
--color-secondary-500: 100 116 139
--color-secondary-600: 71 85 105
--color-secondary-700: 51 65 85
--color-secondary-800: 30 41 59
--color-secondary-900: 15 23 42    /* Primary text color */
```

### Semantic Colors

```css
/* Success (Green) */
--success: 34 197 94
--success-foreground: 255 255 255

/* Warning (Yellow) */
--warning: 234 179 8
--warning-foreground: 255 255 255

/* Error (Red) */
--error: 239 68 68
--error-foreground: 255 255 255
```

## Dark Mode

Dark mode is supported via the `.dark` class on the root element. All semantic colors automatically adapt:

```css
.dark {
  --background: 15 23 42
  --foreground: 241 245 249
  --card: 30 41 59
  --border: 51 65 85
  /* ... */
}
```

## Typography

### Font Family
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto',
  'Helvetica Neue', Arial, sans-serif;
```

### Font Sizes
```css
text-xs:   0.75rem (12px)  - line-height: 1rem
text-sm:   0.875rem (14px) - line-height: 1.25rem
text-base: 1rem (16px)     - line-height: 1.5rem
text-lg:   1.125rem (18px) - line-height: 1.75rem
text-xl:   1.25rem (20px)  - line-height: 1.75rem
text-2xl:  1.5rem (24px)   - line-height: 2rem
text-3xl:  1.875rem (30px) - line-height: 2.25rem
text-4xl:  2.25rem (36px)  - line-height: 2.5rem
```

## Spacing

### Spacing Scale
Uses Tailwind's default scale (4px base unit):
```
1  = 0.25rem (4px)
2  = 0.5rem (8px)
3  = 0.75rem (12px)
4  = 1rem (16px)
6  = 1.5rem (24px)
8  = 2rem (32px)
12 = 3rem (48px)
16 = 4rem (64px)
```

### Custom Spacing
```css
18:  4.5rem (72px)
88:  22rem (352px)
100: 25rem (400px)
```

## Border Radius

```css
--radius: 0.5rem (8px)

rounded-sm: calc(var(--radius) - 2px)  /* 6px */
rounded:    var(--radius)              /* 8px */
rounded-md: calc(var(--radius) + 2px)  /* 10px */
rounded-lg: calc(var(--radius) + 4px)  /* 12px */
```

## Shadows

```css
shadow-sm:  0 1px 2px 0 rgb(0 0 0 / 0.05)
shadow:     0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)
shadow-md:  0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)
shadow-lg:  0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)
shadow-xl:  0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)
```

## Components

### Button

**Variants:**
- `primary` - Primary actions (blue)
- `secondary` - Secondary actions (gray)
- `outline` - Outlined button
- `ghost` - Transparent button
- `danger` - Destructive actions (red)
- `success` - Success actions (green)

**Sizes:**
- `sm` - Small (h-8, px-3)
- `md` - Medium (h-10, px-4) [default]
- `lg` - Large (h-12, px-6)
- `icon` - Icon only (h-10, w-10)

**Usage:**
```tsx
import { Button } from '@/components/ui/Button';

<Button variant="primary" size="md" loading={false}>
  Click me
</Button>
```

### Card

Card components for content containers.

**Usage:**
```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';

<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Card content goes here</p>
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>
```

### Input

Text input with error state support.

**Usage:**
```tsx
import { Input } from '@/components/ui/Input';

<Input
  type="text"
  placeholder="Enter text"
  error={false}
/>
```

### Modal

Accessible modal dialog with focus management.

**Sizes:**
- `sm` - Small (max-w-sm)
- `md` - Medium (max-w-md) [default]
- `lg` - Large (max-w-lg)
- `xl` - Extra large (max-w-xl)
- `full` - Full width with margin

**Usage:**
```tsx
import { Modal } from '@/components/ui/Modal';

<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Modal Title"
  description="Modal description"
  size="md"
  showCloseButton={true}
>
  <p>Modal content</p>
</Modal>
```

### Toast

Toast notifications for user feedback.

**Variants:**
- `default` - Default notification
- `success` - Success message (green)
- `error` - Error message (red)
- `warning` - Warning message (yellow)
- `info` - Info message (blue)

**Usage:**
```tsx
import { useToast } from '@/hooks/useToast';

const { toast, success, error, warning, info } = useToast();

// Simple usage
success('Success!', 'Operation completed');
error('Error!', 'Something went wrong');

// Advanced usage
toast({
  variant: 'info',
  title: 'Info',
  description: 'Here is some information',
  action: {
    label: 'Retry',
    onClick: () => console.log('Retry clicked')
  },
  duration: 5000
});
```

### Spinner

Loading spinner with different sizes.

**Sizes:**
- `sm` - Small (h-4, w-4)
- `md` - Medium (h-8, w-8) [default]
- `lg` - Large (h-12, w-12)
- `xl` - Extra large (h-16, w-16)

**Usage:**
```tsx
import { Spinner } from '@/components/ui/Spinner';

<Spinner size="md" label="Loading..." />
```

### Skeleton

Skeleton loader for content placeholders.

**Usage:**
```tsx
import { Skeleton } from '@/components/ui/Skeleton';

<Skeleton className="h-12 w-full" />
```

## Animations

### Predefined Animations

```css
animate-fade-in:        fadeIn 0.2s ease-in
animate-fade-out:       fadeOut 0.2s ease-out
animate-slide-in-right: slideInRight 0.3s ease-out
animate-slide-out-right:slideOutRight 0.3s ease-out
animate-spin-slow:      spin 3s linear infinite
```

### Transition Utilities

```css
.transition-smooth {
  transition-all duration-200 ease-in-out
}

.focus-ring {
  focus-visible:outline-none
  focus-visible:ring-2
  focus-visible:ring-ring
  focus-visible:ring-offset-2
}
```

## Accessibility

### Focus States

All interactive elements include visible focus indicators:
```css
.focus-ring {
  @apply focus-visible:outline-none
         focus-visible:ring-2
         focus-visible:ring-ring
         focus-visible:ring-offset-2;
}
```

### Color Contrast

- All text meets WCAG 2.1 AA standards (4.5:1 for normal text, 3:1 for large text)
- Focus indicators have 3:1 contrast with background

### Screen Reader Support

- All icons have `aria-hidden="true"` with adjacent visible or `aria-label` text
- Interactive elements have proper ARIA roles and labels
- Modals implement focus trapping and restoration

## Dark Mode

### Theme Toggle

```tsx
import ThemeToggle from '@/components/ThemeToggle';
import { useTheme } from '@/hooks/useTheme';

// Theme toggle button
<ThemeToggle />

// Programmatic theme change
const { theme, setTheme, resolvedTheme } = useTheme();
setTheme('dark'); // 'light' | 'dark' | 'system'
```

### Theme-aware Styling

Use semantic color tokens that automatically adapt:

```tsx
// ✅ Good - Uses semantic tokens
<div className="bg-card text-card-foreground border-border">

// ❌ Bad - Hard-coded colors
<div className="bg-white text-gray-900 border-gray-200">
```

## Best Practices

### Component Composition

```tsx
// ✅ Good - Composable components
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>Content</CardContent>
</Card>

// ❌ Bad - Monolithic component
<Card title="Title" content="Content" />
```

### Responsive Design

```tsx
// ✅ Good - Mobile-first, responsive
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">

// ❌ Bad - Desktop-only
<div className="grid grid-cols-3">
```

### Accessibility

```tsx
// ✅ Good - Accessible button
<button aria-label="Close modal" className="focus-ring">
  <XIcon aria-hidden="true" />
</button>

// ❌ Bad - Icon-only button without label
<button>
  <XIcon />
</button>
```

## CSS Utility Classes

### Custom Utilities

```css
/* Background & Text */
.bg-background { background-color: rgb(var(--background)); }
.text-foreground { color: rgb(var(--foreground)); }
.bg-card { background-color: rgb(var(--card)); }
.text-card-foreground { color: rgb(var(--card-foreground)); }
.bg-muted { background-color: rgb(var(--muted)); }
.text-muted-foreground { color: rgb(var(--muted-foreground)); }

/* Borders & Focus */
.border-border { border-color: rgb(var(--border)); }
.ring-ring { --tw-ring-color: rgb(var(--ring)); }
```

## Usage with cn() Utility

The `cn()` utility combines `clsx` and `tailwind-merge` for conditional and conflict-free class names:

```tsx
import { cn } from '@/utils/cn';

<div className={cn(
  'base-class',
  condition && 'conditional-class',
  'override-class'
)}>
```

## Migration Guide

### From Old Styles to Design System

**Before:**
```tsx
<button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
  Click me
</button>
```

**After:**
```tsx
<Button variant="primary" size="md">
  Click me
</Button>
```

**Before:**
```tsx
<div className="bg-white border rounded-lg p-4 shadow">
  Content
</div>
```

**After:**
```tsx
<Card>
  <CardContent>
    Content
  </CardContent>
</Card>
```

## Resources

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
