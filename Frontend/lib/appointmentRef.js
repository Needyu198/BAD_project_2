export function formatAppointmentReference(appointmentId) {
  const rawId = String(appointmentId || "").trim();
  if (!rawId) {
    return "APT-UNKNOWN";
  }
  const suffix = rawId.slice(-6).toUpperCase();
  return `APT-${suffix}`;
}
