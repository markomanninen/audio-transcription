import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import AudioPlayer from '../Player/AudioPlayer'

describe('AudioPlayer', () => {
  it('renders play button', () => {
    render(<AudioPlayer audioUrl="/test.mp3" />)

    const playButton = screen.getByTitle('Play')
    expect(playButton).toBeInTheDocument()
  })

  it('displays time indicators', () => {
    render(<AudioPlayer audioUrl="/test.mp3" />)

    // Should display 0:00 at start
    const timeLabels = screen.getAllByText('0:00')
    expect(timeLabels).toHaveLength(2)
  })

  it('renders seek slider', () => {
    render(<AudioPlayer audioUrl="/test.mp3" />)

    const slider = screen.getByRole('slider')
    expect(slider).toBeInTheDocument()
  })
})
