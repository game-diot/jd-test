import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { history } from '@umijs/max';
import { Button, message, Tag } from 'antd';
import { useRef, useState } from 'react';
import { queryLedger } from '@/services/ledger';

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  PENDING_APPROVAL: { text: '待审批', color: 'processing' },
  APPROVED: { text: '已通过', color: 'success' },
  REJECTED: { text: '已驳回', color: 'error' },
  WITHDRAWN: { text: '已撤回', color: 'default' },
  TERMINATED: { text: '已终止', color: 'error' },
  DRAFT: { text: '草稿', color: 'default' },
};

// 参与 URL 同步的筛选 key
const URL_KEYS = [
  'contractNo',
  'applicantId',
  'contractType',
  'status',
  'minAmount',
  'maxAmount',
  'startTime',
  'endTime',
];

const Ledger: React.FC = () => {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [exporting, setExporting] = useState(false);

  const readParams = new URLSearchParams(history.location?.search ?? '');
  const initialValues = URL_KEYS.reduce<Record<string, any>>((acc, k) => {
    const v = readParams.get(k);
    if (v) acc[k] = v;
    return acc;
  }, {});

  const columns: ProColumns<any>[] = [
    {
      title: '申请编号',
      dataIndex: 'application_no',
      width: 180,
      search: false,
    },
    {
      title: '申请人',
      dataIndex: 'applicant_name_snapshot',
      width: 100,
      search: false,
    },
    { title: '申请原因', dataIndex: 'reason', ellipsis: true, search: false },
    {
      title: '金额',
      dataIndex: 'total_amount',
      width: 120,
      search: false,
      render: (_, r) => `¥ ${Number(r.total_amount).toFixed(2)}`,
    },
    {
      title: '单据状态',
      dataIndex: 'status',
      valueType: 'select',
      width: 100,
      valueEnum: {
        PENDING_APPROVAL: { text: '待审批' },
        APPROVED: { text: '已通过' },
        REJECTED: { text: '已驳回' },
        WITHDRAWN: { text: '已撤回' },
        TERMINATED: { text: '已终止' },
        DRAFT: { text: '草稿' },
      },
      render: (_, r) => (
        <Tag color={STATUS_MAP[r.status]?.color}>
          {STATUS_MAP[r.status]?.text ?? r.status}
        </Tag>
      ),
    },
    {
      title: '相对方',
      dataIndex: ['items', '0', 'counterparty'],
      ellipsis: true,
      search: false,
    },
    {
      title: '统一社会信用代码',
      dataIndex: ['items', '0', 'credit_code'],
      width: 180,
      search: false,
    },
    {
      title: '银行账号',
      dataIndex: ['items', '0', 'bank_account'],
      width: 180,
      search: false,
    },
    {
      title: '申请时间',
      dataIndex: 'created_at',
      valueType: 'dateTime',
      width: 160,
      search: false,
    },
    // —— 仅参与搜索的筛选字段（不进表格）——
    { title: '合同编号', dataIndex: 'contractNo', hideInTable: true },
    { title: '申请人ID', dataIndex: 'applicantId', hideInTable: true },
    {
      title: '合同类型',
      dataIndex: 'contractType',
      valueType: 'select',
      hideInTable: true,
      valueEnum: {
        PURCHASE: { text: '采购合同' },
        SALES: { text: '销售合同' },
        SERVICE: { text: '服务合同' },
        NDA: { text: '保密协议' },
      },
    },
    {
      title: '金额下限',
      dataIndex: 'minAmount',
      valueType: 'digit',
      hideInTable: true,
    },
    {
      title: '金额上限',
      dataIndex: 'maxAmount',
      valueType: 'digit',
      hideInTable: true,
    },
    {
      title: '申请时间区间',
      dataIndex: 'timeRange',
      valueType: 'dateTimeRange',
      hideInTable: true,
      search: {
        transform: (value: [string, string]) => ({
          startTime: value[0],
          endTime: value[1],
        }),
      },
    },
  ];

  const doExport = async () => {
    setExporting(true);
    try {
      message.info('导出任务已提交，阶段 9 接入流式导出');
    } finally {
      setExporting(false);
    }
  };

  return (
    <PageContainer title="合同台账与审计导出">
      <ProTable
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        form={{ initialValues }}
        request={async (params) => {
          const { current, pageSize, timeRange, ...rest } = params;
          const q: Record<string, any> = {};
          for (const k of [
            'contractNo',
            'applicantId',
            'contractType',
            'status',
            'minAmount',
            'maxAmount',
            'startTime',
            'endTime',
          ]) {
            if (rest[k] !== undefined && rest[k] !== '' && rest[k] !== null) {
              q[k] = rest[k];
            }
          }

          // 同步到 URL（空值不入 URL）
          const next = new URLSearchParams();
          for (const k of URL_KEYS) {
            if (q[k] !== undefined && q[k] !== '' && q[k] !== null) {
              next.set(k, String(q[k]));
            }
          }
          history.replace(
            next.toString() ? `/ledger?${next.toString()}` : '/ledger',
          );

          const res = await queryLedger({ ...q, page: current, pageSize });
          return {
            data: res.data.data ?? [],
            total: res.data.total ?? 0,
            success: true,
          };
        }}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        scroll={{ x: 1200 }}
        toolBarRender={() => [
          <Button
            key="export"
            type="primary"
            loading={exporting}
            onClick={doExport}
          >
            导出 Excel
          </Button>,
        ]}
      />
    </PageContainer>
  );
};

export default Ledger;
