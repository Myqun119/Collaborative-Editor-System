import dayjs from 'dayjs'
import { useAuthStore } from '../../store/authStore'
import type {
    BackupStatus,
    CommentItem,
    DocumentItem,
    OperationLog,
    PermissionBinding,
    UserPreference,
    UserProfile,
    UserRole,
    VersionSnapshot,
} from '../../types'

type AuthFailureReason = 'missing-token' | 'expired-token'

const AUTH_FAILURE_EVENT = 'ces:auth-failure'
let lastAuthFailureAt = 0

interface MockDB {
    users: UserProfile[]
    documents: DocumentItem[]
    comments: CommentItem[]
    versions: VersionSnapshot[]
    permissions: PermissionBinding[]
    logs: OperationLog[]
    backup: BackupStatus
    settings: Record<string, string>
}

const KEY = 'ces-mock-db'
const RECYCLE_BIN_TTL_DAYS = 15

const defaultPreference: UserPreference = {
    theme: 'dawn',
    editorFontSize: 16,
    autoSaveIntervalSec: 30,
    showLineNumbers: true,
}

const seed: MockDB = {
    users: [
        {
            id: 'u-admin',
            username: 'admin',
            email: 'admin@collab.dev',
            role: 'admin',
            preferences: defaultPreference,
        },
        {
            id: 'u-editor',
            username: 'lin',
            email: 'lin@collab.dev',
            role: 'editor',
            preferences: defaultPreference,
        },
    ],
    documents: [
        {
            id: 'doc-1',
            title: '产品需求评审纪要',
            folder: '项目文档/评审',
            content: '<p>在这里开始多人协同编辑...</p>',
            updatedAt: dayjs().toISOString(),
            ownerId: 'u-editor',
            archived: false,
        },
    ],
    comments: [],
    versions: [],
    permissions: [
        {
            id: 'perm-1',
            targetType: 'document',
            targetId: 'doc-1',
            principal: 'lin',
            role: 'editor',
        },
    ],
    logs: [
        {
            id: 'log-1',
            level: 'info',
            source: 'system',
            message: '系统启动完成',
            time: dayjs().toISOString(),
        },
    ],
    backup: {
        lastBackupAt: dayjs().subtract(2, 'hour').toISOString(),
        schedule: '每 30 分钟',
        encrypted: true,
        inProgress: false,
    },
    settings: {
        websocketEndpoint: 'wss://api.example.com/collab',
        uploadLimit: '20MB',
        retentionDays: '90',
    },
}

const delay = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms))

const addLog = (db: MockDB, message: string, source = 'frontend', level: 'info' | 'warning' | 'error' = 'info') => {
    db.logs.unshift({
        id: `log-${Date.now()}`,
        level,
        source,
        message,
        time: dayjs().toISOString(),
    })
}

const purgeExpiredArchivedDocuments = (db: MockDB) => {
    const cutoff = dayjs().subtract(RECYCLE_BIN_TTL_DAYS, 'day')
    const beforeCount = db.documents.length
    db.documents = db.documents.filter((document) => {
        if (!document.archived || !document.archivedAt) {
            return true
        }
        return dayjs(document.archivedAt).isAfter(cutoff)
    })

    if (db.documents.length !== beforeCount) {
        addLog(db, `自动清理 ${beforeCount - db.documents.length} 条过期回收站文档`, 'document', 'warning')
    }
}

const readDb = (): MockDB => {
    const raw = localStorage.getItem(KEY)
    if (!raw) {
        localStorage.setItem(KEY, JSON.stringify(seed))
        return structuredClone(seed)
    }

    const db = JSON.parse(raw) as MockDB
    const beforeDocuments = db.documents.length
    purgeExpiredArchivedDocuments(db)
    if (db.documents.length !== beforeDocuments) {
        writeDb(db)
    }
    return db
}

const writeDb = (db: MockDB) => {
    localStorage.setItem(KEY, JSON.stringify(db))
}

const dispatchAuthFailure = (reason: AuthFailureReason) => {
    const now = Date.now()
    if (now - lastAuthFailureAt < 300) {
        return
    }
    lastAuthFailureAt = now
    useAuthStore.getState().logout()
    window.dispatchEvent(
        new CustomEvent(AUTH_FAILURE_EVENT, {
            detail: { reason, time: now },
        }),
    )
}

const ensureAuthorized = () => {
    const { token, tokenExpiresAt } = useAuthStore.getState()
    if (!token) {
        dispatchAuthFailure('missing-token')
        throw new Error('登录状态失效，请重新登录')
    }
    if (!tokenExpiresAt || Date.now() >= tokenExpiresAt) {
        dispatchAuthFailure('expired-token')
        throw new Error('登录已过期，请重新登录')
    }
}

