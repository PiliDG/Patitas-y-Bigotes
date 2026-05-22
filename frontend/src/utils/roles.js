const ROLE_LABELS = {
  public: 'Rol actual: Público',
  adoptante: 'Rol actual: Adoptante',
  operador: 'Rol actual: Operador',
  veterinario: 'Rol actual: Veterinario',
  admin: 'Rol actual: Administrador'
};

export function getRoleLabel(role) {
  return ROLE_LABELS[role] || ROLE_LABELS.public;
}

export function isRole(role, expected) {
  if (!role) return false;
  const normalized = role.toLowerCase();
  if (Array.isArray(expected)) {
    return expected.some((item) => normalized === item);
  }
  return normalized === expected;
}
