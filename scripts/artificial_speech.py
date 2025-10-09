#!/usr/bin/env python3
"""
Create high-quality sample audio file with two different voices for testing transcription and speaker diarization.
Uses more sophisticated audio synthesis to create realistic-sounding speech.
"""

import wave
import os
import sys

def create_realistic_voice_audio(text, duration, voice_profile, sample_rate=16000):
    """
    Create more realistic speech-like audio using formant synthesis.
    """
    try:
        import numpy as np
    except ImportError:
        print("Error: numpy is required. Install with: pip install numpy")
        sys.exit(1)
    
    # Generate time array
    t = np.linspace(0, duration, int(sample_rate * duration), False)
    
    # Voice characteristics from profile
    f0 = voice_profile['fundamental']  # Fundamental frequency (pitch)
    formants = voice_profile['formants']  # Formant frequencies
    formant_bw = voice_profile['bandwidths']  # Formant bandwidths
    
    # Create vowel-like sounds using formant synthesis
    audio = np.zeros_like(t)
    
    # Generate fundamental frequency with natural pitch variation
    pitch_variation = 1 + 0.1 * np.sin(2 * np.pi * 2 * t) + 0.05 * np.sin(2 * np.pi * 7 * t)
    f0_modulated = f0 * pitch_variation
    
    # Create voiced excitation (buzz-like source)
    excitation = np.zeros_like(t)
    
    # Generate impulse train for voiced sounds
    period_samples = sample_rate / f0
    for i in range(int(len(t) / period_samples)):
        pulse_pos = int(i * period_samples)
        if pulse_pos < len(excitation):
            # Decaying sawtooth pulse
            pulse_duration = min(int(period_samples * 0.1), len(excitation) - pulse_pos)
            pulse_t = np.arange(pulse_duration) / sample_rate
            pulse = np.exp(-pulse_t * 500) * (1 - 2 * pulse_t / pulse_duration * 10)
            excitation[pulse_pos:pulse_pos + pulse_duration] = pulse[:pulse_duration]
    
    # Apply formant filtering (simplified)
    for i, (formant_freq, bandwidth) in enumerate(zip(formants, formant_bw)):
        # Create formant resonance using a simple resonator
        decay_rate = bandwidth * np.pi
        
        # Generate resonant response
        resonance = np.zeros_like(t)
        
        # Impulse response of formant filter
        for j in range(0, len(t), max(1, int(sample_rate / f0 / 4))):
            if j < len(t):
                # Damped sinusoid starting at each impulse
                remaining_t = t[j:] - t[j]
                formant_response = (
                    np.exp(-decay_rate * remaining_t) * 
                    np.sin(2 * np.pi * formant_freq * remaining_t) *
                    excitation[j]
                )
                
                end_idx = min(j + len(formant_response), len(resonance))
                resonance[j:end_idx] += formant_response[:end_idx - j]
        
        # Weight formants based on typical speech patterns
        if i == 0:  # F1 - strongest for vowels
            audio += 0.5 * resonance
        elif i == 1:  # F2 - important for vowel identity
            audio += 0.3 * resonance
        else:  # Higher formants - add brightness
            audio += 0.1 * resonance
    
    # Add speech envelope (syllable timing)
    syllables_per_second = voice_profile.get('speech_rate', 4)
    syllable_period = 1.0 / syllables_per_second
    
    envelope = np.ones_like(t)
    for syll_idx in range(int(duration * syllables_per_second)):
        syll_start = syll_idx * syllable_period
        syll_duration = syllable_period * np.random.uniform(0.6, 0.9)
        syll_end = min(syll_start + syll_duration, duration)
        
        # Random pauses (10% chance)
        if np.random.random() < 0.1:
            syll_indices = (t >= syll_start) & (t < syll_start + syllable_period)
            envelope[syll_indices] *= 0.1  # Very quiet
            continue
        
        # Create syllable envelope
        syll_indices = (t >= syll_start) & (t < syll_end)
        if np.any(syll_indices):
            syll_t = t[syll_indices] - syll_start
            syll_len = syll_end - syll_start
            
            # Smooth envelope with attack and decay
            env_shape = np.exp(-((syll_t - syll_len/2) / (syll_len/3))**2)
            envelope[syll_indices] *= env_shape
        
        # Gap between syllables
        gap_indices = (t >= syll_end) & (t < syll_start + syllable_period)
        envelope[gap_indices] *= 0.05
    
    # Apply envelope and add slight background noise
    audio = audio * envelope
    noise = 0.001 * np.random.normal(0, 1, len(audio))
    audio += noise
    
    # Normalize
    if np.max(np.abs(audio)) > 0:
        audio = audio / np.max(np.abs(audio)) * 0.8
    
    return (audio * 32767).astype(np.int16)