export const api = {
    auth: {
        async register(payload: { username: string; email: string; password: string }) {
            await delay()
            const db = readDb()
            const exists = db.users.find((u) => u.username === payload.username || u.email === payload.email)
            if (exists) {
                throw new Error('账号或邮箱已存在')
            }
            const user: UserProfile = {
                id: `u-${Date.now()}`,
                username: payload.username,
                email: payload.email,
                role: 'viewer',
                preferences: defaultPreference,
            }
            db.users.push(user)
            addLog(db, `用户 ${payload.username} 完成注册`, 'auth')
            writeDb(db)
            return user
        },
        async login(payload: { account: string; password: string }) {
            await delay()
            const db = readDb()
            const user = db.users.find((u) => u.username === payload.account || u.email === payload.account)
            if (!user || payload.password.length < 6) {
                throw new Error('账号或密码错误')
            }
            if (user.disabled) {
                throw new Error('账号已被禁用')
            }
            addLog(db, `用户 ${user.username} 登录系统`, 'auth')
            writeDb(db)
            return {
                token: `token-${user.id}`,
                user,
            }
        },
    },

    users: {
        async list() {
            await delay()
            ensureAuthorized()
            return readDb().users
        },
        async updateProfile(id: string, patch: Partial<UserProfile>) {
            await delay()
            ensureAuthorized()
            const db = readDb()
            const idx = db.users.findIndex((u) => u.id === id)
            if (idx < 0) {
                throw new Error('用户不存在')
            }
            db.users[idx] = { ...db.users[idx], ...patch }
            addLog(db, `更新用户 ${db.users[idx].username} 资料`, 'user')
            writeDb(db)
            return db.users[idx]
        },
        async disableUser(id: string, disabled: boolean) {
            ensureAuthorized()
            return api.users.updateProfile(id, { disabled })
        },
        async create(payload: { username: string; email: string; role: UserRole }) {
            ensureAuthorized()
            return api.auth.register({ ...payload, password: '123456' })
        },
    },

    documents: {
        async list(options?: { includeArchived?: boolean }) {
            await delay()
            ensureAuthorized()
            const documents = readDb().documents
            return options?.includeArchived ? documents : documents.filter((document) => !document.archived)
        },
        async create(payload: { title: string; folder: string; ownerId: string }) {
            await delay()
            ensureAuthorized()
            const db = readDb()
            const item: DocumentItem = {
                id: `doc-${Date.now()}`,
                title: payload.title,
                folder: payload.folder,
                content: '<p>新文档</p>',
                ownerId: payload.ownerId,
                archived: false,
                archivedAt: undefined,
                updatedAt: dayjs().toISOString(),
            }
            db.documents.unshift(item)
            addLog(db, `创建文档 ${item.title}`, 'document')
            writeDb(db)
            return item
        },
        async save(id: string, content: string) {
            await delay(120)
            ensureAuthorized()
            const db = readDb()
            const doc = db.documents.find((d) => d.id === id)
            if (!doc) {
                throw new Error('文档不存在')
            }
            doc.content = content
            doc.updatedAt = dayjs().toISOString()
            addLog(db, `保存文档 ${doc.title}`, 'document')
            writeDb(db)
            return doc
        },
        async rename(id: string, title: string) {
            await delay()
            ensureAuthorized()
            const db = readDb()
            const doc = db.documents.find((d) => d.id === id)
            if (!doc) {
                throw new Error('文档不存在')
            }
            doc.title = title
            doc.updatedAt = dayjs().toISOString()
            addLog(db, `重命名文档为 ${title}`, 'document')
            writeDb(db)
            return doc
        },
        async move(id: string, folder: string) {
            await delay()
            ensureAuthorized()
            const db = readDb()
            const doc = db.documents.find((d) => d.id === id)
            if (!doc) {
                throw new Error('文档不存在')
            }
            doc.folder = folder
            doc.updatedAt = dayjs().toISOString()
            addLog(db, `移动文档 ${doc.title} 到 ${folder}`, 'document')
            writeDb(db)
            return doc
        },
        async remove(id: string) {
            await delay()
            ensureAuthorized()
            const db = readDb()
            const doc = db.documents.find((document) => document.id === id)
            if (!doc) {
                throw new Error('文档不存在')
            }
            doc.archived = true
            doc.archivedAt = dayjs().toISOString()
            doc.updatedAt = dayjs().toISOString()
            addLog(db, `文档移入回收站 ${doc.title}`, 'document', 'warning')
            writeDb(db)
        },
        async archive(id: string, archived: boolean) {
            await delay()
            ensureAuthorized()
            const db = readDb()
            const doc = db.documents.find((item) => item.id === id)
            if (!doc) {
                throw new Error('文档不存在')
            }
            doc.archived = archived
            doc.archivedAt = archived ? doc.archivedAt ?? dayjs().toISOString() : undefined
            doc.updatedAt = dayjs().toISOString()
            addLog(db, `${archived ? '归档' : '恢复'}文档 ${doc.title}`, 'document', archived ? 'warning' : 'info')
            writeDb(db)
            return doc
        },
        async purge(id: string) {
            await delay()
            ensureAuthorized()
            const db = readDb()
            const doc = db.documents.find((item) => item.id === id)
            if (!doc) {
                throw new Error('文档不存在')
            }
            db.documents = db.documents.filter((item) => item.id !== id)
            addLog(db, `彻底删除文档 ${doc.title}`, 'document', 'error')
            writeDb(db)
        },
        async purgeExpired() {
            await delay()
            ensureAuthorized()
            const db = readDb()
            const cutoff = dayjs().subtract(RECYCLE_BIN_TTL_DAYS, 'day')
            const beforeCount = db.documents.length
            db.documents = db.documents.filter((document) => {
                if (!document.archived || !document.archivedAt) {
                    return true
                }
                return dayjs(document.archivedAt).isAfter(cutoff)
            })
            const removedCount = beforeCount - db.documents.length
            if (removedCount > 0) {
                addLog(db, `管理员手动清理 ${removedCount} 条过期回收站文档`, 'document', 'warning')
            }
            writeDb(db)
            return removedCount
        },
    },

    collaboration: {
        async listComments(documentId: string) {
            await delay(80)
            ensureAuthorized()
            return readDb().comments.filter((c) => c.documentId === documentId)
        },
        async addComment(documentId: string, author: string, content: string) {
            await delay(80)
            ensureAuthorized()
            const db = readDb()
            const comment: CommentItem = {
                id: `comment-${Date.now()}`,
                documentId,
                author,
                content,
                createdAt: dayjs().toISOString(),
                replies: [],
            }
            db.comments.unshift(comment)
            addLog(db, `新增批注：${content.slice(0, 10)}...`, 'collaboration')
            writeDb(db)
            return comment
        },
        async reply(commentId: string, author: string, content: string) {
            await delay(80)
            ensureAuthorized()
            const db = readDb()
            const comment = db.comments.find((c) => c.id === commentId)
            if (!comment) {
                throw new Error('批注不存在')
            }
            comment.replies.push({
                id: `reply-${Date.now()}`,
                author,
                content,
                createdAt: dayjs().toISOString(),
            })
            writeDb(db)
            return comment
        },
        async remove(commentId: string) {
            await delay(80)
            ensureAuthorized()
            const db = readDb()
            db.comments = db.comments.filter((c) => c.id !== commentId)
            writeDb(db)
        },
    },

    versions: {
        async list(documentId: string) {
            await delay()
            ensureAuthorized()
            return readDb().versions.filter((v) => v.documentId === documentId)
        },
        async createSnapshot(documentId: string, author: string, content: string, summary: string) {
            await delay(80)
            ensureAuthorized()
            const db = readDb()
            const version: VersionSnapshot = {
                id: `v-${Date.now()}`,
                documentId,
                author,
                summary,
                content,
                createdAt: dayjs().toISOString(),
            }
            db.versions.unshift(version)
            addLog(db, `创建版本快照 ${version.id}`, 'version')
            writeDb(db)
            return version
        },
    },

    permissions: {
        async list() {
            await delay()
            ensureAuthorized()
            return readDb().permissions
        },
        async upsert(payload: PermissionBinding) {
            await delay()
            ensureAuthorized()
            const db = readDb()
            const idx = db.permissions.findIndex((p) => p.id === payload.id)
            if (idx < 0) {
                db.permissions.push(payload)
            } else {
                db.permissions[idx] = payload
            }
            addLog(db, `更新权限 ${payload.principal} -> ${payload.role}`, 'permission')
            writeDb(db)
            return payload
        },
        async revoke(id: string) {
            await delay()
            ensureAuthorized()
            const db = readDb()
            db.permissions = db.permissions.filter((p) => p.id !== id)
            writeDb(db)
        },
    },

    security: {
        async getBackupStatus() {
            await delay()
            ensureAuthorized()
            return readDb().backup
        },
        async runBackup() {
            await delay(300)
            ensureAuthorized()
            const db = readDb()
            db.backup.lastBackupAt = dayjs().toISOString()
            addLog(db, '触发手动备份任务', 'backup')
            writeDb(db)
            return db.backup
        },
        async recover(point: string) {
            await delay(300)
            ensureAuthorized()
            const db = readDb()
            addLog(db, `执行异常恢复，恢复点 ${point}`, 'backup', 'warning')
            writeDb(db)
            return { success: true }
        },
        async exportDocument(documentId: string, format: 'docx' | 'pdf' | 'md') {
            await delay(300)
            ensureAuthorized()
            const db = readDb()
            const doc = db.documents.find((d) => d.id === documentId)
            if (!doc) {
                throw new Error('文档不存在')
            }
            addLog(db, `导出文档 ${doc.title} 为 ${format}`, 'export')
            writeDb(db)
            return { url: `https://download.mock/${documentId}.${format}` }
        },
    },

    admin: {
        async logs() {
            await delay()
            ensureAuthorized()
            return readDb().logs
        },
        async getSettings() {
            await delay()
            ensureAuthorized()
            return readDb().settings
        },
        async updateSettings(settings: Record<string, string>) {
            await delay()
            ensureAuthorized()
            const db = readDb()
            db.settings = { ...db.settings, ...settings }
            addLog(db, '更新系统参数', 'admin')
            writeDb(db)
            return db.settings
        },
    },
}
