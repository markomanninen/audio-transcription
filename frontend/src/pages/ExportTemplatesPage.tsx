import { useState } from 'react';
import { useExportTemplates, useCreateExportTemplate, useUpdateExportTemplate, useDeleteExportTemplate } from '../hooks/useExportTemplates';
import TemplateEditorDialog from '../components/Export/TemplateEditorDialog';
import { Button } from '../components/ui/Button';
import type { ExportTemplate } from '../types';

export default function ExportTemplatesPage() {
  const { data: templates, isLoading } = useExportTemplates();
  const createTemplate = useCreateExportTemplate();
  const updateTemplate = useUpdateExportTemplate();
  const deleteTemplate = useDeleteExportTemplate();

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ExportTemplate | null>(null);

  const handleSave = (data: { name: string; description?: string; content: string }) => {
    if (selectedTemplate) {
      updateTemplate.mutate({ id: selectedTemplate.id, data }, {
        onSuccess: () => setIsEditorOpen(false),
      });
    } else {
      createTemplate.mutate(data, {
        onSuccess: () => setIsEditorOpen(false),
      });
    }
  };

  const openCreateDialog = () => {
    setSelectedTemplate(null);
    setIsEditorOpen(true);
  };

  const openEditDialog = (template: ExportTemplate) => {
    setSelectedTemplate(template);
    setIsEditorOpen(true);
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      deleteTemplate.mutate(id);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Export Templates</h1>
        <Button onClick={openCreateDialog}>Create New Template</Button>
      </div>

      {isLoading ? (
        <p>Loading templates...</p>
      ) : (
        <div className="space-y-4">
          {templates?.map((template) => (
            <div key={template.id} className="bg-card border border-border rounded-lg p-4 flex justify-between items-center">
              <div>
                <h3 className="font-semibold">{template.name}</h3>
                <p className="text-sm text-muted-foreground">{template.description}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => openEditDialog(template)}>Edit</Button>
                <Button variant="danger" size="sm" onClick={() => handleDelete(template.id)}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <TemplateEditorDialog
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onSave={handleSave}
        isSaving={createTemplate.isPending || updateTemplate.isPending}
        template={selectedTemplate}
      />
    </div>
  );
}