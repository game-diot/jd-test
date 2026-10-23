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
CREATE TABLE "users" (
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

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" UUID,
    "manager_user_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "approval_positions" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "approval_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_position_assignees" (
    "id" UUID NOT NULL,
    "position_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_position_assignees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
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

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_items" (
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

    CONSTRAINT "contract_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "checksum" TEXT NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "status" "FileStatus" NOT NULL DEFAULT 'UPLOADED',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_instances" (
    "id" UUID NOT NULL,
    "business_type" TEXT NOT NULL DEFAULT 'CONTRACT',
    "business_id" UUID NOT NULL,
    "rule_version" TEXT NOT NULL,
    "total_amount_snapshot" DECIMAL(18,2) NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "approval_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_nodes" (
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

    CONSTRAINT "approval_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_tasks" (
    "id" UUID NOT NULL,
    "instance_id" UUID NOT NULL,
    "node_id" UUID NOT NULL,
    "assignee_id" UUID NOT NULL,
    "task_type" "TaskType" NOT NULL DEFAULT 'APPROVAL',
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "approval_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_actions" (
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

    CONSTRAINT "approval_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_signatures" (
    "id" UUID NOT NULL,
    "parent_task_id" UUID NOT NULL,
    "signature_task_id" UUID,
    "signer_id" UUID NOT NULL,
    "status" "SignStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "approval_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
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

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_jobs" (
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

    CONSTRAINT "export_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_employee_no_key" ON "users"("employee_no");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_department_id_idx" ON "users"("department_id");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "approval_positions_code_key" ON "approval_positions"("code");

-- CreateIndex
CREATE INDEX "approval_position_assignees_position_id_idx" ON "approval_position_assignees"("position_id");

-- CreateIndex
CREATE UNIQUE INDEX "approval_position_assignees_position_id_user_id_key" ON "approval_position_assignees"("position_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_application_no_key" ON "contracts"("application_no");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_approval_instance_id_key" ON "contracts"("approval_instance_id");

-- CreateIndex
CREATE INDEX "contracts_applicant_id_idx" ON "contracts"("applicant_id");

-- CreateIndex
CREATE INDEX "contracts_status_idx" ON "contracts"("status");

-- CreateIndex
CREATE INDEX "contracts_created_at_idx" ON "contracts"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "contract_items_file_id_key" ON "contract_items"("file_id");

-- CreateIndex
CREATE INDEX "contract_items_contract_id_idx" ON "contract_items"("contract_id");

-- CreateIndex
CREATE INDEX "contract_items_file_id_idx" ON "contract_items"("file_id");

-- CreateIndex
CREATE UNIQUE INDEX "files_storage_key_key" ON "files"("storage_key");

-- CreateIndex
CREATE INDEX "files_uploaded_by_idx" ON "files"("uploaded_by");

-- CreateIndex
CREATE INDEX "files_status_idx" ON "files"("status");

-- CreateIndex
CREATE INDEX "approval_instances_business_id_idx" ON "approval_instances"("business_id");

-- CreateIndex
CREATE INDEX "approval_instances_status_idx" ON "approval_instances"("status");

-- CreateIndex
CREATE INDEX "approval_nodes_instance_id_idx" ON "approval_nodes"("instance_id");

-- CreateIndex
CREATE INDEX "approval_nodes_approver_id_idx" ON "approval_nodes"("approver_id");

-- CreateIndex
CREATE INDEX "approval_nodes_status_idx" ON "approval_nodes"("status");

-- CreateIndex
CREATE INDEX "approval_tasks_assignee_id_idx" ON "approval_tasks"("assignee_id");

-- CreateIndex
CREATE INDEX "approval_tasks_status_idx" ON "approval_tasks"("status");

-- CreateIndex
CREATE INDEX "approval_tasks_instance_id_idx" ON "approval_tasks"("instance_id");

-- CreateIndex
CREATE INDEX "approval_actions_instance_id_idx" ON "approval_actions"("instance_id");

-- CreateIndex
CREATE INDEX "approval_actions_actor_id_idx" ON "approval_actions"("actor_id");

-- CreateIndex
CREATE INDEX "approval_actions_task_id_idx" ON "approval_actions"("task_id");

-- CreateIndex
CREATE UNIQUE INDEX "approval_signatures_signature_task_id_key" ON "approval_signatures"("signature_task_id");

-- CreateIndex
CREATE INDEX "approval_signatures_parent_task_id_idx" ON "approval_signatures"("parent_task_id");

-- CreateIndex
CREATE INDEX "approval_signatures_signer_id_idx" ON "approval_signatures"("signer_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_resource_id_idx" ON "audit_logs"("resource_id");

-- CreateIndex
CREATE INDEX "audit_logs_request_id_idx" ON "audit_logs"("request_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "export_jobs_requested_by_idx" ON "export_jobs"("requested_by");

-- CreateIndex
CREATE INDEX "export_jobs_status_idx" ON "export_jobs"("status");

-- CreateIndex
CREATE INDEX "export_jobs_created_at_idx" ON "export_jobs"("created_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_manager_user_id_fkey" FOREIGN KEY ("manager_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_position_assignees" ADD CONSTRAINT "approval_position_assignees_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "approval_positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_position_assignees" ADD CONSTRAINT "approval_position_assignees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_applicant_id_fkey" FOREIGN KEY ("applicant_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_approval_instance_id_fkey" FOREIGN KEY ("approval_instance_id") REFERENCES "approval_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_items" ADD CONSTRAINT "contract_items_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_items" ADD CONSTRAINT "contract_items_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_nodes" ADD CONSTRAINT "approval_nodes_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "approval_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_tasks" ADD CONSTRAINT "approval_tasks_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "approval_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_tasks" ADD CONSTRAINT "approval_tasks_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "approval_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_tasks" ADD CONSTRAINT "approval_tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_actions" ADD CONSTRAINT "approval_actions_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_actions" ADD CONSTRAINT "approval_actions_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "approval_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_actions" ADD CONSTRAINT "approval_actions_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "approval_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_actions" ADD CONSTRAINT "approval_actions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "approval_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_signatures" ADD CONSTRAINT "approval_signatures_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "approval_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_signatures" ADD CONSTRAINT "approval_signatures_signature_task_id_fkey" FOREIGN KEY ("signature_task_id") REFERENCES "approval_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_signatures" ADD CONSTRAINT "approval_signatures_signer_id_fkey" FOREIGN KEY ("signer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
