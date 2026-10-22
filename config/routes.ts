/**
 * 企业级合同用印与审批平台 · 路由配置
 * 阶段 2：登录 + 5 业务路由 + exception。
 */
export default [
  {
    path: '/user',
    layout: false,
    routes: [
      {
        path: '/user/login',
        name: 'login',
        component: './user/login',
      },
      {
        path: '/user',
        redirect: '/user/login',
      },
      {
        name: '404',
        component: './exception/404',
        path: '/user/*',
      },
    ],
  },
  {
    path: '/contracts/new',
    name: 'contract-application',
    icon: 'form',
    component: './contract-application',
  },
  {
    path: '/approvals',
    name: 'approval-center',
    icon: 'audit',
    component: './approval-center',
  },
  {
    path: '/ledger',
    name: 'ledger',
    icon: 'table',
    component: './ledger',
  },
  {
    path: '/exports',
    name: 'export-tasks',
    icon: 'download',
    component: './export-tasks',
  },
  {
    path: '/admin',
    name: 'admin',
    icon: 'crown',
    access: 'canAdmin',
    component: './admin',
  },
  {
    name: 'exception',
    icon: 'warning',
    path: '/exception',
    routes: [
      {
        path: '/exception',
        redirect: '/exception/403',
      },
      {
        name: '403',
        component: './exception/403',
        path: '/exception/403',
      },
      {
        name: '404',
        component: './exception/404',
        path: '/exception/404',
      },
      {
        name: '500',
        component: './exception/500',
        path: '/exception/500',
      },
    ],
  },
  {
    path: '/',
    redirect: '/contracts/new',
  },
  {
    component: './exception/404',
    path: '/*',
  },
];
