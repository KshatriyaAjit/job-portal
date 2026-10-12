"use client";

import { useState, useTransition } from "react";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";

interface DeleteConfirmButtonProps {
  itemId: string;
  itemTitle: string;
  itemType?: string;
  onDelete: (id: string) => Promise<void>;
  buttonText?: string;
  className?: string;
}

export default function DeleteConfirmButton({
  itemId,
  itemTitle,
  itemType = "job listing",
  onDelete,
  buttonText = "Delete",
  className = "flex items-center gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition border border-red-200 text-sm font-medium cursor-pointer",
}: DeleteConfirmButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleConfirmDelete = () => {
    setError(null);
    startTransition(async () => {
      try {
        await onDelete(itemId);
        setIsOpen(false);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to delete item.";
        setError(message);
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={className}
        title={`Delete ${itemTitle}`}
      >
        <Trash2 className="w-4 h-4" />
        <span>{buttonText}</span>
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isPending) {
              setIsOpen(false);
            }
          }}
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 transform transition-all animate-scale-up">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 id="delete-dialog-title" className="text-lg font-bold text-gray-900">
                  Delete {itemType}
                </h3>
                <p className="text-xs text-gray-500">This action is permanent and cannot be undone.</p>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
              Are you sure you want to permanently delete{" "}
              <strong className="text-gray-900 font-semibold">&ldquo;{itemTitle}&rdquo;</strong>?
              All candidate applications and bookmarks associated with this job will also be removed.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-medium">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                disabled={isPending}
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-100 transition text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isPending}
                onClick={handleConfirmDelete}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 transition text-sm shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
