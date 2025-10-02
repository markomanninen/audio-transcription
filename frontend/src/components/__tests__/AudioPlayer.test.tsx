import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import AudioPlayer from '../Player/AudioPlayer'

describe('AudioPlayer', () => {
  it('renders play button', () => {
    render(<AudioPlayer audioUrl="/test.mp3" />)

    const playButton = screen.getByRole('button')
    expect(playButton).toBeInTheDocument()
  })

  it('displays time indicators', () => {
    render(<AudioPlayer audioUrl="/test.mp3" />)

    // Should display 0:00 at start
    expect(screen.getByText('0:00')).toBeInTheDocument()
  })

  it('renders seek slider', () => {
    render(<AudioPlayer audioUrl="/test.mp3" />)

    const slider = screen.getByRole('slider')
    expect(slider).toBeInTheDocument()
  })
})
