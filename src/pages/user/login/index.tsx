import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { LoginForm, ProFormText } from '@ant-design/pro-components';
import { Helmet, useModel } from '@umijs/max';
import { App } from 'antd';
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

  const handleSubmit = async (values: {
    account: string;
    password: string;
  }) => {
    try {
      await login(values);
      message.success('登录成功');
      await fetchUserInfo();
      const urlParams = new URL(window.location.href).searchParams;
      window.location.href = getSafeRedirectUrl(urlParams.get('redirect'));
    } catch {
      message.error('登录失败，请检查账号密码');
    }
  };

  return (
    <div className={styles.container}>
      <Helmet>
        <title>登录 - 合同用印与审批平台</title>
      </Helmet>
      <div style={{ flex: '1', padding: '32px 0' }}>
        <LoginForm
          contentStyle={{ minWidth: 280, maxWidth: '75vw' }}
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
        </LoginForm>
      </div>
      <Footer />
    </div>
  );
};

export default Login;
