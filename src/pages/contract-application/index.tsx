import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { useModel } from '@umijs/max';
import {
  Button,
  Card,
  Col,
  Empty,
  Input,
  InputNumber,
  message,
  Radio,
  Row,
  Select,
  Space,
  Steps,
  Tag,
  Typography,
  Upload,
} from 'antd';
import { useMemo, useState } from 'react';
import type { UserProfile } from '@/services/auth';
import {
  type ContractItemForm,
  createContract,
  submitContract,
} from '@/services/contracts';
import { uploadFile } from '@/services/files';

const CONTRACT_TYPE_OPTIONS = [
  { value: 'PURCHASE', label: '采购合同' },
  { value: 'SALES', label: '销售合同' },
  { value: 'SERVICE', label: '服务合同' },
  { value: 'NDA', label: '保密协议' },
];
const SEAL_TYPE_OPTIONS = [
  { value: 'OFFICIAL_SEAL', label: '公章' },
  { value: 'CONTRACT_SEAL', label: '合同章' },
  { value: 'LEGAL_REP_SEAL', label: '法人章' },
];

const emptyItem = (): ContractItemForm => ({
  id: crypto.randomUUID(),
  contractName: '',
  contractType: 'PURCHASE',
  amount: '',
  counterparty: '',
  sealType: 'CONTRACT_SEAL',
});

