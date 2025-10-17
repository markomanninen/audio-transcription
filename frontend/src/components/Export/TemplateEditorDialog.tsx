import { useState, useEffect } from 'react';
import type { ExportTemplate } from '../../types';

interface TemplateEditorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { name: string; description?: string; content: string }) => void;
  isSaving?: boolean;
  template?: ExportTemplate | null;
}

export default function TemplateEditorDialog({ isOpen, onClose, onSave, isSaving, template }: TemplateEditorDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description || '');
      setContent(template.content);
    } else {
      setName('');
      setDescription('');
      setContent('');
    }
  }, [template, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && content.trim()) {
      onSave({ name, description, content });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg p-6 max-w-lg w-full mx-4 border border-border">
        <h2 className="text-xl font-semibold mb-4">{template ? 'Edit Template' : 'Create New Template'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="templateName" className="block text-sm font-medium mb-1">Template Name</label>
            <input type="text" id="templateName" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg bg-input" required />
          </div>
          <div>
            <label htmlFor="templateDesc" className="block text-sm font-medium mb-1">Description (Optional)</label>
            <input type="text" id="templateDesc" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg bg-input" />
          </div>
          <div>
            <label htmlFor="templateContent" className="block text-sm font-medium mb-1">Template Content</label>
            <p className="text-xs text-muted-foreground mb-1">Use placeholders like `{{text}}` for the full text, or loop through segments with `{{#each segments}}...{{/each}}`.</p>
            <textarea id="templateContent" value={content} onChange={(e) => setContent(e.target.value)} className="w-full h-48 px-3 py-2 border border-border rounded-lg font-mono bg-input" required />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-muted rounded-lg">Cancel</button>
            <button type="submit" disabled={isSaving} className="px-4 py-2 bg-primary-600 text-white rounded-lg">{isSaving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}