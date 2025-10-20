import { describe, expect, it } from 'vitest'
import { areSegmentsConsecutive } from '../../utils/segments'
import type { Segment } from '../../types'

const createSegment = (id: number, sequence: number): Segment => ({
  id,
  sequence,
  start_time: sequence * 5,
  end_time: sequence * 5 + 5,
  original_text: `Segment ${id}`,
  is_passive: false,
})

describe('areSegmentsConsecutive', () => {
  it('returns false when fewer than two segments are selected', () => {
    const segments = [createSegment(1, 1)]
    expect(areSegmentsConsecutive([1], segments)).toBe(false)
    expect(areSegmentsConsecutive([], segments)).toBe(false)
  })

  it('returns true when selected segments are consecutive', () => {
    const segments = [createSegment(1, 1), createSegment(2, 2), createSegment(3, 3)]
    expect(areSegmentsConsecutive([1, 2], segments)).toBe(true)
    expect(areSegmentsConsecutive([2, 3], segments)).toBe(true)
    expect(areSegmentsConsecutive([1, 2, 3], segments)).toBe(true)
  })

  it('returns false when there are gaps between selected segments', () => {
    const segments = [createSegment(1, 1), createSegment(2, 2), createSegment(3, 3)]
    expect(areSegmentsConsecutive([1, 3], segments)).toBe(false)
    expect(areSegmentsConsecutive([1, 2, 4], [...segments, createSegment(4, 5)])).toBe(false)
  })

  it('ignores missing segments gracefully', () => {
    const segments = [createSegment(1, 1), createSegment(3, 3)]
    expect(areSegmentsConsecutive([1, 2], segments)).toBe(false)
  })
})
