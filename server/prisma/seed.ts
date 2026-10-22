import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEV_PASSWORD = 'Passw0rd!';

async function main() {
  // ---------- 角色 ----------
  const roleSeeds = [
    { code: 'employee', name: '普通员工' },
    { code: 'approver', name: '审批人' },
    { code: 'admin', name: '系统管理员' },
    { code: 'auditor', name: '合规审计员' },
  ];
  for (const r of roleSeeds) {
    await prisma.role.upsert({ where: { code: r.code }, update: {}, create: r });
  }

  // ---------- 部门 ----------
  const deptSeeds = [
    { code: 'IT', name: '信息技术部' },
    { code: 'FIN', name: '财务部' },
    { code: 'LEGAL', name: '法务部' },
    { code: 'GM', name: '总经理办公室' },
  ];
  for (const d of deptSeeds) {
    await prisma.department.upsert({ where: { code: d.code }, update: {}, create: d });
  }

  const pwd = await bcrypt.hash(DEV_PASSWORD, 10);

  // ---------- 用户（7 测试账号，覆盖全部角色）----------
  const users = [
    { employee_no: 'E1001', name: '张三', email: 'zhangsan@corp.com', dept: 'IT', level: 1, roles: ['employee'] },
    { employee_no: 'E1002', name: '李主管', email: 'lizhuguan@corp.com', dept: 'IT', level: 2, roles: ['employee', 'approver'] },
    { employee_no: 'E1003', name: '王主管', email: 'wangzhuguan@corp.com', dept: 'FIN', level: 2, roles: ['employee', 'approver'] },
    { employee_no: 'E2001', name: '赵法务', email: 'zhaofawu@corp.com', dept: 'LEGAL', level: 3, roles: ['employee', 'approver'] },
    { employee_no: 'E2002', name: '钱总监', email: 'qianzongjian@corp.com', dept: 'FIN', level: 4, roles: ['employee', 'approver'] },
    { employee_no: 'E9001', name: '系统管理员', email: 'admin@corp.com', dept: 'GM', level: 5, roles: ['admin'] },
    { employee_no: 'E9002', name: '审计员', email: 'auditor@corp.com', dept: 'GM', level: 4, roles: ['auditor'] },
  ];

  for (const u of users) {
    const dept = await prisma.department.findUnique({ where: { code: u.dept } });
    const roles = await prisma.role.findMany({ where: { code: { in: u.roles } } });
    const user = await prisma.user.upsert({
      where: { employee_no: u.employee_no },
      update: {
        password_hash: pwd,
        name: u.name,
        email: u.email,
        department_id: dept?.id ?? null,
        job_level: u.level,
      },
      create: {
        employee_no: u.employee_no,
        name: u.name,
        email: u.email,
        password_hash: pwd,
        department_id: dept?.id ?? null,
        job_level: u.level,
      },
    });
    await prisma.userRole.deleteMany({ where: { user_id: user.id } });
    for (const r of roles) {
      await prisma.userRole.create({ data: { user_id: user.id, role_id: r.id } });
    }
  }

  // ---------- 部门主管映射（departments.manager_user_id）----------
  const mapManager = async (deptCode: string, empNo: string) => {
    const dept = await prisma.department.findUnique({ where: { code: deptCode } });
    const mgr = await prisma.user.findUnique({ where: { employee_no: empNo } });
    if (dept && mgr) {
      await prisma.department.update({ where: { id: dept.id }, data: { manager_user_id: mgr.id } });
    }
  };
  await mapManager('IT', 'E1002');
  await mapManager('FIN', 'E1003');

  // ---------- 审批岗位映射（法务 / 财务总监）----------
  const legalPos = await prisma.approvalPosition.upsert({
    where: { code: 'LEGAL_REVIEW' },
    update: {},
    create: { code: 'LEGAL_REVIEW', name: '法务审批' },
  });
  const cfoPos = await prisma.approvalPosition.upsert({
    where: { code: 'CFO' },
    update: {},
    create: { code: 'CFO', name: '财务总监' },
  });
  const bindAssignee = async (positionId: string, empNo: string) => {
    const u = await prisma.user.findUnique({ where: { employee_no: empNo } });
    if (u) {
      await prisma.approvalPositionAssignee.upsert({
        where: { position_id_user_id: { position_id: positionId, user_id: u.id } },
        update: {},
        create: { position_id: positionId, user_id: u.id },
      });
    }
  };
  await bindAssignee(legalPos.id, 'E2001');
  await bindAssignee(cfoPos.id, 'E2002');

  console.log(
    `Seed 完成：4 角色 / 4 部门 / ${users.length} 账号 / 2 审批岗位，统一密码 ${DEV_PASSWORD}`,
  );
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