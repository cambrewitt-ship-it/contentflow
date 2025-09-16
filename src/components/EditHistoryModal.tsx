'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from 'components/ui/dialog'
import { Button } from 'components/ui/button'
import { Loader2, Clock, User, FileText, X } from 'lucide-react'

interface EditRevision {
  id: string;
  edited_at: string;
  edited_by: {
    id: string;
    name: string;
    email: string;
  };
  previous_caption: string | null;
  new_caption: string | null;
  edit_reason: string | null;
  revision_number: number;
}

interface EditHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
  clientId: string;
}

export function EditHistoryModal({ isOpen, onClose, postId, clientId }: EditHistoryModalProps) {
  const [revisions, setRevisions] = useState<EditRevision[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && postId) {
      fetchEditHistory()
    }
  }, [isOpen, postId])

  const fetchEditHistory = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/posts-by-id/${postId}/revisions?client_id=${clientId}`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch edit history: ${response.status}`)
      }
      
      const data = await response.json()
      setRevisions(data.revisions || [])
    } catch (err) {
      console.error('Error fetching edit history:', err)
      setError(err instanceof Error ? err.message : 'Failed to load edit history')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getChangeDescription = (revision: EditRevision) => {
    if (revision.previous_caption && revision.new_caption) {
      const prevLength = revision.previous_caption.length
      const newLength = revision.new_caption.length
      const lengthChange = newLength - prevLength
      
      if (lengthChange > 0) {
        return `Added ${lengthChange} characters`
      } else if (lengthChange < 0) {
        return `Removed ${Math.abs(lengthChange)} characters`
      } else {
        return 'Content modified'
      }
    }
    return 'Content updated'
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Edit History
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400 mr-2" />
              <span className="text-gray-600">Loading edit history...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-600 mb-4">{error}</p>
              <Button onClick={fetchEditHistory} variant="outline">
                Try Again
              </Button>
            </div>
          ) : revisions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No edit history available</p>
            </div>
          ) : (
            <div className="space-y-4">
              {revisions.map((revision, index) => (
                <div key={revision.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-blue-700">
                          {revision.revision_number}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {revision.edited_by.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {revision.edited_by.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Clock className="w-4 h-4" />
                      {formatDate(revision.edited_at)}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1">
                        Change: {getChangeDescription(revision)}
                      </p>
                      {revision.edit_reason && (
                        <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                          <strong>Reason:</strong> {revision.edit_reason}
                        </p>
                      )}
                    </div>

                    {revision.previous_caption && revision.new_caption && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">Before:</p>
                          <div className="bg-red-50 border border-red-200 rounded p-2 text-sm">
                            <p className="text-gray-700 line-clamp-3">
                              {revision.previous_caption}
                            </p>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">After:</p>
                          <div className="bg-green-50 border border-green-200 rounded p-2 text-sm">
                            <p className="text-gray-700 line-clamp-3">
                              {revision.new_caption}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t border-gray-200">
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
