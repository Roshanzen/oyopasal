export function validateRequired(value: string, label: string): string | null {
  if (!value || !value.trim()) {
    return `${label} is required.`;
  }
  return null;
}

export function validatePassword(password: string, minLength = 6): string | null {
  if (!password || password.length < minLength) {
    return `Password must be at least ${minLength} characters.`;
  }
  return null;
}

export function validatePhoneOrEmail(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return 'Phone number or email is required.';
  if (trimmed.includes('@')) {
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    return emailOk ? null : 'Please enter a valid email address.';
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 7) {
    return 'Please enter a valid phone number or email address.';
  }
  return null;
}
