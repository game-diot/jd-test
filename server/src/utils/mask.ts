/**
 * 服务端统一脱敏规则（PRD §7.4）：
 * - 统一社会信用代码：91310000MA1FL0ABCD → 9131**********ABCD（前4 + * + 后4）
 * - 银行账号：6222020200001234567 → 6222 **** **** 4567（前4 + 2组**** + 后4）
 * 非法/异常格式不因脱敏失败而原样泄露。
 */

export function maskCreditCode(code: string | null | undefined): string {
  if (!code) return '—';
  if (code.length <= 8) return '****';
  return `${code.slice(0, 4)}${'*'.repeat(code.length - 8)}${code.slice(-4)}`;
}

export function maskBankAccount(account: string | null | undefined): string {
  if (!account) return '—';
  if (account.length <= 8) return '****';
  return `${account.slice(0, 4)} **** **** ${account.slice(-4)}`;
}