import { useEffect, useState } from 'react'
import { api } from '../../lib/api/client.ts'
import { useAuthStore } from '../../store/authStore'
import { usePreferenceStore } from '../../store/preferenceStore'
import type { UserProfile } from '../../types'

export const UserManagePage = () => {
    const authUser = useAuthStore((state) => state.currentUser)
    const updateAuthUser = useAuthStore((state) => state.updateCurrentUser)
    const preference = usePreferenceStore((state) => state.preference)
    const setPreference = usePreferenceStore((state) => state.setPreference)

    const [users, setUsers] = useState<UserProfile[]>([])
    const [nickname, setNickname] = useState(authUser?.username ?? '')
    const [email, setEmail] = useState(authUser?.email ?? '')
    const [notice, setNotice] = useState('')

    const loadUsers = async () => {
        const list = await api.users.list()
        setUsers(list)
    }

    useEffect(() => {
        void loadUsers()
    }, [])

    const saveProfile = async () => {
        if (!authUser) {
            return
        }
        const updated = await api.users.updateProfile(authUser.id, {
            username: nickname,
            email,
            preferences: preference,
        })
        updateAuthUser(updated)
        setNotice('个人资料已更新')
        await loadUsers()
    }

    return (
        <section className="page-grid">
            <article className="panel">
                <h2>用户生命周期管理</h2>
                <p>完成注册、登录后的个人信息维护和偏好配置提交。</p>
                <div className="form two-col">
                    <label>
                        用户名
                        <input value={nickname} onChange={(e) => setNickname(e.target.value)} />
                    </label>
                    <label>
                        邮箱
                        <input value={email} onChange={(e) => setEmail(e.target.value)} />
                    </label>
                    <label>
                        主题
                        <select value={preference.theme} onChange={(e) => setPreference({ theme: e.target.value as 'dawn' | 'forest' | 'night' })}>
                            <option value="dawn">Dawn</option>
                            <option value="forest">Forest</option>
                            <option value="night">Night</option>
                        </select>
                    </label>
                    <label>
                        字号
                        <input
                            type="number"
                            min={12}
                            max={24}
                            value={preference.editorFontSize}
                            onChange={(e) => setPreference({ editorFontSize: Number(e.target.value) })}
                        />
                    </label>
                    <label>
                        自动保存(秒)
                        <input
                            type="number"
                            min={5}
                            max={120}
                            value={preference.autoSaveIntervalSec}
                            onChange={(e) => setPreference({ autoSaveIntervalSec: Number(e.target.value) })}
                        />
                    </label>
                    <label className="inline">
                        <input
                            type="checkbox"
                            checked={preference.showLineNumbers}
                            onChange={(e) => setPreference({ showLineNumbers: e.target.checked })}
                        />
                        显示行号
                    </label>
                </div>
                <button onClick={() => void saveProfile()}>保存资料与偏好</button>
                {notice ? <p className="message">{notice}</p> : null}
            </article>
            <article className="panel">
                <h3>用户账号清单</h3>
                <table>
                    <thead>
                        <tr>
                            <th>账号</th>
                            <th>角色</th>
                            <th>状态</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((user) => (
                            <tr key={user.id}>
                                <td>{user.username}</td>
                                <td>{user.role}</td>
                                <td>{user.disabled ? '禁用' : '正常'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </article>
        </section>
    )
}
