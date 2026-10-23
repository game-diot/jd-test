import type { ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { Button, Tag } from 'antd';
import { getExportDownloadUrl, listExports } from '@/services/exports';

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  QUEUED: { text: '排队中', color: 'default' },
  RUNNING: { text: '执行中', color: 'processing' },
  SUCCEEDED: { text: '成功', color: 'success' },
  FAILED: { text: '失败', color: 'error' },
};

const ExportTasks: React.FC = () => {
  const download = async (id: string): Promise<void> => {
    const res = await getExportDownloadUrl(id);
    window.open(res.data.url, '_blank');
  };

  const columns: ProColumns<any>[] = [
    { title: '任务ID', dataIndex: 'id', ellipsis: true, search: false },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      search: false,
      render: (_, r) => (
        <Tag color={STATUS_MAP[r.status]?.color}>
          {STATUS_MAP[r.status]?.text ?? r.status}
        </Tag>
      ),
    },
    { title: '导出条数', dataIndex: 'row_count', width: 100, search: false },
    {
      title: '耗时(ms)',
      dataIndex: 'duration_ms',
      width: 100,
      search: false,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      valueType: 'dateTime',
      width: 160,
      search: false,
    },
    {
      title: '操作',
      valueType: 'option',
      search: false,
      render: (_, r) =>
        r.status === 'SUCCEEDED' ? (
          <Button type="link" onClick={() => download(r.id)}>
            下载
          </Button>
        ) : (
          '-'
        ),
    },
  ];

  return (
    <PageContainer title="导出任务">
      <ProTable
        rowKey="id"
        columns={columns}
        request={async (params) => {
          const res = await listExports();
          return { data: res.data ?? [], success: true };
        }}
        search={false}
        pagination={{ pageSize: 10 }}
        scroll={{ x: 800 }}
      />
    </PageContainer>
  );
};

export default ExportTasks;
