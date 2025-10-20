import type { Segment } from '../types'

export const areSegmentsConsecutive = (selectedIds: number[], segments: Segment[]): boolean => {
  if (selectedIds.length < 2) {
    return false
  }

  const segmentMap = new Map<number, Segment>()
  segments.forEach((segment) => {
    segmentMap.set(segment.id, segment)
  })

  const orderedSegments = selectedIds
    .map((id) => segmentMap.get(id))
    .filter((segment): segment is Segment => Boolean(segment))
    .sort((a, b) => a.sequence - b.sequence)

  if (orderedSegments.length !== selectedIds.length) {
    return false
  }

  for (let index = 1; index < orderedSegments.length; index += 1) {
    if (orderedSegments[index].sequence !== orderedSegments[index - 1].sequence + 1) {
      return false
    }
  }

  return true
}
