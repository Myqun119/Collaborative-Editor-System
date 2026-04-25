export type UserRole = 'owner' | 'editor' | 'reviewer' | 'viewer' | 'admin'

export interface UserProfile {
    id: string
    username: string
    email: string
    role: UserRole
    disabled?: boolean
    preferences: UserPreference
}

export interface UserPreference {
    theme: 'dawn' | 'forest' | 'night'
    editorFontSize: number
    autoSaveIntervalSec: number
    showLineNumbers: boolean
}

export interface DocumentItem {
    id: string
    title: string
    folder: string
    content: string
    updatedAt: string
    ownerId: string
    archived?: boolean
    archivedAt?: string
}

export interface CollaborationMember {
    userId: string
    username: string
    color: string
    cursor: number
    online: boolean
}

export interface CommentItem {
    id: string
    documentId: string
    author: string
    content: string
    createdAt: string
    replies: Array<{ id: string; author: string; content: string; createdAt: string }>
}

export interface VersionSnapshot {
    id: string
    documentId: string
    createdAt: string
    author: string
    summary: string
    content: string
}

export interface PermissionBinding {
    id: string
    targetType: 'user' | 'document' | 'folder'
    targetId: string
    role: UserRole
    principal: string
}

export interface BackupStatus {
    lastBackupAt: string
    schedule: string
    encrypted: boolean
    inProgress: boolean
}

export interface OperationLog {
    id: string
    level: 'info' | 'warning' | 'error'
    source: string
    message: string
    time: string
}
