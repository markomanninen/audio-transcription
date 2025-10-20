export interface TextDocument {
  id: number
  project_id: number
  content: string
  history: string
}

export interface Project {
  id: number
  name: string
  description?: string | null
  project_type: 'audio' | 'text'
  content_type?: string | null
  created_at: string
  updated_at?: string
  text_document?: TextDocument
}

export interface AudioFile {
  file_id: number
  filename: string
  original_filename: string
  file_size: number
  duration?: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  created_at?: string
  updated_at?: string
  transcription_started_at?: string
  transcription_completed_at?: string
  parent_audio_file_id?: number | null
  split_start_seconds?: number | null
  split_end_seconds?: number | null
  split_depth?: number | null
  split_order?: number | null
  processing_stage?: string | null
  error_message?: string | null
}

export interface Segment {
  id: number
  start_time: number
  end_time: number
  original_text: string
  edited_text?: string
  speaker_id?: number
  sequence: number
  is_passive: boolean
}

export interface Speaker {
  id: number
  speaker_id: string
  display_name: string
  color: string
}

export interface TranscriptionStatus {
  file_id: number
  filename: string
  original_filename: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  error_message?: string
  processing_stage?: string
  segment_count: number
  duration?: number
  file_size?: number
  transcription_started_at?: string
  transcription_completed_at?: string
  created_at?: string
  updated_at?: string
  transcription_metadata?: string
  parent_file_id?: number | null
  split_start_seconds?: number | null
  split_end_seconds?: number | null
  split_label?: string | null
  split_total_chunks?: number | null
  split_origin_filename?: string | null
  split_depth?: number | null
}

export interface ExportTemplate {
  id: number;
  name: string;
  description?: string;
  content: string;
}
