import { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { api } from '../../lib/api/client.ts'
import { useDocStore } from '../../store/docStore'
import { useAuthStore } from '../../store/authStore'
import type { VersionSnapshot } from '../../types'

const simpleDiff = (from: string, to: string) => {
    const oldLines = from.replace(/<[^>]+>/g, '').split('\n')
    const newLines = to.replace(/<[^>]+>/g, '').split('\n')
    return newLines.map((line, idx) => ({
        line: idx + 1,
        text: line,
        changed: line !== (oldLines[idx] ?? ''),
    }))
}

export const VersionPage = () => {
    const doc = useDocStore((state) => state.currentDoc)
    const setDoc = useDocStore((state) => state.setCurrentDoc)
    const user = useAuthStore((state) => state.currentUser)
    const [versions, setVersions] = useState<VersionSnapshot[]>([])
    const [summary, setSummary] = useState('常规编辑快照')
    const [selected, setSelected] = useState<VersionSnapshot | null>(null)

    const documentId = doc?.id ?? 'doc-1'

    const loadVersions = async () => {
        const list = await api.versions.list(documentId)
        setVersions(list)
        setSelected(list[0] ?? null)
    }

    useEffect(() => {
        void loadVersions()
    }, [documentId])

    const diffRows = useMemo(() => {
        if (!doc || !selected) {
            return []
        }
        return simpleDiff(selected.content, doc.content)
    }, [doc, selected])

    return (
        <section className="page-grid two-col-layout">
            <article className="panel">
                <h2>版本控制与快照</h2>
                <div className="inline-actions">
                    <input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="输入快照说明" />
                    <button
                        onClick={async () => {
                            await api.versions.createSnapshot(
                                documentId,
                                user?.username ?? 'guest',
                                doc?.content ?? '<p>空文档</p>',
                                summary,
                            )
                            await loadVersions()
                        }}
                    >
                        创建版本
                    </button>
                </div>
                <ul className="version-list">
                    {versions.map((version) => (
                        <li key={version.id} className={selected?.id === version.id ? 'active' : ''}>
                            <button onClick={() => setSelected(version)}>{version.summary}</button>
                            <small>{dayjs(version.createdAt).format('MM-DD HH:mm:ss')}</small>
                            <button
                                onClick={async () => {
                                    if (!doc) {
                                        return
                                    }
                                    const updated = await api.documents.save(doc.id, version.content)
                                    setDoc(updated)
                                }}
                            >
                                恢复
                            </button>
                        </li>
                    ))}
                </ul>
            </article>
            <article className="panel">
                <h3>差分对比</h3>
                <div className="diff-box">
                    {diffRows.map((row) => (
                        <p key={row.line} className={row.changed ? 'changed' : ''}>
                            {row.line}. {row.text || ' '}
                        </p>
                    ))}
                </div>
            </article>
        </section>
    )
}