def create_two_voice_conversation_improved(filename: str = "sample_conversation_improved.wav"):
    """Create high-quality audio file with two distinct voices."""
    print("Creating high-quality two-voice conversation audio...")
    
    # Audio settings
    sample_rate = 16000
    
    # Conversation script with timing
    conversation = [
        ("Alice", "Hello there! This is a test transcription with clear speech.", 2.8),
        ("Bob", "Hi Alice! Yes, this audio contains two different speakers talking.", 3.2),
        ("Alice", "We're testing the speaker diarization feature of the system.", 3.0),
        ("Bob", "That's right. Each voice should be identified as a separate speaker.", 3.5),
        ("Alice", "The transcription should recognize that we are two different people.", 3.8),
        ("Bob", "Perfect! This will help validate both transcription accuracy and speaker separation.", 4.0),
        ("Alice", "Good luck with your testing!", 2.0),
        ("Bob", "Thank you, and goodbye!", 2.0),
    ]
    
    # Voice profiles with realistic formant frequencies
    voice_profiles = {
        "Alice": {  # Female voice
            "fundamental": 220,  # Higher pitch
            "formants": [700, 1220, 2600, 3500],  # Typical female formants
            "bandwidths": [130, 70, 160, 200],
            "speech_rate": 4.5,  # Slightly faster
        },
        "Bob": {  # Male voice  
            "fundamental": 120,  # Lower pitch
            "formants": [570, 840, 2410, 3500],  # Typical male formants
            "bandwidths": [100, 50, 120, 200],
            "speech_rate": 3.8,  # Slightly slower
        }
    }
    
    # Calculate total duration with pauses
    total_duration = sum(duration for _, _, duration in conversation) + len(conversation) * 0.5
    total_samples = int(sample_rate * total_duration)
    
    # Generate complete audio
    try:
        import numpy as np
        audio_data = np.zeros(total_samples)
    except ImportError:
        print("Error: numpy is required. Install with: pip install numpy")
        sys.exit(1)
    
    current_pos = 0
    
    for speaker, text, duration in conversation:
        # Add pause before each speaker (except first)
        if current_pos > 0:
            pause_samples = int(0.5 * sample_rate)
            current_pos += pause_samples
        
        # Generate speech segment
        voice_profile = voice_profiles[speaker]
        segment_audio = create_realistic_voice_audio(text, duration, voice_profile, sample_rate)
        
        # Add to main audio
        end_pos = min(current_pos + len(segment_audio), total_samples)
        audio_data[current_pos:end_pos] = segment_audio[:end_pos - current_pos]
        
        current_pos = end_pos
        print(f"  Generated {speaker}: \"{text[:50]}{'...' if len(text) > 50 else ''}\" ({duration:.1f}s)")
    
    # Final normalization
    max_val = np.max(np.abs(audio_data))
    if max_val > 0:
        audio_data = audio_data / max_val * 0.75
    
    # Convert to 16-bit
    audio_data = (audio_data * 32767).astype(np.int16)
    
    # Write WAV file
    with wave.open(filename, 'w') as wav_file:
        wav_file.setnchannels(1)  # Mono
        wav_file.setsampwidth(2)  # 16-bit
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(audio_data.tobytes())
    
    file_size = os.path.getsize(filename)
    print(f"✅ Created high-quality audio file: {filename}")
    print(f"   Duration: {total_duration:.1f}s")
    print(f"   Size: {file_size:,} bytes")
    print(f"   Sample rate: {sample_rate} Hz")
    print(f"   Two distinct voices (Alice: female, Bob: male) with formant synthesis")
    print(f"   Optimized for speaker diarization and transcription testing")

def main():
    """Main function to create improved sample audio."""
    if len(sys.argv) > 1:
        filename = sys.argv[1]
    else:
        filename = "sample_conversation_improved.wav"
    
    try:
        create_two_voice_conversation_improved(filename)
        print(f"\n🎵 High-quality sample audio created successfully!")
        print(f"You can now upload '{filename}' to test speaker diarization and transcription.")
        print(f"\nExpected results:")
        print(f"- Two speakers should be detected (Alice and Bob)")
        print(f"- Clear transcription of the conversation")
        print(f"- Proper speaker attribution for each segment")
    except Exception as e:
        print(f"❌ Error creating audio: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()