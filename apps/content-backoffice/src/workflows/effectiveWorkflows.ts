import { roleAllowed } from '../auth/roles';

export function visibleWorkflowForms<
  T extends { id: string; roles: readonly string[] },
>(forms: readonly T[], enabled: readonly string[], role: string): T[] {
  const on = new Set(enabled);
  return forms.filter(
    (form) => on.has(form.id) && roleAllowed(form.roles, role),
  );
}
