-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'TERMINATED');

-- CreateEnum
CREATE TYPE "Urgency" AS ENUM ('NORMAL', 'URGENT');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('PURCHASE', 'SALES', 'SERVICE', 'NDA');

-- CreateEnum
CREATE TYPE "SealType" AS ENUM ('OFFICIAL_SEAL', 'CONTRACT_SEAL', 'LEGAL_REP_SEAL');

-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('UPLOADED', 'LINKED');

-- CreateEnum
CREATE TYPE "NodeType" AS ENUM ('DEPARTMENT_MANAGER', 'LEGAL_REVIEW', 'CFO');

-- CreateEnum
CREATE TYPE "NodeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'TRANSFERRED', 'WAITING_SIGN', 'CANCELLED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('APPROVAL', 'SIGNATURE');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('LOGIN', 'SUBMIT', 'SAVE_DRAFT', 'APPROVE', 'REJECT', 'TRANSFER', 'ADD_SIGN', 'SIGN_APPROVE', 'SIGN_REJECT', 'WITHDRAW', 'TERMINATE', 'UPLOAD_FILE', 'DOWNLOAD_FILE', 'EXPORT_REQUEST', 'EXPORT_DOWNLOAD');

-- CreateEnum
CREATE TYPE "SignStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExportJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "employee_no" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "department_id" UUID,
    "job_level" INTEGER NOT NULL DEFAULT 1,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" UUID,
    "manager_user_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "ApprovalPosition" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ApprovalPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalPositionAssignee" (
    "id" UUID NOT NULL,
    "position_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalPositionAssignee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" UUID NOT NULL,
    "application_no" TEXT NOT NULL,
    "applicant_id" UUID NOT NULL,
    "applicant_name_snapshot" TEXT NOT NULL,
    "department_id" UUID NOT NULL,
    "department_name_snapshot" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "urgency" "Urgency" NOT NULL DEFAULT 'NORMAL',
    "total_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "approval_instance_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 0,
    "submitted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractItem" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "contract_name" TEXT NOT NULL,
    "contract_type" "ContractType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "counterparty" TEXT NOT NULL,
    "seal_type" "SealType" NOT NULL,
    "file_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ContractItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "File" (
    "id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "checksum" TEXT NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "status" "FileStatus" NOT NULL DEFAULT 'UPLOADED',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalInstance" (
    "id" UUID NOT NULL,
    "business_type" TEXT NOT NULL DEFAULT 'CONTRACT',
    "business_id" UUID NOT NULL,
    "rule_version" TEXT NOT NULL,
    "total_amount_snapshot" DECIMAL(18,2) NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "ApprovalInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalNode" (
    "id" UUID NOT NULL,
    "instance_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "node_type" "NodeType" NOT NULL,
    "approver_id" UUID NOT NULL,
    "approver_name_snapshot" TEXT NOT NULL,
    "department_id_snapshot" TEXT,
    "status" "NodeStatus" NOT NULL DEFAULT 'PENDING',
    "activated_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "ApprovalNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalTask" (
    "id" UUID NOT NULL,
    "instance_id" UUID NOT NULL,
    "node_id" UUID NOT NULL,
    "assignee_id" UUID NOT NULL,
    "task_type" "TaskType" NOT NULL DEFAULT 'APPROVAL',
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "ApprovalTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalAction" (
    "id" UUID NOT NULL,
    "instance_id" UUID NOT NULL,
    "node_id" UUID,
    "task_id" UUID,
    "actor_id" UUID NOT NULL,
    "action_type" "ActionType" NOT NULL,
    "comment" TEXT,
    "from_user_id" UUID,
    "to_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalSignature" (
    "id" UUID NOT NULL,
    "parent_task_id" UUID NOT NULL,
    "signature_task_id" UUID,
    "signer_id" UUID NOT NULL,
    "status" "SignStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "ApprovalSignature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "action" "ActionType" NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "request_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "before_snapshot" JSONB,
    "after_snapshot" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportJob" (
    "id" UUID NOT NULL,
    "requested_by" UUID NOT NULL,
    "filters_snapshot" JSONB NOT NULL,
    "status" "ExportJobStatus" NOT NULL DEFAULT 'QUEUED',
    "row_count" INTEGER,
    "file_id" UUID,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "duration_ms" INTEGER,
    "error_code" TEXT,
    "error_message" TEXT,
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_employee_no_key" ON "User"("employee_no");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_department_id_idx" ON "User"("department_id");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalPosition_code_key" ON "ApprovalPosition"("code");

-- CreateIndex
CREATE INDEX "ApprovalPositionAssignee_position_id_idx" ON "ApprovalPositionAssignee"("position_id");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalPositionAssignee_position_id_user_id_key" ON "ApprovalPositionAssignee"("position_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_application_no_key" ON "Contract"("application_no");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_approval_instance_id_key" ON "Contract"("approval_instance_id");

-- CreateIndex
CREATE INDEX "Contract_applicant_id_idx" ON "Contract"("applicant_id");

-- CreateIndex
CREATE INDEX "Contract_status_idx" ON "Contract"("status");

-- CreateIndex
CREATE INDEX "Contract_created_at_idx" ON "Contract"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "ContractItem_file_id_key" ON "ContractItem"("file_id");

-- CreateIndex
CREATE INDEX "ContractItem_contract_id_idx" ON "ContractItem"("contract_id");

-- CreateIndex
CREATE INDEX "ContractItem_file_id_idx" ON "ContractItem"("file_id");

-- CreateIndex
CREATE UNIQUE INDEX "File_storage_key_key" ON "File"("storage_key");

-- CreateIndex
CREATE INDEX "File_uploaded_by_idx" ON "File"("uploaded_by");

-- CreateIndex
CREATE INDEX "File_status_idx" ON "File"("status");

-- CreateIndex
CREATE INDEX "ApprovalInstance_business_id_idx" ON "ApprovalInstance"("business_id");

-- CreateIndex
CREATE INDEX "ApprovalInstance_status_idx" ON "ApprovalInstance"("status");

-- CreateIndex
CREATE INDEX "ApprovalNode_instance_id_idx" ON "ApprovalNode"("instance_id");

-- CreateIndex
CREATE INDEX "ApprovalNode_approver_id_idx" ON "ApprovalNode"("approver_id");

-- CreateIndex
CREATE INDEX "ApprovalNode_status_idx" ON "ApprovalNode"("status");

-- CreateIndex
CREATE INDEX "ApprovalTask_assignee_id_idx" ON "ApprovalTask"("assignee_id");

-- CreateIndex
CREATE INDEX "ApprovalTask_status_idx" ON "ApprovalTask"("status");

-- CreateIndex
CREATE INDEX "ApprovalTask_instance_id_idx" ON "ApprovalTask"("instance_id");

-- CreateIndex
CREATE INDEX "ApprovalAction_instance_id_idx" ON "ApprovalAction"("instance_id");

-- CreateIndex
CREATE INDEX "ApprovalAction_actor_id_idx" ON "ApprovalAction"("actor_id");

-- CreateIndex
CREATE INDEX "ApprovalAction_task_id_idx" ON "ApprovalAction"("task_id");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalSignature_signature_task_id_key" ON "ApprovalSignature"("signature_task_id");

-- CreateIndex
CREATE INDEX "ApprovalSignature_parent_task_id_idx" ON "ApprovalSignature"("parent_task_id");

-- CreateIndex
CREATE INDEX "ApprovalSignature_signer_id_idx" ON "ApprovalSignature"("signer_id");

-- CreateIndex
CREATE INDEX "AuditLog_actor_id_idx" ON "AuditLog"("actor_id");

-- CreateIndex
CREATE INDEX "AuditLog_resource_id_idx" ON "AuditLog"("resource_id");

-- CreateIndex
CREATE INDEX "AuditLog_request_id_idx" ON "AuditLog"("request_id");

-- CreateIndex
CREATE INDEX "AuditLog_created_at_idx" ON "AuditLog"("created_at");

-- CreateIndex
CREATE INDEX "ExportJob_requested_by_idx" ON "ExportJob"("requested_by");

-- CreateIndex
CREATE INDEX "ExportJob_status_idx" ON "ExportJob"("status");

-- CreateIndex
CREATE INDEX "ExportJob_created_at_idx" ON "ExportJob"("created_at");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_manager_user_id_fkey" FOREIGN KEY ("manager_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalPositionAssignee" ADD CONSTRAINT "ApprovalPositionAssignee_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "ApprovalPosition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalPositionAssignee" ADD CONSTRAINT "ApprovalPositionAssignee_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_applicant_id_fkey" FOREIGN KEY ("applicant_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_approval_instance_id_fkey" FOREIGN KEY ("approval_instance_id") REFERENCES "ApprovalInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractItem" ADD CONSTRAINT "ContractItem_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractItem" ADD CONSTRAINT "ContractItem_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalNode" ADD CONSTRAINT "ApprovalNode_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "ApprovalInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalTask" ADD CONSTRAINT "ApprovalTask_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "ApprovalInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalTask" ADD CONSTRAINT "ApprovalTask_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "ApprovalNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalTask" ADD CONSTRAINT "ApprovalTask_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalAction" ADD CONSTRAINT "ApprovalAction_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalAction" ADD CONSTRAINT "ApprovalAction_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "ApprovalInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalAction" ADD CONSTRAINT "ApprovalAction_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "ApprovalNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalAction" ADD CONSTRAINT "ApprovalAction_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "ApprovalTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalSignature" ADD CONSTRAINT "ApprovalSignature_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "ApprovalTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalSignature" ADD CONSTRAINT "ApprovalSignature_signature_task_id_fkey" FOREIGN KEY ("signature_task_id") REFERENCES "ApprovalTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalSignature" ADD CONSTRAINT "ApprovalSignature_signer_id_fkey" FOREIGN KEY ("signer_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportJob" ADD CONSTRAINT "ExportJob_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
