'use client'

import { useState } from 'react'
import { Edit3, Clock, User, AlertTriangle, CheckCircle, XCircle, Minus, FileText } from 'lucide-react'
import { EditHistoryModal } from './EditHistoryModal'

interface Post {
  id: string;
  edit_count?: number;
  last_edited_at?: string;
  last_edited_by?: {
    id: string;
    name: string;
    email: string;
  };
  needs_reapproval?: boolean;
  approval_status?: 'pending' | 'approved' | 'rejected' | 'needs_attention' | 'draft';
  status?: 'draft' | 'ready' | 'scheduled' | 'published' | 'archived' | 'deleted';
}

interface EditIndicatorsProps {
  post: Post;
  clientId: string;
  showHistory?: boolean;
}

export function EditIndicators({ post, clientId, showHistory = true }: EditIndicatorsProps) {
  const [showEditHistory, setShowEditHistory] = useState(false)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getApprovalStatusBadge = () => {
    const status = post.approval_status || 'pending'
    const baseClasses = "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
    
    switch (status) {
      case 'approved':
        return (
          <span className={`${baseClasses} bg-green-100 text-green-800`}>
            <CheckCircle className="w-3 h-3 mr-1" />
            Approved
          </span>
        )
      case 'rejected':
        return (
          <span className={`${baseClasses} bg-red-100 text-red-800`}>
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </span>
        )
      case 'needs_attention':
        return (
          <span className={`${baseClasses} bg-orange-100 text-orange-800`}>
            <AlertTriangle className="w-3 h-3 mr-1" />
            Needs Attention
          </span>
        )
      case 'draft':
        return (
          <span className={`${baseClasses} bg-gray-100 text-gray-800`}>
            <FileText className="w-3 h-3 mr-1" />
            Draft
          </span>
        )
      default:
        return (
          <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}>
            <Minus className="w-3 h-3 mr-1" />
            Pending
          </span>
        )
    }
  }

  const hasEdits = (post.edit_count || 0) > 0
  const needsReapproval = post.needs_reapproval

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {/* Approval Status Badge */}
        {getApprovalStatusBadge()}

        {/* Edit Count Indicator */}
        {hasEdits && (
          <button
            onClick={() => showHistory && setShowEditHistory(true)}
            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium transition-colors ${
              showHistory 
                ? 'bg-blue-100 text-blue-800 hover:bg-blue-200 cursor-pointer' 
                : 'bg-blue-100 text-blue-800'
            }`}
            title={showHistory ? 'Click to view edit history' : `${post.edit_count} edit${post.edit_count === 1 ? '' : 's'}`}
          >
            <Edit3 className="w-3 h-3 mr-1" />
            {post.edit_count} edit{post.edit_count === 1 ? '' : 's'}
          </button>
        )}

        {/* Needs Reapproval Badge */}
        {needsReapproval && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Needs Reapproval
          </span>
        )}

        {/* Last Edited Info */}
        {post.last_edited_at && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Clock className="w-3 h-3" />
            <span>Edited {formatDate(post.last_edited_at)}</span>
            {post.last_edited_by && (
              <>
                <span>by</span>
                <span className="font-medium">{post.last_edited_by.name}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Edit History Modal */}
      {showHistory && (
        <EditHistoryModal
          isOpen={showEditHistory}
          onClose={() => setShowEditHistory(false)}
          postId={post.id}
          clientId={clientId}
        />
      )}
    </>
  )
}
