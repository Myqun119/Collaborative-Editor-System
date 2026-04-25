import { useCallback, useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { api } from '../../lib/api/client.ts'
import type { DocumentItem, PermissionBinding, UserRole } from '../../types'
import { RichTextEditor } from '../../components/editor/RichTextEditor'
import { collabSocket } from '../../lib/ws/collabSocket'
import type { CollabEvent } from '../../lib/ws/collabSocket'
import { usePreferenceStore } from '../../store/preferenceStore'
import { useAuthStore } from '../../store/authStore'
import { useAutoSave } from '../../hooks/useAutoSave'
import { useDocStore } from '../../store/docStore'

const editableRoles = new Set<UserRole>(['owner', 'editor', 'admin'])

export const DocumentPage = () => {
    const user = useAuthStore((state) => state.currentUser)
    const preference = usePreferenceStore((state) => state.preference)
    const setCurrentDoc = useDocStore((state) => state.setCurrentDoc)

    const [docs, setDocs] = useState<DocumentItem[]>([])
    const [permissions, setPermissions] = useState<PermissionBinding[]>([])
    const [activeId, setActiveId] = useState<string>('')
    const [content, setContent] = useState('')
    const [notice, setNotice] = useState('')
    const [remoteNotice, setRemoteNotice] = useState('')
    const [pendingRemoteMerge, setPendingRemoteMerge] = useState<Extract<CollabEvent, { type: 'editor-op' }> | null>(null)

    const activeDoc = useMemo(() => docs.find((doc) => doc.id === activeId) ?? null, [docs, activeId])

    const selectDoc = useCallback(
        (doc: DocumentItem) => {
            setActiveId(doc.id)
            setCurrentDoc(doc)
            setContent(doc.content)
        },
        [setCurrentDoc],
    )

    const loadDocs = useCallback(async () => {
        const list = await api.documents.list()
        setDocs(list)
        if (list.length === 0) {
            setActiveId('')
            setCurrentDoc(null)
            setContent('')
            return
        }

        const nextDoc = (activeId && list.find((doc) => doc.id === activeId)) || list[0]
        selectDoc(nextDoc)
    }, [activeId, selectDoc, setCurrentDoc])

    const loadPermissions = useCallback(async () => {
        const list = await api.permissions.list()
        setPermissions(list)
    }, [])

    const resolveRole = useCallback(
        (doc: DocumentItem | null): UserRole => {
            if (!user || !doc) {
                return 'viewer'
            }
            if (user.role === 'admin') {
                return 'admin'
            }
            if (doc.ownerId === user.id) {
                return 'owner'
            }
            const bound = permissions.find(
                (permission) =>
                    permission.targetType === 'document' &&
                    permission.targetId === doc.id &&
                    permission.principal === user.username,
            )
            return bound?.role ?? 'viewer'
        },
        [permissions, user],
    )

    const canEditDoc = useCallback(
        (doc: DocumentItem | null) => {
            return editableRoles.has(resolveRole(doc))
        },
        [resolveRole],
    )

    const canEditActiveDoc = canEditDoc(activeDoc)
    const isDirty = Boolean(activeDoc && content !== activeDoc.content)

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void Promise.all([loadDocs(), loadPermissions()])
        }, 0)
        return () => window.clearTimeout(timer)
    }, [loadDocs, loadPermissions])

    useEffect(() => {
        collabSocket.connect('wss://api.example.com/collab')
        const unsubscribe = collabSocket.onEvent((event) => {
            if (event.type !== 'editor-op') {
                return
            }
            if (!activeDoc || event.documentId !== activeDoc.id) {
                return
            }
            if (event.user === (user?.username ?? 'guest')) {
                return
            }

            setRemoteNotice(`收到 ${event.user} 的${event.op === 'input' ? '输入' : '格式'}更新`)

            if (!isDirty) {
                setContent(event.html)
                setNotice(`已自动合并 ${event.user} 的远端更新`)
                setPendingRemoteMerge(null)
                return
            }

            setPendingRemoteMerge(event)
        })

        return () => unsubscribe()
    }, [activeDoc, isDirty, user])

    const saveNow = useCallback(async () => {
        if (!activeDoc || !canEditActiveDoc) {
            return
        }
        const updated = await api.documents.save(activeDoc.id, content)
        setDocs((prev) => prev.map((doc) => (doc.id === updated.id ? updated : doc)))
        setCurrentDoc(updated)
        setNotice(`已保存 ${dayjs(updated.updatedAt).format('HH:mm:ss')}`)
    }, [activeDoc, canEditActiveDoc, content, setCurrentDoc])

    useAutoSave(Boolean(activeDoc && canEditActiveDoc), preference.autoSaveIntervalSec, saveNow)

    const canCreateDoc = Boolean(user && editableRoles.has(user.role))

    const createDoc = async () => {
        if (!user) {
            return
        }
        const doc = await api.documents.create({
            title: `新建文档 ${docs.length + 1}`,
            folder: '默认目录',
            ownerId: user.id,
        })
        await loadDocs()
        selectDoc(doc)
        setNotice('文档创建成功')
    }

    return (
        <section className="page-grid docs-grid">
            <article className="panel">
                <h2>文档基础操作</h2>
                <div
                    style={{
                        marginTop: '0.75rem',
                        marginBottom: '0.85rem',
                        border: '1px solid rgba(79, 209, 197, 0.2)',
                        borderRadius: '14px',
                        padding: '0.75rem',
                        background: 'rgba(255, 255, 255, 0.78)',
                    }}
                >
                    <div className="actions" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.45rem' }}>
                        <button onClick={() => void createDoc()} disabled={!canCreateDoc} title={canCreateDoc ? '' : '当前角色不可新建文档'}>
                            新建文档
                        </button>
                        <button
                            className="ghost"
                            onClick={() => void saveNow()}
                            disabled={!canEditActiveDoc}
                            title={canEditActiveDoc ? '' : '当前文档为只读权限'}
                        >
                            手动保存
                        </button>
                    </div>
                </div>
                <ul className="doc-list">
                    {docs.map((doc) => (
                        <li key={doc.id} className={doc.id === activeId ? 'active' : ''} style={{ display: 'grid', gap: '0.65rem' }}>
                            <div
                                style={{
                                    border: '1px solid rgba(79, 209, 197, 0.24)',
                                    borderRadius: '12px',
                                    padding: '0.65rem',
                                    background: 'rgba(255, 255, 255, 0.86)',
                                }}
                            >
                                <button onClick={() => selectDoc(doc)}>{doc.title}</button>
                                <small style={{ display: 'block', marginTop: '0.35rem' }}>{doc.folder}</small>
                                <small style={{ display: 'block', marginTop: '0.2rem' }}>
                                    权限：{canEditDoc(doc) ? '可编辑' : '只读'}
                                </small>
                            </div>
                            <div
                                style={{
                                    border: '1px dashed rgba(148, 163, 184, 0.36)',
                                    borderRadius: '12px',
                                    padding: '0.65rem',
                                    background: 'rgba(255, 255, 255, 0.62)',
                                }}
                            >
                                <div
                                    className="line-actions"
                                    style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.4rem' }}
                                >
                                    <button
                                        className="ghost"
                                        disabled={!canEditDoc(doc)}
                                        title={canEditDoc(doc) ? '' : '当前文档为只读权限'}
                                        onClick={async () => {
                                            if (!canEditDoc(doc)) {
                                                return
                                            }
                                            const title = window.prompt('输入新文档名', doc.title)
                                            if (title) {
                                                await api.documents.rename(doc.id, title)
                                                await loadDocs()
                                            }
                                        }}
                                    >
                                        更名
                                    </button>
                                    <button
                                        className="ghost"
                                        disabled={!canEditDoc(doc)}
                                        title={canEditDoc(doc) ? '' : '当前文档为只读权限'}
                                        onClick={async () => {
                                            if (!canEditDoc(doc)) {
                                                return
                                            }
                                            const folder = window.prompt('输入目标目录', doc.folder)
                                            if (folder) {
                                                await api.documents.move(doc.id, folder)
                                                await loadDocs()
                                            }
                                        }}
                                    >
                                        移动
                                    </button>
                                    <button
                                        className="ghost"
                                        style={{ color: '#b91c1c' }}
                                        disabled={!canEditDoc(doc)}
                                        title={canEditDoc(doc) ? '' : '当前文档为只读权限'}
                                        onClick={async () => {
                                            if (!canEditDoc(doc)) {
                                                return
                                            }
                                            await api.documents.remove(doc.id)
                                            setNotice('文档已移入回收站')
                                            await loadDocs()
                                        }}
                                    >
                                        移入回收站
                                    </button>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            </article>
            <article className="panel">
                <h3>{activeDoc?.title ?? '请选择文档'}</h3>
                <p>自动保存间隔: {preference.autoSaveIntervalSec} 秒</p>
                <p>当前权限: {canEditActiveDoc ? '可编辑' : '只读'}</p>
                {remoteNotice ? <p className="message">{remoteNotice}</p> : null}
                {pendingRemoteMerge ? (
                    <div
                        style={{
                            marginTop: '0.55rem',
                            marginBottom: '0.55rem',
                            border: '1px solid rgba(79, 209, 197, 0.3)',
                            borderRadius: '12px',
                            padding: '0.6rem',
                            background: 'rgba(224, 247, 250, 0.45)',
                        }}
                    >
                        <p style={{ marginBottom: '0.4rem' }}>
                            远端更新待合并：{pendingRemoteMerge.user}（{pendingRemoteMerge.op === 'input' ? '输入' : '格式'}）
                        </p>
                        <small style={{ display: 'block', marginBottom: '0.5rem' }}>{pendingRemoteMerge.preview || '无预览内容'}</small>
                        <div className="inline-actions">
                            <button
                                className="ghost"
                                onClick={() => {
                                    setContent(pendingRemoteMerge.html)
                                    setPendingRemoteMerge(null)
                                    setNotice(`已合并 ${pendingRemoteMerge.user} 的远端更新`)
                                }}
                            >
                                合并远端更新
                            </button>
                            <button
                                className="ghost"
                                onClick={() => {
                                    setPendingRemoteMerge(null)
                                    setRemoteNotice('已忽略一次远端更新')
                                }}
                            >
                                暂不合并
                            </button>
                        </div>
                    </div>
                ) : null}
                {activeDoc ? <RichTextEditor content={content} onChange={setContent} editable={canEditActiveDoc} /> : null}
                {notice ? <p className="message">{notice}</p> : null}
            </article>
        </section>
    )
}
