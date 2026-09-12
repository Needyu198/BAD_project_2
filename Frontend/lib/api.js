const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5001";

function withQuery(path, query = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });
  const queryString = params.toString();
  return queryString ? `${path}?${queryString}` : path;
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });
  } catch (_networkError) {
    throw new Error(
      `Cannot connect to backend at ${API_BASE_URL}. Start backend server and try again.`
    );
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || "Request failed.");
  }

  return payload;
}

export function registerUser(body) {
  return request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function loginUser(body) {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function requestPasswordReset(body) {
  return request("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function resetPasswordWithToken(body) {
  return request("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function createAppointment(body) {
  return request("/api/appointments", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function listAppointments(query) {
  return request(withQuery("/api/appointments", query));
}

export function updateAppointmentById(appointmentId, body) {
  return request(`/api/appointments/${appointmentId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function deleteAppointmentById(appointmentId, query) {
  return request(withQuery(`/api/appointments/${appointmentId}`, query), {
    method: "DELETE",
  });
}

export function listPets(query) {
  return request(withQuery("/api/pets", query));
}

export function createPet(body) {
  return request("/api/pets", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updatePetById(petId, body, query) {
  return request(withQuery(`/api/pets/${petId}`, query), {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function deletePetById(petId, query) {
  return request(withQuery(`/api/pets/${petId}`, query), {
    method: "DELETE",
  });
}

export function getUserProfile(userId) {
  return request(`/api/users/${userId}/profile`);
}

export function updateUserProfile(userId, body) {
  return request(`/api/users/${userId}/profile`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function changeUserPassword(userId, body) {
  return request(`/api/users/${userId}/change-password`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function listUsers(query) {
  return request(withQuery("/api/users", query));
}

export function deleteUserById(userId) {
  return request(`/api/users/${userId}`, {
    method: "DELETE",
  });
}

export function createConsultation(body) {
  return request("/api/consultations", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function listPrescriptions(query) {
  return request(withQuery("/api/prescriptions", query));
}

export function createPrescription(body) {
  return request("/api/prescriptions", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getDoctorSchedule(doctorId, query) {
  return request(withQuery(`/api/doctor-schedule/${doctorId}`, query));
}

export function addDoctorAvailableSlot(doctorId, body) {
  return request(`/api/doctor-schedule/${doctorId}/available-slots`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function addDoctorBlockedSlot(doctorId, body) {
  return request(`/api/doctor-schedule/${doctorId}/blocked-slots`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateDoctorClinicHours(doctorId, body) {
  return request(`/api/doctor-schedule/${doctorId}/clinic-hours`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function deleteDoctorScheduleSlot(doctorId, slotType, slotId) {
  return request(`/api/doctor-schedule/${doctorId}/${slotType}/${slotId}`, {
    method: "DELETE",
  });
}

export function listBillingRecords(query) {
  return request(withQuery("/api/billing", query));
}

export function createBillingRecord(body) {
  return request("/api/billing", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateBillingChargesById(billingId, body) {
  return request(`/api/billing/${billingId}/charges`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function recordBillingPaymentById(billingId, body) {
  return request(`/api/billing/${billingId}/payment`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function getBillingReceiptById(billingId) {
  return request(`/api/billing/${billingId}/receipt`);
}

export function getReportsAnalytics(query) {
  return request(withQuery("/api/reports/analytics", query));
}

export function listReportSnapshots() {
  return request("/api/reports/snapshots");
}

export function createReportSnapshot(body) {
  return request("/api/reports/snapshots", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function listMedicalRecords(query) {
  return request(withQuery("/api/medical-records", query));
}

export function createMedicalRecord(body) {
  return request("/api/medical-records", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function listVaccinations(query) {
  return request(withQuery("/api/vaccinations", query));
}

export function createVaccination(body) {
  return request("/api/vaccinations", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function deleteVaccinationById(vaccinationId) {
  return request(`/api/vaccinations/${vaccinationId}`, {
    method: "DELETE",
  });
}
