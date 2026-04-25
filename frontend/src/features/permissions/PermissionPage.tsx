import { useEffect, useState } from 'react'
import { api } from '../../lib/api/client.ts'
import type { PermissionBinding, UserRole } from '../../types'

const roles: UserRole[] = ['owner', 'editor', 'reviewer', 'viewer', 'admin']

export const PermissionPage = () => {
    const [list, setList] = useState<PermissionBinding[]>([])
    const [draft, setDraft] = useState<PermissionBinding>({
        id: '',
        targetType: 'document',
        targetId: 'doc-1',
        principal: '',
        role: 'viewer',
    })

    const load = async () => {
        setList(await api.permissions.list())
    }

    useEffect(() => {
        void load()
    }, [])

    return (
        <section className="page-grid">
            <article className="panel">
                <h2>RBAC 权限管理</h2>
                <div className="form two-col">
                    <label>
                        主体(用户/组)
                        <input value={draft.principal} onChange={(e) => setDraft({ ...draft, principal: e.target.value })} />
                    </label>
                    <label>
                        目标类型
                        <select value={draft.targetType} onChange={(e) => setDraft({ ...draft, targetType: e.target.value as PermissionBinding['targetType'] })}>
                            <option value="user">user</option>
                            <option value="document">document</option>
                            <option value="folder">folder</option>
                        </select>
                    </label>
                    <label>
                        目标 ID
                        <input value={draft.targetId} onChange={(e) => setDraft({ ...draft, targetId: e.target.value })} />
                    </label>
                    <label>
                        角色
                        <select value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as UserRole })}>
                            {roles.map((role) => (
                                <option key={role} value={role}>
                                    {role}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
                <button
                    onClick={async () => {
                        await api.permissions.upsert({
                            ...draft,
                            id: draft.id || `perm-${Date.now()}`,
                        })
                        setDraft({ ...draft, principal: '', id: '' })
                        await load()
                    }}
                >
                    分配/更新权限
                </button>
            </article>
            <article className="panel">
                <h3>权限绑定列表</h3>
                <table>
                    <thead>
                        <tr>
                            <th>主体</th>
                            <th>目标</th>
                            <th>角色</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {list.map((item) => (
                            <tr key={item.id}>
                                <td>{item.principal}</td>
                                <td>
                                    {item.targetType}:{item.targetId}
                                </td>
                                <td>{item.role}</td>
                                <td>
                                    <button onClick={() => setDraft(item)}>编辑</button>
                                    <button
                                        onClick={async () => {
                                            await api.permissions.revoke(item.id)
                                            await load()
                                        }}
                                    >
                                        回收
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </article>
        </section>
    )
}
