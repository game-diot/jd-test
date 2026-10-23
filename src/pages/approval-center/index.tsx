import type { ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { useModel } from '@umijs/max';
import {
  Button,
  Descriptions,
  Drawer,
  Input,
  Modal,
  message,
  Popconfirm,
  Space,
  Tabs,
  Tag,
} from 'antd';
import { useState } from 'react';
import { getAdminContracts, terminateContract } from '@/services/admin';
import {
  approveTask,
  getApprovalDetail,
  getPendingApprovals,
  getProcessedApprovals,
  rejectTask,
  withdrawContract,
} from '@/services/approvals';
import type { UserProfile } from '@/services/auth';
import { getMyContracts } from '@/services/contracts';

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  PENDING_APPROVAL: { text: '待审批', color: 'processing' },
  APPROVED: { text: '已通过', color: 'success' },
  REJECTED: { text: '已驳回', color: 'error' },
  WITHDRAWN: { text: '已撤回', color: 'default' },
  TERMINATED: { text: '已终止', color: 'error' },
  DRAFT: { text: '草稿', color: 'default' },
};

const TASK_STATUS_MAP: Record<string, { text: string; color: string }> = {
  PENDING: { text: '待处理', color: 'processing' },
  APPROVED: { text: '已同意', color: 'success' },
  REJECTED: { text: '已驳回', color: 'error' },
  TRANSFERRED: { text: '已转交', color: 'warning' },
  WAITING_SIGN: { text: '等待加签', color: 'warning' },
  CANCELLED: { text: '已取消', color: 'default' },
};

