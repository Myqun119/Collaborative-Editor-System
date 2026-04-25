import { useCallback, useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { api } from '../../lib/api/client.ts'
import type { DocumentItem, OperationLog, UserProfile, UserRole } from '../../types'

const roles: UserRole[] = ['admin', 'owner', 'editor', 'reviewer', 'viewer']

type AdminView = 'documents' | 'recycle'
type BinDeadlineFilter = 'all' | 'today' | 'within3' | 'within7'
type BinSortMode = 'remain-asc' | 'remain-desc' | 'archived-desc' | 'archived-asc'

const getDaysLeft = (archivedAt?: string) => {
    if (!archivedAt) {
        return 15
    }
    const days = 15 - dayjs().diff(dayjs(archivedAt), 'day')
    return Math.max(0, days)
}

export const AdminPage = () => {
    const [users, setUsers] = useState<UserProfile[]>([])
    const [documents, setDocuments] = useState<DocumentItem[]>([])
    const [logs, setLogs] = useState<OperationLog[]>([])
    const [settings, setSettings] = useState<Record<string, string>>({})

    const [view, setView] = useState<AdminView>('documents')
    const [docQuery, setDocQuery] = useState('')
    const [binQuery, setBinQuery] = useState('')
    const [binDeadlineFilter, setBinDeadlineFilter] = useState<BinDeadlineFilter>('all')
    const [binSortMode, setBinSortMode] = useState<BinSortMode>('remain-asc')
    const [selectedBinIds, setSelectedBinIds] = useState<string[]>([])
    const [docNotice, setDocNotice] = useState('')

    const load = useCallback(async () => {
        const [loadedUsers, loadedDocuments, loadedLogs, loadedSettings] = await Promise.all([
            api.users.list(),
            api.documents.list({ includeArchived: true }),
            api.admin.logs(),
            api.admin.getSettings(),
        ])

        setUsers(loadedUsers)
        setDocuments(loadedDocuments)
        setLogs(loadedLogs)
        setSettings(loadedSettings)
    }, [])

    useEffect(() => {
        void load()
    }, [load])

    const activeDocuments = useMemo(() => {
        const keyword = docQuery.trim().toLowerCase()
        return documents
            .filter((doc) => !doc.archived)
            .filter((doc) => {
                if (!keyword) {
                    return true
                }
                return [doc.title, doc.folder, doc.ownerId, doc.id].some((value) => value.toLowerCase().includes(keyword))
            })
    }, [documents, docQuery])

    const archivedDocuments = useMemo(() => {
        const keyword = binQuery.trim().toLowerCase()
        return documents
            .filter((doc) => Boolean(doc.archived))
            .filter((doc) => {
                if (!keyword) {
                    return true
                }
                return [doc.title, doc.folder, doc.ownerId, doc.id].some((value) => value.toLowerCase().includes(keyword))
            })
            .filter((doc) => {
                const daysLeft = getDaysLeft(doc.archivedAt)
                if (binDeadlineFilter === 'today') {
                    return daysLeft === 0
                }
                if (binDeadlineFilter === 'within3') {
                    return daysLeft <= 3
                }
                if (binDeadlineFilter === 'within7') {
                    return daysLeft <= 7
                }
                return true
            })
            .sort((a, b) => {
                if (binSortMode === 'remain-asc') {
                    return getDaysLeft(a.archivedAt) - getDaysLeft(b.archivedAt)
                }
                if (binSortMode === 'remain-desc') {
                    return getDaysLeft(b.archivedAt) - getDaysLeft(a.archivedAt)
                }
                if (binSortMode === 'archived-asc') {
                    return dayjs(a.archivedAt ?? a.updatedAt).valueOf() - dayjs(b.archivedAt ?? b.updatedAt).valueOf()
                }
                return dayjs(b.archivedAt ?? b.updatedAt).valueOf() - dayjs(a.archivedAt ?? a.updatedAt).valueOf()
            })
    }, [documents, binQuery, binDeadlineFilter, binSortMode])

    const expiringSoonCount = useMemo(() => {
        return archivedDocuments.filter((doc) => getDaysLeft(doc.archivedAt) <= 3).length
    }, [archivedDocuments])

    useEffect(() => {
        setSelectedBinIds((prev) => prev.filter((id) => archivedDocuments.some((doc) => doc.id === id)))
    }, [archivedDocuments])

    const onRenameDoc = async (doc: DocumentItem) => {
        const title = window.prompt('输入新文档标题', doc.title)
        if (!title) {
            return
        }
        await api.documents.rename(doc.id, title)
        setDocNotice(`已更新文档标题：${title}`)
        await load()
    }

    const onMoveDoc = async (doc: DocumentItem) => {
        const folder = window.prompt('输入新目录', doc.folder)
        if (!folder) {
            return
        }
        await api.documents.move(doc.id, folder)
        setDocNotice('文档目录已更新')
        await load()
    }

    const onArchiveDoc = async (doc: DocumentItem) => {
        await api.documents.archive(doc.id, true)
        setDocNotice('文档已移入回收站')
        await load()
    }

    const onRestoreDoc = async (doc: DocumentItem) => {
        await api.documents.archive(doc.id, false)
        setDocNotice('文档已恢复')
        await load()
    }

    const onPurgeDoc = async (doc: DocumentItem) => {
        const confirmed = window.confirm(`确认彻底删除「${doc.title}」吗？该操作不可恢复。`)
        if (!confirmed) {
            return
        }
        await api.documents.purge(doc.id)
        setDocNotice('文档已彻底删除')
        await load()
    }

    const toggleBinSelection = (id: string, checked: boolean) => {
        setSelectedBinIds((prev) => {
            if (checked) {
                return prev.includes(id) ? prev : [...prev, id]
            }
            return prev.filter((item) => item !== id)
        })
    }

    const selectAllArchived = (checked: boolean) => {
        if (!checked) {
            setSelectedBinIds([])
            return
        }
        setSelectedBinIds(archivedDocuments.map((doc) => doc.id))
    }

    const batchRestore = async () => {
        if (selectedBinIds.length === 0) {
            return
        }
        await Promise.all(selectedBinIds.map((id) => api.documents.archive(id, false)))
        setDocNotice(`已恢复 ${selectedBinIds.length} 个文档`)
        setSelectedBinIds([])
        await load()
    }

    const batchPurge = async () => {
        if (selectedBinIds.length === 0) {
            return
        }
        const confirmed = window.confirm(`确认彻底删除选中的 ${selectedBinIds.length} 个文档吗？该操作不可恢复。`)
        if (!confirmed) {
            return
        }
        await Promise.all(selectedBinIds.map((id) => api.documents.purge(id)))
        setDocNotice(`已彻底删除 ${selectedBinIds.length} 个文档`)
        setSelectedBinIds([])
        await load()
    }

    const purgeExpiredNow = async () => {
        const removedCount = await api.documents.purgeExpired()
        setDocNotice(removedCount > 0 ? `已清理 ${removedCount} 个超过 15 天的文档` : '当前没有超过 15 天的回收站文档')
        await load()
    }

    return (
        <section className="page-grid">
            <article className="panel">
                <h2>管理员控制台</h2>
                <p style={{ marginTop: '0.5rem' }}>系统级治理、文档总览与回收站独立管理</p>
                <div className="inline-actions" style={{ marginTop: '0.75rem' }}>
                    <button className={view === 'documents' ? '' : 'ghost'} onClick={() => setView('documents')}>
                        文档管理
                    </button>
                    <button className={view === 'recycle' ? '' : 'ghost'} onClick={() => setView('recycle')}>
                        回收站管理
                    </button>
                </div>
                <div className="inline-actions" style={{ marginTop: '0.75rem' }}>
                    <input
                        value={settings.websocketEndpoint ?? ''}
                        onChange={(e) => setSettings((prev) => ({ ...prev, websocketEndpoint: e.target.value }))}
                        placeholder="WebSocket Endpoint"
                    />
                    <button
                        onClick={async () => {
                            await api.admin.updateSettings(settings)
                            setDocNotice('系统参数已保存')
                            await load()
                        }}
                    >
                        保存系统参数
                    </button>
                </div>
            </article>

            <article className="panel">
                <h3>用户与角色管控</h3>
                <table>
                    <thead>
                        <tr>
                            <th>用户名</th>
                            <th>角色</th>
                            <th>状态</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((user) => (
                            <tr key={user.id}>
                                <td>{user.username}</td>
                                <td>
                                    <select
                                        value={user.role}
                                        onChange={async (e) => {
                                            await api.users.updateProfile(user.id, { role: e.target.value as UserRole })
                                            setDocNotice(`已更新 ${user.username} 的角色`)
                                            await load()
                                        }}
                                    >
                                        {roles.map((role) => (
                                            <option key={role} value={role}>
                                                {role}
                                            </option>
                                        ))}
                                    </select>
                                </td>
                                <td>{user.disabled ? '禁用' : '正常'}</td>
                                <td>
                                    <button
                                        className="ghost"
                                        onClick={async () => {
                                            await api.users.disableUser(user.id, !user.disabled)
                                            setDocNotice(user.disabled ? '用户已启用' : '用户已禁用')
                                            await load()
                                        }}
                                    >
                                        {user.disabled ? '启用' : '禁用'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </article>

            {view === 'documents' ? (
                <article className="panel">
                    <h3>文档总览管理</h3>
                    <div className="inline-actions" style={{ marginTop: '0.65rem' }}>
                        <input
                            value={docQuery}
                            onChange={(e) => setDocQuery(e.target.value)}
                            placeholder="搜索标题 / 目录 / 所有者 / ID"
                        />
                        <p style={{ minWidth: '8rem' }}>文档数：{activeDocuments.length}</p>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>标题</th>
                                <th>目录</th>
                                <th>所有者</th>
                                <th>更新时间</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activeDocuments.map((doc) => (
                                <tr key={doc.id}>
                                    <td>
                                        <strong>{doc.title}</strong>
                                        <div style={{ fontSize: '0.82em', color: 'var(--muted)' }}>{doc.id}</div>
                                    </td>
                                    <td>{doc.folder}</td>
                                    <td>{doc.ownerId}</td>
                                    <td>{dayjs(doc.updatedAt).format('YYYY-MM-DD HH:mm:ss')}</td>
                                    <td>
                                        <div className="line-actions">
                                            <button className="ghost" onClick={() => void onRenameDoc(doc)}>
                                                更名
                                            </button>
                                            <button className="ghost" onClick={() => void onMoveDoc(doc)}>
                                                移动
                                            </button>
                                            <button className="ghost" style={{ color: '#b45309' }} onClick={() => void onArchiveDoc(doc)}>
                                                移入回收站
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </article>
            ) : (
                <article className="panel">
                    <h3>回收站独立管理</h3>
                    <div
                        style={{
                            marginTop: '0.65rem',
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                            gap: '0.55rem',
                        }}
                    >
                        <div style={{ border: '1px solid var(--line)', borderRadius: '12px', padding: '0.6rem 0.75rem' }}>
                            <small>当前回收站</small>
                            <p>{archivedDocuments.length} 个文档</p>
                        </div>
                        <div style={{ border: '1px solid var(--line)', borderRadius: '12px', padding: '0.6rem 0.75rem' }}>
                            <small>3 天内到期</small>
                            <p>{expiringSoonCount} 个文档</p>
                        </div>
                        <div style={{ border: '1px solid var(--line)', borderRadius: '12px', padding: '0.6rem 0.75rem' }}>
                            <small>自动策略</small>
                            <p>归档 15 天后自动删除</p>
                        </div>
                    </div>

                    <div className="inline-actions" style={{ marginTop: '0.75rem' }}>
                        <input
                            value={binQuery}
                            onChange={(e) => setBinQuery(e.target.value)}
                            placeholder="搜索回收站文档"
                        />
                        <select value={binSortMode} onChange={(e) => setBinSortMode(e.target.value as BinSortMode)}>
                            <option value="remain-asc">按剩余天数升序</option>
                            <option value="remain-desc">按剩余天数降序</option>
                            <option value="archived-desc">按归档时间新到旧</option>
                            <option value="archived-asc">按归档时间旧到新</option>
                        </select>
                        <button className="ghost" onClick={() => void purgeExpiredNow()}>
                            立即清理已到期
                        </button>
                    </div>

                    <div className="inline-actions" style={{ marginTop: '0.6rem' }}>
                        <button className={binDeadlineFilter === 'all' ? '' : 'ghost'} onClick={() => setBinDeadlineFilter('all')}>
                            全部
                        </button>
                        <button className={binDeadlineFilter === 'today' ? '' : 'ghost'} onClick={() => setBinDeadlineFilter('today')}>
                            今天到期
                        </button>
                        <button className={binDeadlineFilter === 'within3' ? '' : 'ghost'} onClick={() => setBinDeadlineFilter('within3')}>
                            3 天内
                        </button>
                        <button className={binDeadlineFilter === 'within7' ? '' : 'ghost'} onClick={() => setBinDeadlineFilter('within7')}>
                            7 天内
                        </button>
                    </div>

                    <div className="inline-actions" style={{ marginTop: '0.6rem' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                            <input
                                type="checkbox"
                                checked={archivedDocuments.length > 0 && selectedBinIds.length === archivedDocuments.length}
                                onChange={(e) => selectAllArchived(e.target.checked)}
                                style={{ width: 'auto' }}
                            />
                            全选当前结果
                        </label>
                        <button className="ghost" disabled={selectedBinIds.length === 0} onClick={() => void batchRestore()}>
                            批量恢复 ({selectedBinIds.length})
                        </button>
                        <button className="ghost" disabled={selectedBinIds.length === 0} onClick={() => void batchPurge()}>
                            批量彻底删除 ({selectedBinIds.length})
                        </button>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>选择</th>
                                <th>标题</th>
                                <th>目录</th>
                                <th>归档时间</th>
                                <th>剩余天数</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {archivedDocuments.map((doc) => (
                                <tr key={doc.id}>
                                    <td>
                                        <input
                                            type="checkbox"
                                            style={{ width: 'auto' }}
                                            checked={selectedBinIds.includes(doc.id)}
                                            onChange={(e) => toggleBinSelection(doc.id, e.target.checked)}
                                        />
                                    </td>
                                    <td>
                                        <strong>{doc.title}</strong>
                                        <div style={{ fontSize: '0.82em', color: 'var(--muted)' }}>{doc.id}</div>
                                    </td>
                                    <td>{doc.folder}</td>
                                    <td>{dayjs(doc.archivedAt ?? doc.updatedAt).format('YYYY-MM-DD HH:mm:ss')}</td>
                                    <td style={{ color: getDaysLeft(doc.archivedAt) <= 3 ? '#b45309' : 'inherit' }}>
                                        {getDaysLeft(doc.archivedAt)} 天
                                    </td>
                                    <td>
                                        <div className="line-actions">
                                            <button className="ghost" onClick={() => void onRestoreDoc(doc)}>
                                                恢复
                                            </button>
                                            <button className="ghost" style={{ color: '#b91c1c' }} onClick={() => void onPurgeDoc(doc)}>
                                                彻底删除
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </article>
            )}

            <article className="panel">
                <h3>运行日志与异常日志</h3>
                <div className="log-box">
                    {logs.map((log) => (
                        <p key={log.id} className={`log-${log.level}`}>
                            [{dayjs(log.time).format('HH:mm:ss')}] {log.source} / {log.level}: {log.message}
                        </p>
                    ))}
                </div>
                {docNotice ? <p className="message" style={{ marginTop: '0.65rem' }}>{docNotice}</p> : null}
            </article>
        </section>
    )
}
