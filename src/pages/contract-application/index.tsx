import { PageContainer } from '@ant-design/pro-components';
import { useEffect, useState } from 'react';

const ContractApplication: React.FC = () => {
  const [health, setHealth] = useState<string>('检测中…');

  useEffect(() => {
    fetch('/api/v1/health')
      .then((r) => r.json())
      .then(
        (d: { code?: string; message?: string; data?: { status?: string } }) =>
          setHealth(
            `后端已连接 · ${d.message || ''} · ${d.data?.status || ''}`,
          ),
      )
      .catch(() => setHealth('后端未连接'));
  }, []);

  return (
    <PageContainer title="合同用印申请">
      <div>合同用印申请（阶段 5 实现）</div>
      <div style={{ marginTop: 16, color: '#888' }}>{health}</div>
    </PageContainer>
  );
};

export default ContractApplication;
