import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'

interface DeleteProjectDialogProps {
  isOpen: boolean
  projectName: string
  onClose: () => void
  onConfirm: () => void
  isDeleting: boolean
}

export default function DeleteProjectDialog({
  isOpen,
  projectName,
  onClose,
  onConfirm,
  isDeleting
}: DeleteProjectDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Project">
      <div className="space-y-4">
        <div className="text-center py-4">
          <div className="text-6xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold mb-2">Delete "{projectName}"?</h3>
          <p className="text-muted-foreground">
            This will permanently delete:
          </p>
          <ul className="text-sm text-muted-foreground mt-2 space-y-1">
            <li>• All audio files and transcriptions</li>
            <li>• All speakers and segments</li>
            <li>• All LLM logs and analysis data</li>
            <li>• The project itself</li>
          </ul>
          <p className="text-red-600 dark:text-red-400 font-semibold mt-4">
            This action cannot be undone!
          </p>
        </div>

        <div className="flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={onConfirm}
            loading={isDeleting}
            className="bg-red-600 hover:bg-red-700"
          >
            Delete Project
          </Button>
        </div>
      </div>
    </Modal>
  )
}
