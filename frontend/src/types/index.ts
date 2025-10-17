export interface Project {
  id: number
  name: string
  description?: string | null
  project_type: 'audio' | 'text'
  content_type?: string | null
  created_at: string
}

export interface AudioFile {
  file_id: number
  filename: string
  original_filename: string
  file_size: number
  duration?: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
}

export interface Segment {
  id: number
  start_time: number
  end_time: number
  original_text: string
  edited_text?: string
  speaker_id?: number
  sequence: number
}

export interface Speaker {
  id: number
  speaker_id: string
  display_name: string
  color: string
}

export interface TranscriptionStatus {
  file_id: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  error_message?: string
  segment_count: number
  duration?: number
}

export interface ExportTemplate {
  id: number;
  name: string;
  description?: string;
  content: string;
}