const ApprovalCenter: React.FC = () => {
  const { initialState } = useModel('@@initialState');
  const user = initialState?.currentUser as UserProfile | undefined;
  const roles = user?.roles ?? [];
  const isApprover = roles.includes('approver');
  const isAdmin = roles.includes('admin');

  const [detailTask, setDetailTask] = useState<Record<string, any> | null>(
    null,
  );
  const [rejectVisible, setRejectVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectTaskId, setRejectTaskId] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const openDetail = async (taskId: string) => {
    const res = await getApprovalDetail(taskId);
    setDetailTask(res.data);
  };

  const doApprove = async (taskId: string) => {
    await approveTask(taskId);
    message.success('已同意');
    setDetailTask(null);
    setRefreshKey((k) => k + 1);
  };

  const doReject = async () => {
    if (rejectReason.trim().length < 10) {
      message.error('驳回原因不少于 10 个字');
      return;
    }
    await rejectTask(rejectTaskId, rejectReason.trim());
    message.success('已驳回');
    setRejectVisible(false);
    setRejectReason('');
    setDetailTask(null);
    setRefreshKey((k) => k + 1);
  };

  const doWithdraw = async (contractId: string) => {
    await withdrawContract(contractId);
    message.success('已撤回');
    setRefreshKey((k) => k + 1);
  };

  const doTerminate = (id: string) => {
    let reason = '';
    Modal.confirm({
      title: '强制终止',
      content: (
        <Input.TextArea
          placeholder="终止原因（必填）"
          rows={3}
          onChange={(e) => (reason = e.target.value)}
        />
      ),
      onOk: async () => {
        if (!reason.trim()) {
          message.error('请填写终止原因');
          return;
        }
        await terminateContract(id, reason.trim());
        message.success('已终止');
        setRefreshKey((k) => k + 1);
      },
    });
  };

  const contractColumns: ProColumns<any>[] = [
    { title: '申请编号', dataIndex: 'application_no' },
    { title: '申请原因', dataIndex: 'reason', ellipsis: true },
    {
      title: '金额',
      dataIndex: 'total_amount',
      render: (_, r) => `¥ ${Number(r.total_amount).toFixed(2)}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (_, r) => (
        <Tag color={STATUS_MAP[r.status]?.color}>
          {STATUS_MAP[r.status]?.text ?? r.status}
        </Tag>
      ),
    },
    { title: '提交时间', dataIndex: 'submitted_at', valueType: 'dateTime' },
  ];

  const taskBaseColumns: ProColumns<any>[] = [
    {
      title: '申请编号',
      dataIndex: ['node', 'instance', 'contract', 'application_no'],
    },
    {
      title: '申请原因',
      dataIndex: ['node', 'instance', 'contract', 'reason'],
      ellipsis: true,
    },
    {
      title: '金额',
      dataIndex: ['node', 'instance', 'total_amount_snapshot'],
      render: (_, r) =>
        `¥ ${Number(r.node.instance.total_amount_snapshot).toFixed(2)}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (_, r) => (
        <Tag color={TASK_STATUS_MAP[r.status]?.color}>
          {TASK_STATUS_MAP[r.status]?.text ?? r.status}
        </Tag>
      ),
    },
  ];

  const items = [];
  if (isApprover) {
    items.push({
      key: 'pending',
      label: '待我审批',
      children: (
        <ProTable
          rowKey="id"
          key={`pending-${refreshKey}`}
          columns={[
            ...taskBaseColumns,
            {
              title: '操作',
              valueType: 'option',
              render: (_, r) => [
                <Button key="d" type="link" onClick={() => openDetail(r.id)}>
                  查看
                </Button>,
                <Popconfirm
                  key="a"
                  title="确认同意该申请？"
                  onConfirm={() => doApprove(r.id)}
                >
                  <Button type="link">同意</Button>
                </Popconfirm>,
                <Button
                  key="r"
                  type="link"
                  danger
                  onClick={() => {
                    setRejectTaskId(r.id);
                    setRejectVisible(true);
                  }}
                >
                  驳回
                </Button>,
              ],
            },
          ]}
          request={getPendingApprovals}
          search={false}
          pagination={{ pageSize: 10 }}
        />
      ),
    });
    items.push({
      key: 'processed',
      label: '我已审批',
      children: (
        <ProTable
          rowKey="id"
          key={`processed-${refreshKey}`}
          columns={[
            ...taskBaseColumns,
            {
              title: '处理时间',
              dataIndex: 'completed_at',
              valueType: 'dateTime',
            },
          ]}
          request={getProcessedApprovals}
          search={false}
          pagination={{ pageSize: 10 }}
        />
      ),
    });
  }
  items.push({
    key: 'mine',
    label: '我提交的',
    children: (
      <ProTable
        rowKey="id"
        key={`mine-${refreshKey}`}
        columns={[
          ...contractColumns,
          {
            title: '操作',
            valueType: 'option',
            render: (_, r) => [
              <Button key="d" type="link" onClick={() => openDetail(r.id)}>
                查看
              </Button>,
              r.status === 'PENDING_APPROVAL' && (
                <Popconfirm
                  key="w"
                  title="确认撤回该申请？"
                  onConfirm={() => doWithdraw(r.id)}
                >
                  <Button type="link">撤回</Button>
                </Popconfirm>
              ),
            ],
          },
        ]}
        request={getMyContracts}
        search={false}
        pagination={{ pageSize: 10 }}
      />
    ),
  });
  if (isAdmin) {
    items.push({
      key: 'all',
      label: '全量申请单',
      children: (
        <ProTable
          rowKey="id"
          key={`all-${refreshKey}`}
          columns={[
            ...contractColumns,
            {
              title: '操作',
              valueType: 'option',
              render: (_, r) => [
                <Button key="d" type="link" onClick={() => openDetail(r.id)}>
                  查看
                </Button>,
                r.status === 'PENDING_APPROVAL' && (
                  <Button
                    key="t"
                    type="link"
                    danger
                    onClick={() => doTerminate(r.id)}
                  >
                    强制终止
                  </Button>
                ),
              ],
            },
          ]}
          request={getAdminContracts}
          search={false}
          pagination={{ pageSize: 10 }}
        />
      ),
    });
  }

  return (
    <PageContainer title="审批中心">
      <Tabs items={items} />
      <Drawer
        title="申请详情"
        width={760}
        open={!!detailTask}
        onClose={() => setDetailTask(null)}
      >
        {detailTask && (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="申请编号">
                {detailTask.node?.instance?.contract?.application_no}
              </Descriptions.Item>
              <Descriptions.Item label="申请人">
                {detailTask.node?.instance?.contract?.applicant_name_snapshot}
              </Descriptions.Item>
              <Descriptions.Item label="申请原因" span={2}>
                {detailTask.node?.instance?.contract?.reason}
              </Descriptions.Item>
              <Descriptions.Item label="合同金额">
                ¥{' '}
                {Number(
                  detailTask.node?.instance?.total_amount_snapshot,
                ).toFixed(2)}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {detailTask.node?.instance?.contract?.status}
              </Descriptions.Item>
            </Descriptions>
            <div>
              <strong>审批链进度</strong>
              {(detailTask.node?.instance?.nodes ?? []).map((n: any) => (
                <div key={n.id} style={{ marginTop: 8 }}>
                  <Tag color="blue">{n.node_type}</Tag>
                  <span>{n.approver_name_snapshot}</span>
                  <Tag
                    color={TASK_STATUS_MAP[n.status]?.color}
                    style={{ marginLeft: 8 }}
                  >
                    {TASK_STATUS_MAP[n.status]?.text ?? n.status}
                  </Tag>
                </div>
              ))}
            </div>
            {detailTask.status === 'PENDING' &&
              detailTask.assignee_id === user?.id && (
                <Space>
                  <Popconfirm
                    title="确认同意？"
                    onConfirm={() => doApprove(detailTask.id)}
                  >
                    <Button type="primary">同意</Button>
                  </Popconfirm>
                  <Button
                    danger
                    onClick={() => {
                      setRejectTaskId(detailTask.id);
                      setRejectVisible(true);
                    }}
                  >
                    驳回
                  </Button>
                </Space>
              )}
          </Space>
        )}
      </Drawer>
      <Modal
        title="驳回原因"
        open={rejectVisible}
        onCancel={() => setRejectVisible(false)}
        onOk={doReject}
      >
        <Input.TextArea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="请填写驳回原因（不少于 10 个字）"
          rows={4}
        />
      </Modal>
    </PageContainer>
  );
};

export default ApprovalCenter;
