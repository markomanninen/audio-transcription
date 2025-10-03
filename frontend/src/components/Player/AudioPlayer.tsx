import { useState, useRef, useEffect } from 'react'

interface AudioPlayerProps {
  audioUrl: string
  currentTime?: number
  onTimeUpdate?: (time: number) => void
  onSeek?: (time: number) => void
  shouldPlay?: boolean
  shouldPause?: boolean
  onPlayingChange?: (isPlaying: boolean) => void
}

export default function AudioPlayer({
  audioUrl,
  currentTime,
  onTimeUpdate,
  onSeek,
  shouldPlay = false,
  shouldPause = false,
  onPlayingChange,
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [localCurrentTime, setLocalCurrentTime] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)

  // Notify parent about playing state changes
  useEffect(() => {
    onPlayingChange?.(isPlaying)
  }, [isPlaying, onPlayingChange])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleTimeUpdate = () => {
      const time = audio.currentTime
      setLocalCurrentTime(time)
      onTimeUpdate?.(time)
    }

    const handleLoadedMetadata = () => {
      setDuration(audio.duration)
      console.log('Audio loaded:', { duration: audio.duration, src: audio.src })
    }

    const handleEnded = () => {
      setIsPlaying(false)
    }

    const handleError = (e: Event) => {
      console.error('Audio error:', {
        error: audio.error,
        code: audio.error?.code,
        message: audio.error?.message,
        src: audio.src,
        networkState: audio.networkState,
        readyState: audio.readyState
      })
    }

    const handleCanPlay = () => {
      console.log('Audio can play:', { readyState: audio.readyState })
    }

    const handleStalled = () => {
      console.warn('Audio stalled - network issue?')
    }

    const handleWaiting = () => {
      console.log('Audio waiting for data...')
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)
    audio.addEventListener('canplay', handleCanPlay)
    audio.addEventListener('stalled', handleStalled)
    audio.addEventListener('waiting', handleWaiting)

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
      audio.removeEventListener('canplay', handleCanPlay)
      audio.removeEventListener('stalled', handleStalled)
      audio.removeEventListener('waiting', handleWaiting)
    }
  }, [onTimeUpdate])

  // Handle play requests (resume from current position)
  useEffect(() => {
    if (shouldPlay && audioRef.current) {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(err => console.error('Play error:', err))
    }
  }, [shouldPlay])

  // Handle pause requests
  useEffect(() => {
    if (shouldPause && audioRef.current) {
      audioRef.current.pause()
      setIsPlaying(false)
    }
  }, [shouldPause])

  // Sync external currentTime prop (for seeking from segment clicks/replay)
  useEffect(() => {
    const audio = audioRef.current
    if (currentTime !== undefined && audio && Math.abs(audio.currentTime - currentTime) > 1) {
      // Only seek if the difference is more than 1 second to avoid constant updates
      audio.currentTime = currentTime
      // Always start playing after seeking (segment click or replay)
      audio.play()
        .then(() => setIsPlaying(true))
        .catch(err => console.error('Playback error:', err))
    }
  }, [currentTime])

  const togglePlayPause = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
    setIsPlaying(!isPlaying)
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    if (audioRef.current) {
      audioRef.current.currentTime = time
      setLocalCurrentTime(time)
      onSeek?.(time)
    }
  }

  const handleReplay = () => {
    const audio = audioRef.current
    if (!audio) return

    audio.currentTime = 0
    setLocalCurrentTime(0)
    if (isPlaying) {
      audio.play().catch(err => console.error('Replay error:', err))
    }
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="bg-card rounded-lg shadow-sm border border-border p-6">
      <audio ref={audioRef} src={audioUrl} preload="auto" crossOrigin="anonymous" />

      <div className="space-y-4">
        {/* Timeline */}
        <div className="space-y-2">
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={localCurrentTime}
            onChange={handleSeek}
            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, rgb(var(--color-primary-600)) 0%, rgb(var(--color-primary-600)) ${
                (localCurrentTime / duration) * 100
              }%, rgb(var(--muted)) ${(localCurrentTime / duration) * 100}%, rgb(var(--muted)) 100%)`,
            }}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatTime(localCurrentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          {/* Replay button */}
          <button
            onClick={handleReplay}
            className="
              w-10 h-10 rounded-full bg-muted
              flex items-center justify-center
              hover:bg-muted/80 transition-colors
              focus-ring
            "
            title="Replay from beginning"
          >
            <span className="text-lg">↻</span>
          </button>

          {/* Play/Pause button */}
          <button
            onClick={togglePlayPause}
            className="
              w-12 h-12 rounded-full bg-primary-600 text-white
              flex items-center justify-center
              hover:bg-primary-700 transition-colors
              focus-ring
            "
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
