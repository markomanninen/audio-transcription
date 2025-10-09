import '@testing-library/jest-dom'
import { expect, afterEach, vi } from 'vitest'
import * as matchers from '@testing-library/jest-dom/matchers'

expect.extend(matchers)

// Cleanup after each test
afterEach(() => {
  // No cleanup needed for vitest
})

// Mock HTMLMediaElement
;(global as any).HTMLMediaElement.prototype.load = vi.fn()
;(global as any).HTMLMediaElement.prototype.play = vi.fn()
;(global as any).HTMLMediaElement.prototype.pause = vi.fn()