function toNum(s: string | undefined): number {
  if (!s || s === '') return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** 审批链实时预览（前端仅供展示，正式提交以服务端快照为准） */
function computeChain(total: number): string[] {
  if (total < 500000) return ['部门主管'];
  if (total < 2000000) return ['部门主管', '法务审批'];
  return ['部门主管', '法务审批', '财务总监'];
}

const ContractApplication: React.FC = () => {
  const { initialState } = useModel('@@initialState');
  const currentUser = initialState?.currentUser as UserProfile | undefined;

  const [reason, setReason] = useState('');
  const [urgency, setUrgency] = useState<'NORMAL' | 'URGENT'>('NORMAL');
  const [items, setItems] = useState<ContractItemForm[]>([emptyItem()]);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);

  const total = useMemo(
    () =>
      items.reduce((sum, it) => {
        const v = toNum(it.amount);
        return sum + (it.contractType !== 'NDA' && v > 0 ? v : 0);
      }, 0),
    [items],
  );

  const chain = useMemo(() => computeChain(total), [total]);

  const updateItem = (index: number, patch: Partial<ContractItemForm>) => {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    );
  };

  const onTypeChange = (index: number, type: string) => {
    if (type === 'NDA') {
      updateItem(index, {
        contractType: type,
        amount: '0.00',
        sealType: 'OFFICIAL_SEAL',
      });
    } else {
      updateItem(index, { contractType: type, amount: '' });
    }
  };

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);

  const removeItem = (index: number) => {
    if (items.length <= 1) {
      message.warning('至少保留一条合同明细');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const validateForm = (): boolean => {
    if (!reason.trim()) {
      message.error('请填写申请原因');
      return false;
    }
    for (const it of items) {
      if (!it.contractName.trim() || !it.counterparty.trim()) {
        message.error('请完整填写每份合同的名称与签约相对方');
        return false;
      }
      if (it.contractType !== 'NDA' && toNum(it.amount) <= 0) {
        message.error('普通合同金额必须大于 0');
        return false;
      }
      if (!it.fileId) {
        message.error('请为每份合同上传 PDF 附件');
        return false;
      }
    }
    return true;
  };

  const onSave = async () => {
    if (!validateForm()) return;
    setSaving(true);
    try {
      const res = await createContract({
        reason: reason.trim(),
        urgency,
        items,
      });
      setDraftId(res.data?.id ?? null);
      message.success('草稿已保存，可提交');
    } finally {
      setSaving(false);
    }
  };

  const onSubmit = async () => {
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      let id = draftId;
      if (!id) {
        const res = await createContract({
          reason: reason.trim(),
          urgency,
          items,
        });
        id = res.data?.id ?? null;
      }
      if (!id) {
        message.error('保存失败，请重试');
        return;
      }
      await submitContract(id);
      message.success('已提交，进入审批流程');
      setDraftId(null);
      setReason('');
      setItems([emptyItem()]);
    } catch {
      // 错误由 request 层统一提示
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageContainer title="合同用印申请">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        {/* 主表信息 */}
        <Card title="申请信息" variant="borderless">
          <Row gutter={[24, 16]}>
            <Col span={8}>
              <Typography.Text type="secondary">申请人</Typography.Text>
              <div style={{ marginTop: 4 }}>{currentUser?.name ?? '-'}</div>
            </Col>
            <Col span={8}>
              <Typography.Text type="secondary">所属部门</Typography.Text>
              <div style={{ marginTop: 4 }}>
                {currentUser?.departmentName ?? '-'}
              </div>
            </Col>
            <Col span={8}>
              <Typography.Text type="secondary">紧急程度</Typography.Text>
              <div style={{ marginTop: 4 }}>
                <Radio.Group
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value)}
                  options={[
                    { value: 'NORMAL', label: '普通' },
                    { value: 'URGENT', label: '加急' },
                  ]}
                />
              </div>
            </Col>
            <Col span={24}>
              <Typography.Text type="secondary">
                申请原因（必填，100 字以内）
              </Typography.Text>
              <Input.TextArea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={100}
                showCount
                rows={3}
                placeholder="请说明本次合同用印申请的原因"
                style={{ marginTop: 4 }}
              />
            </Col>
          </Row>
        </Card>

        {/* 合同明细动态表单 */}
        <Card
          title="合同明细"
          variant="borderless"
          extra={
            <Button type="dashed" icon={<PlusOutlined />} onClick={addItem}>
              添加合同明细
            </Button>
          }
        >
          {items.map((it, index) => {
            const isNda = it.contractType === 'NDA';
            return (
              <Card
                key={it.id}
                size="small"
                style={{ marginBottom: 12 }}
                type="inner"
                title={`合同 ${index + 1}`}
                extra={
                  <Button
                    type="text"
                    danger
                    icon={<MinusCircleOutlined />}
                    onClick={() => removeItem(index)}
                    disabled={items.length <= 1}
                  >
                    删除
                  </Button>
                }
              >
                <Row gutter={[12, 12]}>
                  <Col span={12}>
                    <Typography.Text type="secondary">
                      合同名称 *
                    </Typography.Text>
                    <Input
                      value={it.contractName}
                      maxLength={50}
                      onChange={(e) =>
                        updateItem(index, { contractName: e.target.value })
                      }
                      placeholder="合同名称（≤50 字）"
                      style={{ marginTop: 4 }}
                    />
                  </Col>
                  <Col span={12}>
                    <Typography.Text type="secondary">
                      合同类型 *
                    </Typography.Text>
                    <Select
                      value={it.contractType}
                      onChange={(v) => onTypeChange(index, v)}
                      options={CONTRACT_TYPE_OPTIONS}
                      style={{ marginTop: 4, width: '100%' }}
                    />
                  </Col>
                  <Col span={12}>
                    <Typography.Text type="secondary">
                      合同金额 *
                    </Typography.Text>
                    <InputNumber
                      value={isNda ? 0 : toNum(it.amount) || undefined}
                      disabled={isNda}
                      min={0.01}
                      precision={2}
                      onChange={(v) =>
                        updateItem(index, { amount: String(v ?? '') })
                      }
                      placeholder={isNda ? '保密协议金额为 0' : '金额（元）'}
                      style={{ marginTop: 4, width: '100%' }}
                    />
                  </Col>
                  <Col span={12}>
                    <Typography.Text type="secondary">
                      签约相对方 *
                    </Typography.Text>
                    <Input
                      value={it.counterparty}
                      onChange={(e) =>
                        updateItem(index, { counterparty: e.target.value })
                      }
                      placeholder="对方单位名称"
                      style={{ marginTop: 4 }}
                    />
                  </Col>
                  <Col span={12}>
                    <Typography.Text type="secondary">
                      用印类型 *
                    </Typography.Text>
                    <Select
                      value={it.sealType}
                      disabled={isNda}
                      onChange={(v) => updateItem(index, { sealType: v })}
                      options={
                        isNda
                          ? SEAL_TYPE_OPTIONS.filter(
                              (o) => o.value === 'OFFICIAL_SEAL',
                            )
                          : SEAL_TYPE_OPTIONS
                      }
                      style={{ marginTop: 4, width: '100%' }}
                    />
                  </Col>
                  <Col span={12}>
                    <Typography.Text type="secondary">
                      合同附件（PDF）
                    </Typography.Text>
                    <Upload
                      maxCount={1}
                      accept=".pdf"
                      style={{ marginTop: 4 }}
                      beforeUpload={(file) => {
                        if (file.type !== 'application/pdf') {
                          message.error('仅支持 PDF 文件');
                          return Upload.LIST_IGNORE;
                        }
                        if (file.size > 10 * 1024 * 1024) {
                          message.error('文件不能超过 10MiB');
                          return Upload.LIST_IGNORE;
                        }
                        return true;
                      }}
                      customRequest={async (options) => {
                        try {
                          const res = await uploadFile(options.file as File);
                          updateItem(index, { fileId: res.id });
                          message.success(`${res.name} 上传成功`);
                          options.onSuccess?.(res);
                        } catch {
                          message.error('上传失败');
                          options.onError?.(new Error('upload failed'));
                        }
                      }}
                    >
                      <Button>上传 PDF</Button>
                    </Upload>
                    {it.fileId && (
                      <div style={{ marginTop: 4 }}>
                        <Tag color="green">已上传附件</Tag>
                      </div>
                    )}
                  </Col>
                </Row>
              </Card>
            );
          })}
          {items.length === 0 && <Empty description="暂无明细" />}

          <div
            style={{
              textAlign: 'right',
              marginTop: 8,
              fontSize: 16,
              fontWeight: 600,
            }}
          >
            合同金额合计：
            <span style={{ color: '#e1251b' }}>¥ {total.toFixed(2)}</span>
          </div>
        </Card>

        {/* 审批链预览 */}
        <Card title="预计审批链" variant="borderless">
          {chain.length > 0 ? (
            <Steps
              direction="vertical"
              size="small"
              current={-1}
              items={chain.map((node, i) => ({
                title: `${i + 1}. ${node}`,
                status: 'wait',
              }))}
            />
          ) : (
            <Typography.Text type="secondary">
              合计金额为 0，暂无审批链（提交需至少一条普通合同）
            </Typography.Text>
          )}
          <Typography.Text
            type="secondary"
            style={{ display: 'block', marginTop: 8 }}
          >
            预览仅供确认，正式提交时以后端计算的审批链快照为准。
          </Typography.Text>
        </Card>

        <Space>
          <Button loading={saving} onClick={onSave}>
            保存草稿
          </Button>
          <Button type="primary" loading={submitting} onClick={onSubmit}>
            提交申请
          </Button>
        </Space>
      </Space>
    </PageContainer>
  );
};

export default ContractApplication;
