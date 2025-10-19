import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { ExportTemplate } from '../types';

interface TemplateData {
  name: string;
  description?: string;
  content: string;
}

export const useExportTemplates = () => {
  return useQuery<ExportTemplate[]>({
    queryKey: ['exportTemplates'],
    queryFn: async () => {
      const response = await apiClient.get('/api/export-templates/');
      return response.data;
    },
  });
};

export const useCreateExportTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation<ExportTemplate, Error, TemplateData>({
    mutationFn: async (data) => {
      const response = await apiClient.post('/api/export-templates/', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exportTemplates'] });
    },
  });
};

export const useUpdateExportTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation<ExportTemplate, Error, { id: number; data: TemplateData }>({
    mutationFn: async ({ id, data }) => {
      const response = await apiClient.put(`/api/export-templates/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exportTemplates'] });
    },
  });
};

export const useDeleteExportTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: async (id) => {
      await apiClient.delete(`/api/export-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exportTemplates'] });
    },
  });
};