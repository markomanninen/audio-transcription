/**
 * AI editor API client
 */
import { apiClient } from './client';

// --- Base and Shared Types ---

interface BaseEditorRequest {
  text: string;
  project_id: number;
  provider?: string;
}

interface EditorResponse {
  result: any;
}

// --- R4: Semantic Reconstruction ---

export const semanticReconstruction = async (
  request: BaseEditorRequest
): Promise<EditorResponse> => {
  const response = await apiClient.post('/api/ai_editor/semantic-reconstruction', request);
  return response.data;
};

// --- R5: Style Generation ---

export interface StyleGenerationRequest extends BaseEditorRequest {
  target_style: string;
}

export const styleGeneration = async (
  request: StyleGenerationRequest
): Promise<EditorResponse> => {
  const response = await apiClient.post('/api/ai_editor/style-generation', request);
  return response.data;
};

// --- R6: NLP Analysis ---

export const nlpAnalysis = async (
  request: BaseEditorRequest
): Promise<EditorResponse> => {
  const response = await apiClient.post('/api/ai_editor/nlp-analysis', request);
  return response.data;
};

// --- R7: Fact Checking ---

export interface FactCheckingRequest extends BaseEditorRequest {
  domain: string;
}

export const factChecking = async (
  request: FactCheckingRequest
): Promise<EditorResponse> => {
  const response = await apiClient.post('/api/ai_editor/fact-checking', request);
  return response.data;
};

// --- R8: Technical Check ---

export interface TechnicalCheckRequest {
  text_with_metadata: string;
  project_id: number;
  provider?: string;
  target_format: string;
}

export const technicalCheck = async (
  request: TechnicalCheckRequest
): Promise<EditorResponse> => {
  const response = await apiClient.post('/api/ai_editor/technical-check', request);
  return response.data;
};