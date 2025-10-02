import '@testing-library/jest-dom'
import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'

expect.extend(matchers)

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock HTMLMediaElement
global.HTMLMediaElement.prototype.load = vi.fn()
global.HTMLMediaElement.prototype.play = vi.fn()
global.HTMLMediaElement.prototype.pause = vi.fn()
