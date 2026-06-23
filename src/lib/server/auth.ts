export function maskSecret(value?: string) {
  if (!value) {
    return "not configured";
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
