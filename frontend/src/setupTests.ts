import '@testing-library/jest-dom'
import { expect, afterEach, vi } from 'vitest'
import * as matchers from '@testing-library/jest-dom/matchers'

expect.extend(matchers)

// Cleanup after each test
afterEach(() => {
  // No cleanup needed for vitest
})

// Mock HTMLMediaElement
interface MockHTMLMediaElement {
  load: ReturnType<typeof vi.fn>
  play: ReturnType<typeof vi.fn>
  pause: ReturnType<typeof vi.fn>
}

;(global as typeof globalThis & { HTMLMediaElement: { prototype: MockHTMLMediaElement } }).HTMLMediaElement.prototype.load = vi.fn()
;(global as typeof globalThis & { HTMLMediaElement: { prototype: MockHTMLMediaElement } }).HTMLMediaElement.prototype.play = vi.fn()
;(global as typeof globalThis & { HTMLMediaElement: { prototype: MockHTMLMediaElement } }).HTMLMediaElement.prototype.pause = vi.fn()
