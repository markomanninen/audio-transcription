import { useMutation } from '@tanstack/react-query';
import {
  semanticReconstruction,
  styleGeneration,
  nlpAnalysis,
  factChecking,
  technicalCheck,
  StyleGenerationRequest,
  FactCheckingRequest,
  TechnicalCheckRequest,
} from '../api/aiEditor';

export const useAIEditor = (projectId: number) => {
  const mutationOptions = {
    onError: (error: Error) => {
      // Here you could show a toast notification
      console.error("AI Editor task failed:", error);
    },
  };

  const useSemanticReconstruction = () => useMutation({
    mutationFn: (text: string) => semanticReconstruction({ text, project_id: projectId }),
    ...mutationOptions,
  });

  const useStyleGeneration = () => useMutation({
    mutationFn: (request: Omit<StyleGenerationRequest, 'project_id'>) =>
      styleGeneration({ ...request, project_id: projectId }),
    ...mutationOptions,
  });

  const useNlpAnalysis = () => useMutation({
    mutationFn: (text: string) => nlpAnalysis({ text, project_id: projectId }),
    ...mutationOptions,
  });

  const useFactChecking = () => useMutation({
    mutationFn: (request: Omit<FactCheckingRequest, 'project_id'>) =>
      factChecking({ ...request, project_id: projectId }),
    ...mutationOptions,
  });

  const useTechnicalCheck = () => useMutation({
    mutationFn: (request: Omit<TechnicalCheckRequest, 'project_id'>) =>
      technicalCheck({ ...request, project_id: projectId }),
    ...mutationOptions,
  });

  return {
    useSemanticReconstruction,
    useStyleGeneration,
    useNlpAnalysis,
    useFactChecking,
    useTechnicalCheck,
  };
};