import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { LoginForm, ProFormText } from '@ant-design/pro-components';
import { Helmet, useModel } from '@umijs/max';
import { App, Card, Space, Tag, Typography } from 'antd';
import { createStyles } from 'antd-style';
import React, { startTransition } from 'react';
import { Footer } from '@/components';
import { login } from '@/services/auth';

/** 校验重定向 URL，防 open redirect */
const getSafeRedirectUrl = (redirect: string | null): string => {
  if (!redirect?.startsWith('/')) return '/';
  if (redirect.startsWith('//')) return '/';
  try {
    const parsed = new URL(redirect, window.location.origin);
    if (parsed.origin !== window.location.origin) return '/';
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return '/';
  }
};

const useStyles = createStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'auto',
    backgroundImage:
      "url('https://mdn.alipayobjects.com/yuyan_qk0oxh/afts/img/V-_oS6r-i7wAAAAAAAAAAAAAFl94AQBr')",
    backgroundSize: '100% 100%',
  },
});

// 测试账号（开发/验收环境，统一密码 Passw0rd!）
const TEST_ACCOUNTS = [
  { account: 'zhangsan@corp.com', name: '张三', role: '普通员工' },
  { account: 'lizhuguan@corp.com', name: '李主管', role: '部门主管' },
  { account: 'zhaofawu@corp.com', name: '赵法务', role: '法务审批' },
  { account: 'qianzongjian@corp.com', name: '钱总监', role: '财务总监' },
  { account: 'admin@corp.com', name: '系统管理员', role: '管理员' },
  { account: 'auditor@corp.com', name: '审计员', role: '合规审计' },
];

const Login: React.FC = () => {
  const { styles } = useStyles();
  const { initialState, setInitialState } = useModel('@@initialState');
  const { message } = App.useApp();

  const fetchUserInfo = async () => {
    const userInfo = await initialState?.fetchUserInfo?.();
    if (userInfo) {
      startTransition(() => {
        setInitialState((s) => ({ ...s, currentUser: userInfo }));
      });
    }
  };

  const redirectAfterLogin = () => {
    const urlParams = new URL(window.location.href).searchParams;
    window.location.href = getSafeRedirectUrl(urlParams.get('redirect'));
  };

  const handleSubmit = async (values: {
    account: string;
    password: string;
  }) => {
    try {
      await login(values);
      message.success('登录成功');
      await fetchUserInfo();
      redirectAfterLogin();
    } catch {
      message.error('登录失败，请检查账号密码');
    }
  };

  const quickLogin = async (account: string) => {
    try {
      await login({ account, password: 'Passw0rd!' });
      message.success(`已登录：${account}`);
      await fetchUserInfo();
      redirectAfterLogin();
    } catch {
      message.error('登录失败');
    }
  };

  return (
    <div className={styles.container}>
      <Helmet>
        <title>登录 - 合同用印与审批平台</title>
      </Helmet>
      <div style={{ flex: '1', padding: '32px 0' }}>
        <LoginForm
          contentStyle={{ minWidth: 320, maxWidth: '78vw' }}
          logo={<img alt="logo" src="/logo.svg" />}
          title="合同用印与审批平台"
          subTitle="企业级合同用印与审批"
          onFinish={handleSubmit}
        >
          <ProFormText
            name="account"
            fieldProps={{ size: 'large', prefix: <UserOutlined /> }}
            placeholder="账号（邮箱或工号）"
            rules={[{ required: true, message: '请输入账号' }]}
          />
          <ProFormText.Password
            name="password"
            fieldProps={{ size: 'large', prefix: <LockOutlined /> }}
            placeholder="密码"
            rules={[{ required: true, message: '请输入密码' }]}
          />
          <Card
            size="small"
            title="测试账号（点击一键登录）"
            style={{ marginTop: 8 }}
          >
            <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
              统一密码 Passw0rd!，点击任意账号即可登录验证不同角色。
            </Typography.Paragraph>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              {TEST_ACCOUNTS.map((a) => (
                <button
                  key={a.account}
                  type="button"
                  onClick={() => quickLogin(a.account)}
                  style={{
                    cursor: 'pointer',
                    padding: '6px 10px',
                    borderRadius: 6,
                    background: 'rgba(0,0,0,0.02)',
                    border: 'none',
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>
                    {a.name} <span style={{ color: '#999' }}>{a.role}</span>
                  </span>
                  <Tag color="blue">{a.account}</Tag>
                </button>
              ))}
            </Space>
          </Card>
        </LoginForm>
      </div>
      <Footer />
    </div>
  );
};

export default Login;
