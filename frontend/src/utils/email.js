const EMAIL_PATTERN = /^[^@\s]+@[A-Za-z0-9][A-Za-z0-9.-]*\.[^@\s]+$/;

export function isEmailValid(value) {
  if (!value) return false;
  const candidate = String(value).trim();
  return EMAIL_PATTERN.test(candidate);
}
