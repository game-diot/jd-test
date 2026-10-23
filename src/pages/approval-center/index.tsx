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
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Timeline,
} from 'antd';
import { useState } from 'react';
import { getAdminContracts, terminateContract } from '@/services/admin';
import {
  addSignTask,
  approveTask,
  getApprovalDetail,
  getPendingApprovals,
  getProcessedApprovals,
  rejectTask,
  transferTask,
  withdrawContract,
} from '@/services/approvals';
import type { UserProfile } from '@/services/auth';
import { getContract, getMyContracts } from '@/services/contracts';
import { getFileDownloadUrl } from '@/services/files';
import type { ApproverOption } from '@/services/users';
import { listApprovers, listSigners } from '@/services/users';

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

const TYPE_MAP: Record<string, string> = {
  PURCHASE: '采购合同',
  SALES: '销售合同',
  SERVICE: '服务合同',
  NDA: '保密协议',
};

const SEAL_MAP: Record<string, string> = {
  OFFICIAL_SEAL: '公章',
  CONTRACT_SEAL: '合同章',
  LEGAL_REP_SEAL: '法人章',
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

  // 转交
  const [transferVisible, setTransferVisible] = useState(false);
  const [transferTaskId, setTransferTaskId] = useState('');
  const [transferToUser, setTransferToUser] = useState<string>();
  const [transferReason, setTransferReason] = useState('');
  const [approvers, setApprovers] = useState<ApproverOption[]>([]);

  // 加签
  const [signVisible, setSignVisible] = useState(false);
  const [signTaskId, setSignTaskId] = useState('');
  const [signerId, setSignerId] = useState<string>();
  const [signers, setSigners] = useState<ApproverOption[]>([]);

  const reload = () => setRefreshKey((k) => k + 1);

  const openDetail = async (taskId: string) => {
    const res = await getApprovalDetail(taskId);
    setDetailTask(res.data);
  };

  const [contractDetail, setContractDetail] = useState<Record<
    string,
    any
  > | null>(null);
  const openContractDetail = async (contractId: string) => {
    const res = await getContract(contractId);
    setContractDetail(res.data);
  };

  const doApprove = async (taskId: string) => {
    await approveTask(taskId);
    message.success('已同意');
    setDetailTask(null);
    reload();
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
    reload();
  };

  const doWithdraw = async (contractId: string) => {
    await withdrawContract(contractId);
    message.success('已撤回');
    reload();
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
        reload();
      },
    });
  };

  const openTransfer = async (taskId: string) => {
    const res = await listApprovers();
    setApprovers(res.data ?? []);
    setTransferTaskId(taskId);
    setTransferToUser(undefined);
    setTransferReason('');
    setTransferVisible(true);
  };

  const doTransfer = async () => {
    if (!transferToUser) {
      message.error('请选择接收人');
      return;
    }
    if (!transferReason.trim()) {
      message.error('请填写转交原因');
      return;
    }
    await transferTask(transferTaskId, transferToUser, transferReason.trim());
    message.success('已转交');
    setTransferVisible(false);
    setDetailTask(null);
    reload();
  };

  const openSign = async (taskId: string) => {
    const res = await listSigners();
    setSigners(res.data ?? []);
    setSignTaskId(taskId);
    setSignerId(undefined);
    setSignVisible(true);
  };

  const doSign = async () => {
    if (!signerId) {
      message.error('请选择加签人');
      return;
    }
    await addSignTask(signTaskId, signerId);
    message.success('已发起加签');
    setSignVisible(false);
    setDetailTask(null);
    reload();
  };

  const downloadFile = async (fileId: string) => {
    const res = await getFileDownloadUrl(fileId);
    window.open(res.data.url, '_blank');
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
              render: (_, r) =>
                r.status === 'PENDING'
                  ? [
                      <Button
                        key="d"
                        type="link"
                        onClick={() => openDetail(r.id)}
                      >
                        查看
                      </Button>,
                      <Button
                        key="a"
                        type="link"
                        onClick={() => doApprove(r.id)}
                      >
                        同意
                      </Button>,
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
                      <Button
                        key="t"
                        type="link"
                        onClick={() => openTransfer(r.id)}
                      >
                        转交
                      </Button>,
                      <Button
                        key="s"
                        type="link"
                        onClick={() => openSign(r.id)}
                      >
                        加签
                      </Button>,
                    ]
                  : [
                      <Button
                        key="d"
                        type="link"
                        onClick={() => openDetail(r.id)}
                      >
                        查看
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
            {
              title: '操作',
              valueType: 'option',
              render: (_, r) => [
                <Button key="d" type="link" onClick={() => openDetail(r.id)}>
                  查看
                </Button>,
              ],
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
              <Button
                key="d"
                type="link"
                onClick={() => openContractDetail(r.id)}
              >
                查看
              </Button>,
              r.status === 'PENDING_APPROVAL' && (
                <Button key="w" type="link" onClick={() => doWithdraw(r.id)}>
                  撤回
                </Button>
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
                <Button
                  key="d"
                  type="link"
                  onClick={() => openContractDetail(r.id)}
                >
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

  const contract = detailTask?.node?.instance?.contract;
  const itemsList = contract?.items ?? [];
  const nodes = detailTask?.node?.instance?.nodes ?? [];
  const actions = detailTask?.actions ?? [];

  return (
    <PageContainer title="审批中心">
      <Tabs items={items} />
      <Drawer
        title="申请详情"
        width={820}
        open={!!detailTask}
        onClose={() => setDetailTask(null)}
      >
        {detailTask && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="申请编号">
                {contract?.application_no}
              </Descriptions.Item>
              <Descriptions.Item label="申请人">
                {contract?.applicant_name_snapshot}
              </Descriptions.Item>
              <Descriptions.Item label="申请原因" span={2}>
                {contract?.reason}
              </Descriptions.Item>
              <Descriptions.Item label="合同金额">
                ¥{' '}
                {Number(detailTask.node.instance.total_amount_snapshot).toFixed(
                  2,
                )}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {contract?.status}
              </Descriptions.Item>
            </Descriptions>

            <div>
              <strong>合同明细</strong>
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                style={{ marginTop: 8 }}
                dataSource={itemsList}
                columns={[
                  { title: '合同名称', dataIndex: 'contract_name' },
                  {
                    title: '类型',
                    dataIndex: 'contract_type',
                    render: (v) => TYPE_MAP[v] ?? v,
                  },
                  {
                    title: '金额',
                    dataIndex: 'amount',
                    render: (_, r: any) => `¥ ${Number(r.amount).toFixed(2)}`,
                  },
                  { title: '相对方', dataIndex: 'counterparty' },
                  {
                    title: '用印类型',
                    dataIndex: 'seal_type',
                    render: (v) => SEAL_MAP[v] ?? v,
                  },
                  {
                    title: '附件',
                    dataIndex: ['file', 'id'],
                    render: (_v, r: any) =>
                      r.file ? (
                        <Button
                          type="link"
                          size="small"
                          onClick={() => downloadFile(r.file.id)}
                        >
                          {r.file.original_name || '下载'}
                        </Button>
                      ) : (
                        '-'
                      ),
                  },
                ]}
              />
            </div>

            <div>
              <strong>审批链进度</strong>
              <div style={{ marginTop: 8 }}>
                {nodes.map((n: any) => (
                  <div key={n.id} style={{ marginBottom: 4 }}>
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
            </div>

            {actions.length > 0 && (
              <div>
                <strong>审批历史</strong>
                <Timeline
                  style={{ marginTop: 8 }}
                  items={actions.map((a: any) => ({
                    color:
                      a.action_type === 'REJECT' ||
                      a.action_type === 'SIGN_REJECT'
                        ? 'red'
                        : a.action_type === 'APPROVE'
                          ? 'green'
                          : 'blue',
                    children: (
                      <>
                        <div>
                          {a.action_type} · {a.actor_id}
                        </div>
                        {a.comment && (
                          <div style={{ color: '#999' }}>{a.comment}</div>
                        )}
                        <div style={{ color: '#bbb', fontSize: 12 }}>
                          {a.created_at}
                        </div>
                      </>
                    ),
                  }))}
                />
              </div>
            )}

            {detailTask.status === 'PENDING' &&
              detailTask.assignee_id === user?.id && (
                <Space>
                  <Button
                    type="primary"
                    onClick={() => doApprove(detailTask.id)}
                  >
                    同意
                  </Button>
                  <Button
                    danger
                    onClick={() => {
                      setRejectTaskId(detailTask.id);
                      setRejectVisible(true);
                    }}
                  >
                    驳回
                  </Button>
                  <Button onClick={() => openTransfer(detailTask.id)}>
                    转交
                  </Button>
                  <Button onClick={() => openSign(detailTask.id)}>加签</Button>
                </Space>
              )}
          </Space>
        )}
      </Drawer>

      <Drawer
        title="合同详情"
        width={820}
        open={!!contractDetail}
        onClose={() => setContractDetail(null)}
      >
        {contractDetail && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="申请编号">
                {contractDetail.application_no}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={STATUS_MAP[contractDetail.status]?.color}>
                  {STATUS_MAP[contractDetail.status]?.text ??
                    contractDetail.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="申请人">
                {contractDetail.applicant_name_snapshot}
              </Descriptions.Item>
              <Descriptions.Item label="申请原因" span={2}>
                {contractDetail.reason}
              </Descriptions.Item>
              <Descriptions.Item label="金额">
                ¥ {Number(contractDetail.total_amount).toFixed(2)}
              </Descriptions.Item>
              <Descriptions.Item label="提交时间">
                {contractDetail.submitted_at || '-'}
              </Descriptions.Item>
            </Descriptions>
            <div>
              <strong>合同明细</strong>
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                style={{ marginTop: 8 }}
                dataSource={contractDetail.items ?? []}
                columns={[
                  { title: '合同名称', dataIndex: 'contract_name' },
                  {
                    title: '类型',
                    dataIndex: 'contract_type',
                    render: (v) => TYPE_MAP[v] ?? v,
                  },
                  {
                    title: '金额',
                    dataIndex: 'amount',
                    render: (v) => `¥ ${Number(v).toFixed(2)}`,
                  },
                  { title: '相对方', dataIndex: 'counterparty' },
                  {
                    title: '用印类型',
                    dataIndex: 'seal_type',
                    render: (v) => SEAL_MAP[v] ?? v,
                  },
                  {
                    title: '附件',
                    dataIndex: ['file', 'id'],
                    render: (_v, r: any) =>
                      r.file ? (
                        <Button
                          type="link"
                          size="small"
                          onClick={() => downloadFile(r.file.id)}
                        >
                          {r.file.original_name || '下载'}
                        </Button>
                      ) : (
                        '-'
                      ),
                  },
                ]}
              />
            </div>
            {contractDetail.approval_instance?.nodes?.length > 0 && (
              <div>
                <strong>审批链进度</strong>
                <div style={{ marginTop: 8 }}>
                  {contractDetail.approval_instance.nodes.map((n: any) => (
                    <div key={n.id} style={{ marginBottom: 4 }}>
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
              </div>
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

      <Modal
        title="转交审批任务"
        open={transferVisible}
        onCancel={() => setTransferVisible(false)}
        onOk={doTransfer}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Select
            style={{ width: '100%' }}
            placeholder="选择接收人（同部门 + 审批权限）"
            value={transferToUser}
            onChange={setTransferToUser}
            options={approvers.map((a) => ({
              value: a.id,
              label: `${a.name}（${a.employee_no}）`,
            }))}
          />
          <Input.TextArea
            rows={3}
            placeholder="转交原因（必填）"
            value={transferReason}
            onChange={(e) => setTransferReason(e.target.value)}
          />
        </Space>
      </Modal>

      <Modal
        title="加签审批人"
        open={signVisible}
        onCancel={() => setSignVisible(false)}
        onOk={doSign}
      >
        <Select
          style={{ width: '100%' }}
          placeholder="选择加签人（同级或上级）"
          value={signerId}
          onChange={setSignerId}
          options={signers.map((a) => ({
            value: a.id,
            label: `${a.name}（${a.employee_no}）`,
          }))}
        />
      </Modal>
    </PageContainer>
  );
};

export default ApprovalCenter;
