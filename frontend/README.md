# 在线协同编辑器前端框架（多人协同）

基于 React + TypeScript + Vite 的模块化前端工程，聚焦多人协同编辑核心场景，已覆盖：
- 用户管理
- 文档基础操作
- 实时协同
- 版本控制
- 权限管理（RBAC）
- 数据安全与备份
- 系统管理（管理员端）

## 1. 快速启动

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
```

## 2. 技术选型

- 构建：Vite
- UI：React 19 + 自定义主题化样式（响应式）
- 路由：react-router-dom
- 状态管理：zustand
- 服务端状态：@tanstack/react-query
- 表单与校验：react-hook-form + zod
- 富文本编辑：@tiptap/react
- 实时通信：socket.io-client（含前端降级 mock pulse）

## 3. 目录说明

```text
src/
  app/
    layout/            # 主布局（侧边栏+顶栏）
    providers/         # QueryClient 等全局 Provider
    router.tsx         # 路由与权限守卫
  components/
    editor/            # 富文本编辑器组件
    ProtectedRoute.tsx # 登录态守卫
  features/
    auth/              # 登录注册、个人资料与偏好
    documents/         # 文档 CRUD + 自动/手动保存
    collaboration/     # 在线成员、事件通知、评论批注
    versions/          # 快照、差分、恢复
    permissions/       # RBAC 绑定分配/回收
    security/          # 备份、恢复、导出
    admin/             # 管理员用户/角色/日志/系统参数
  lib/
    api/client.ts      # 统一 API（当前为前端 mock）
    ws/collabSocket.ts # WebSocket 封装
  store/               # auth / preference / document 状态
  hooks/               # 自动保存等可复用逻辑
  types/               # 领域模型类型定义
```

## 4. 七大模块前端实现导向

### 4.1 用户管理模块
- 登录/注册双模式表单、字段校验、账号密码规则校验。
- 登录后写入会话与用户偏好；支持个人资料和偏好配置提交。
- 用户列表展示账号生命周期状态（正常/禁用）。

### 4.2 文档基础操作模块
- 文档创建入口与文档列表。
- 富文本编辑器（格式化、标题、列表）。
- 自动保存（可配置间隔）+ 手动保存。
- 文档更名、移动、删除操作。

### 4.3 实时协同模块
- WebSocket 客户端封装与事件订阅。
- 在线成员/光标状态展示。
- 评论批注：新增、查看、回复、删除。
- 协同通知流（事件消息展示）。

### 4.4 版本控制模块
- 版本列表与快照创建。
- 差分对比视图（行级标记变化）。
- 历史版本恢复并同步文档状态。

### 4.5 权限管理模块
- RBAC 角色枚举与权限绑定模型。
- 面向用户/文档/文件夹的权限分配与回收。
- 动态编辑绑定项并实时刷新。

### 4.6 数据安全与备份模块
- 前端展示加密传输适配状态。
- 定时备份状态展示与手动备份触发。
- 异常恢复入口。
- 多格式导出（DOCX/PDF/MD）调用与反馈。

### 4.7 系统管理模块（管理员）
- 管理员参数配置入口。
- 用户禁用/启用与角色调整。
- 运行日志、异常日志可视化展示。

## 5. 联调说明

当前 `src/lib/api/client.ts` 采用前端 localStorage mock，接口签名已按真实业务行为组织。

对接后端时建议：
- 保持方法签名不变，仅替换实现为 HTTP 请求。
- 为每个模块补充请求拦截器、错误码映射、重试策略。
- WebSocket 连接地址与鉴权 token 由配置中心注入。

## 6. 下一步建议

- 按模块增加 E2E 用例（登录、文档保存、版本恢复、权限切换）。
- 将编辑器协同协议升级为 OT/CRDT（如 Yjs）并接入后端广播。
- 对大体积页面做动态拆包，优化首屏性能。
