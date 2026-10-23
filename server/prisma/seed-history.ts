import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 预置 2000 条历史单据（评审要求 ≥2000 条用于验证列表/筛选/导出性能）。
 * 前置：先跑 `npm run prisma:seed` 建基础账号/部门/岗位。
 */
async function main() {
  const applicant = await prisma.user.findUnique({
    where: { employee_no: 'E1001' },
  });
  const dept = await prisma.department.findUnique({ where: { code: 'IT' } });
  if (!applicant || !dept) {
    throw new Error('请先运行 npm run prisma:seed（基础账号）');
  }

  // 幂等：清理旧历史数据
  await prisma.contractItem.deleteMany({
    where: { contract: { application_no: { startsWith: 'CT2026' } } },
  });
  await prisma.contract.deleteMany({
    where: { application_no: { startsWith: 'CT2026' } },
  });

  const N = 2000;
  const statuses = ['APPROVED', 'REJECTED', 'PENDING_APPROVAL', 'DRAFT'] as const;
  const now = Date.now();

  const contractRows = Array.from({ length: N }, (_, k) => {
    const i = k + 1;
    const t = new Date(now - i * 3600 * 1000);
    return {
      application_no: `CT2026${String(i).padStart(4, '0')}`,
      applicant_id: applicant.id,
      applicant_name_snapshot: applicant.name,
      department_id: dept.id,
      department_name_snapshot: dept.name,
      reason: '批量历史合同',
      total_amount: 10000 + i,
      status: statuses[i % statuses.length],
      created_at: t,
      submitted_at: t,
    };
  });

  const created = await prisma.contract.createManyAndReturn({
    data: contractRows,
  });

  const itemRows = created.map((c) => {
    const suffix = c.application_no.slice(-4);
    const i = Number(suffix);
    return {
      contract_id: c.id,
      contract_name: `购销合同-${suffix}`,
      contract_type: 'PURCHASE',
      amount: 10000 + i,
      counterparty: '相对方科技有限公司',
      seal_type: 'OFFICIAL_SEAL',
      credit_code: '91310000MA1FL0ABCD',
      bank_account: '6222020200001234567',
    };
  });

  await prisma.contractItem.createMany({ data: itemRows });

  console.log(`历史单据 ${created.length} 条（含明细）完成`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });