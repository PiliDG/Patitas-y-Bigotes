const NAME_PATTERN = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:[\s'´-]+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*$/;

export function isFullNameValid(value) {
  if (!value) return false;
  const candidate = String(value).trim();
  if (candidate.length < 3) return false;
  return NAME_PATTERN.test(candidate);
}
