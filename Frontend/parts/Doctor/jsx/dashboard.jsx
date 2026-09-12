import { useEffect, useState } from "react";
import "../css/dashboard.css";
import {
  addDoctorAvailableSlot,
  addDoctorBlockedSlot,
  changeUserPassword,
  createConsultation,
  createMedicalRecord,
  deleteDoctorScheduleSlot,
  getDoctorSchedule,
  getUserProfile,
  listAppointments,
  listMedicalRecords,
  listPets,
  listPrescriptions,
  updateDoctorClinicHours,
  updateAppointmentById,
  updateUserProfile,
} from "../../../lib/api";
import { formatAppointmentReference } from "../../../lib/appointmentRef";
import { compressImageFileToDataUrl } from "../../../lib/imageUpload";
import logo from "../../../images/Web_Logo.png";

const DOCTOR_PAGES = [
  "Doctor Dashboard",
  "Appointments Page",
  "Pet Medical Records Page",
  "Prescriptions and Consultation Page",
  "Doctor Schedule Page",
  "Profile",
];

const PENDING_REQUESTS = [
  "Prescription refill request for Bella",
  "Lab report review request for Max",
  "Follow-up consultation request for Luna",
];

const CONSULTATION_CASE = {
  petName: "Bella",
  breed: "Golden Retriever",
  age: "3 years",
  ownerName: "Jonathan Smith",
  ownerContact: "+1 (555) 102-3344",
  symptoms:
    "Loss of appetite for 2 days, mild fever, and reduced activity level.",
  reason: "General health check and appetite concern.",
};

const PAGE_CONTENT = {
  "Doctor Dashboard": {
    title: "Doctor Dashboard",
    subtitle: "Quick summary of today’s schedule and pending tasks.",
    cards: [],
  },
  "Appointments Page": {
    title: "Appointments Page",
    subtitle: "Review all booked appointments with patient and pet details.",
    cards: [
      {
        title: "Upcoming",
        detail: "Morning and evening bookings",
        action: "Open upcoming",
      },
      {
        title: "Completed",
        detail: "Past consultations log",
        action: "Open completed",
      },
      {
        title: "Cancelled",
        detail: "Cancelled and rescheduled visits",
        action: "Open cancelled",
      },
      {
        title: "Search",
        detail: "Find by date, pet, or owner",
        action: "Search now",
      },
    ],
  },
  "Consultation Details": {
    title: "Consultation Details",
    subtitle: "Capture symptoms, diagnosis notes, and next treatment steps.",
    cards: [
      {
        title: "Current Case",
        detail: "Patient intake and symptoms",
        action: "Start note",
      },
      {
        title: "Diagnosis Notes",
        detail: "Clinical findings and observations",
        action: "Add diagnosis",
      },
      {
        title: "Treatment Plan",
        detail: "Medication and follow-up plan",
        action: "Add plan",
      },
      {
        title: "Follow-up",
        detail: "Set reminder for revisit",
        action: "Schedule follow-up",
      },
    ],
  },
  "Pet Medical Records Page": {
    title: "Pet Medical Records Page",
    subtitle: "Access complete health history, vaccinations, and reports.",
    cards: [
      {
        title: "History",
        detail: "Past diagnoses and visits",
        action: "View history",
      },
      {
        title: "Vaccinations",
        detail: "Track vaccine records",
        action: "View vaccines",
      },
      {
        title: "Allergies",
        detail: "Known allergy and sensitivity list",
        action: "Open allergies",
      },
      {
        title: "Attachments",
        detail: "Reports and imaging files",
        action: "Open files",
      },
    ],
  },
  "Prescriptions and Consultation Page": {
    title: "Prescriptions and Consultation Page",
    subtitle: "Create, update, and review active prescriptions.",
    cards: [
      {
        title: "New Prescription",
        detail: "Add medicines and dosage",
        action: "Create prescription",
      },
      {
        title: "Active Prescriptions",
        detail: "Currently prescribed medications",
        action: "View active",
      },
      {
        title: "Refills",
        detail: "Pending refill requests",
        action: "Manage refills",
      },
      {
        title: "History",
        detail: "Past prescription logs",
        action: "View history",
      },
    ],
  },
  "Doctor Schedule Page": {
    title: "Doctor Schedule Page",
    subtitle: "Manage working hours and blocked consultation slots.",
    cards: [
      {
        title: "Weekly Schedule",
        detail: "Set clinic days and timings",
        action: "Edit schedule",
      },
      {
        title: "Leave Blocks",
        detail: "Mark unavailable dates",
        action: "Set leave",
      },
      {
        title: "Clinic Hours",
        detail: "Update daily working hours",
        action: "Adjust hours",
      },
      {
        title: "Emergency Slots",
        detail: "Assign emergency availability",
        action: "Manage slots",
      },
    ],
  },
  Profile: {
    title: "Profile & Settings",
    subtitle: "Manage your account information and security settings.",
    cards: [
      {
        title: "Edit Profile Info",
        detail: "Update name, contact details, and specialization.",
        action: "Edit Profile",
      },
      {
        title: "Change Password",
        detail: "Update your password for better account security.",
        action: "Change Password",
      },
    ],
  },
};

function formatDoctorReference(doctorId) {
  const rawId = String(doctorId || "").trim();
  if (!rawId) {
    return "DR-UNKNOWN";
  }
  return `DR-${rawId.slice(-6).toUpperCase()}`;
}

function formatPetReference(petId) {
  const rawId = String(petId || "").trim();
  if (!rawId) {
    return "PET-UNKNOWN";
  }
  return `PET-${rawId.slice(-6).toUpperCase()}`;
}

export default function DoctorDashboard({ currentUser, onLogout }) {
  const [activePage, setActivePage] = useState("Doctor Dashboard");
  const [appointmentView, setAppointmentView] = useState("Today");
  const [appointmentStatus, setAppointmentStatus] = useState("All");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [recordSearch, setRecordSearch] = useState("");
  const [doctorPhotoPreview, setDoctorPhotoPreview] = useState("");
  const [profile, setProfile] = useState(currentUser || null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileStatus, setProfileStatus] = useState("");
  const [profileError, setProfileError] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState("");
  const [notificationError, setNotificationError] = useState("");
  const [appointments, setAppointments] = useState([]);
  const [consultAppointmentId, setConsultAppointmentId] = useState("");
  const [isSavingConsultation, setIsSavingConsultation] = useState(false);
  const [consultStatusMessage, setConsultStatusMessage] = useState("");
  const [consultErrorMessage, setConsultErrorMessage] = useState("");
  const [pets, setPets] = useState([]);
  const [prescriptionHistory, setPrescriptionHistory] = useState([]);
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [isSavingMedicalRecord, setIsSavingMedicalRecord] = useState(false);
  const [medicalRecordStatusMessage, setMedicalRecordStatusMessage] =
    useState("");
  const [medicalRecordErrorMessage, setMedicalRecordErrorMessage] =
    useState("");
  const [doctorSchedule, setDoctorSchedule] = useState(null);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [scheduleStatusMessage, setScheduleStatusMessage] = useState("");
  const [scheduleErrorMessage, setScheduleErrorMessage] = useState("");
  const [clinicHours, setClinicHours] = useState({
    mondayFriday: "09:00 AM - 05:00 PM",
    saturday: "10:00 AM - 02:00 PM",
    sunday: "Closed",
  });
  const content = PAGE_CONTENT[activePage] || PAGE_CONTENT["Doctor Dashboard"];
  const todayIso = new Date().toISOString().slice(0, 10);
  const getBucket = (dateValue) => {
    if (!dateValue) {
      return "Upcoming";
    }
    if (dateValue === todayIso) {
      return "Today";
    }
    return dateValue > todayIso ? "Upcoming" : "Past";
  };
  const appointmentRows = appointments.map((item) => ({
    id: item.id,
    bucket: getBucket(item.appointmentDate),
    date: item.appointmentDate,
    status: item.status || "Pending",
    pet: item.petName || "-",
    owner: item.ownerName || "-",
    doctor: item.doctorName || "",
    time: item.appointmentTime || "",
    reason: item.reason || "",
  }));
  const todayAppointments = appointmentRows.filter(
    (item) => item.bucket === "Today"
  );
  const filteredAppointments = appointmentRows.filter((item) => {
    const inView = item.bucket === appointmentView;
    const inStatus =
      appointmentStatus === "All" || item.status === appointmentStatus;
    const inDate = !appointmentDate || item.date === appointmentDate;
    return inView && inStatus && inDate;
  });
  const consultationAppointments = appointmentRows.filter(
    (item) => item.status !== "Cancelled"
  );
  const selectedConsultation =
    consultationAppointments.find((item) => item.id === consultAppointmentId) ||
    consultationAppointments[0] ||
    null;
  const formatConsultDate = (value) => {
    if (!value) {
      return "-";
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }
    return parsed.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };
  const formatConsultOptionLabel = (item) => {
    const shortId = formatAppointmentReference(item.id);
    const datePart = item.date || "-";
    const timePart = item.time || "--:--";
    const petPart = item.pet || "-";
    return `${shortId} | ${datePart} ${timePart} | ${petPart}`;
  };
  const filteredRecords = medicalRecords.filter((item) => {
    const query = recordSearch.trim().toLowerCase();
    if (!query) {
      return false;
    }
    return (
      item.petName.toLowerCase().includes(query) ||
      item.ownerName.toLowerCase().includes(query) ||
      item.id.toLowerCase().includes(query)
    );
  });
  const prescriptionPetOptions = pets
    .map((item) => ({
      id: item.id,
      name: String(item.name || ""),
      ownerName: String(item.ownerName || ""),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const consultationPrescriptionHistory = selectedConsultation?.pet
    ? prescriptionHistory.filter(
        (item) =>
          String(item.petName || "").trim() ===
          String(selectedConsultation.pet || "").trim()
      )
    : prescriptionHistory;
  const consultationMedicalHistory = selectedConsultation?.pet
    ? medicalRecords.filter(
        (item) =>
          String(item.petName || "").trim() ===
          String(selectedConsultation.pet || "").trim()
      )
    : medicalRecords;

  useEffect(() => {
    return () => {
      if (doctorPhotoPreview.startsWith("blob:")) {
        URL.revokeObjectURL(doctorPhotoPreview);
      }
    };
  }, [doctorPhotoPreview]);

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      if (!currentUser?.id) {
        setProfile(currentUser || null);
        return;
      }

      try {
        const response = await getUserProfile(currentUser.id);
        if (!cancelled) {
          setProfile(response?.user || currentUser);
        }
      } catch {
        if (!cancelled) {
          setProfile(currentUser || null);
        }
      }
    };

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  useEffect(() => {
    let cancelled = false;

    const loadAppointments = async () => {
      const doctorName = String(
        profile?.name || currentUser?.name || ""
      ).trim();
      if (!doctorName) {
        if (!cancelled) {
          setAppointments([]);
        }
        return;
      }

      try {
        const response = await listAppointments({ doctorName });
        if (!cancelled) {
          setAppointments(
            Array.isArray(response?.appointments) ? response.appointments : []
          );
        }
      } catch {
        if (!cancelled) {
          setAppointments([]);
        }
      }
    };

    loadAppointments();
    return () => {
      cancelled = true;
    };
  }, [profile?.name, currentUser?.name]);

  useEffect(() => {
    let cancelled = false;

    const loadPrescriptionData = async () => {
      const doctorName = String(
        profile?.name || currentUser?.name || ""
      ).trim();
      try {
        const [petsResponse, prescriptionResponse] = await Promise.all([
          listPets(),
          listPrescriptions(doctorName ? { doctorName } : {}),
        ]);
        if (!cancelled) {
          setPets(Array.isArray(petsResponse?.pets) ? petsResponse.pets : []);
          setPrescriptionHistory(
            Array.isArray(prescriptionResponse?.prescriptions)
              ? prescriptionResponse.prescriptions
              : []
          );
        }
      } catch {
        if (!cancelled) {
          setPets([]);
          setPrescriptionHistory([]);
        }
      }
    };

    loadPrescriptionData();
    return () => {
      cancelled = true;
    };
  }, [profile?.name, currentUser?.name]);

  useEffect(() => {
    let cancelled = false;

    const loadMedicalRecords = async () => {
      try {
        const response = await listMedicalRecords();
        if (!cancelled) {
          setMedicalRecords(
            Array.isArray(response?.records) ? response.records : []
          );
        }
      } catch {
        if (!cancelled) {
          setMedicalRecords([]);
        }
      }
    };

    loadMedicalRecords();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadDoctorSchedule = async () => {
      const doctorId = String(profile?.id || currentUser?.id || "").trim();
      const doctorName = String(
        profile?.name || currentUser?.name || ""
      ).trim();
      if (!doctorId) {
        if (!cancelled) {
          setDoctorSchedule(null);
        }
        return;
      }

      try {
        const response = await getDoctorSchedule(
          doctorId,
          doctorName ? { doctorName } : {}
        );
        const schedule = response?.schedule || null;
        if (!cancelled) {
          setDoctorSchedule(schedule);
          setClinicHours({
            mondayFriday:
              schedule?.clinicHours?.mondayFriday || "09:00 AM - 05:00 PM",
            saturday: schedule?.clinicHours?.saturday || "10:00 AM - 02:00 PM",
            sunday: schedule?.clinicHours?.sunday || "Closed",
          });
        }
      } catch {
        if (!cancelled) {
          setDoctorSchedule(null);
        }
      }
    };

    loadDoctorSchedule();
    return () => {
      cancelled = true;
    };
  }, [profile?.id, profile?.name, currentUser?.id, currentUser?.name]);

  useEffect(() => {
    setConsultAppointmentId((currentId) => {
      if (!consultationAppointments.length) {
        return "";
      }
      if (consultationAppointments.some((item) => item.id === currentId)) {
        return currentId;
      }
      return consultationAppointments[0].id;
    });
  }, [consultationAppointments]);

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const compressed = await compressImageFileToDataUrl(file);
      setDoctorPhotoPreview(compressed);
      setProfileError("");
    } catch (_error) {
      setProfileError("Unable to read image file.");
    }
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    if (!profile?.id) {
      setProfileError("Please log in again to update profile.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const updates = {
      name: String(formData.get("name") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      address: String(formData.get("address") || "").trim(),
      preferredContact: String(formData.get("preferredContact") || "Email"),
      workingDays: String(formData.get("workingDays") || "").trim(),
      workingHours: String(formData.get("workingHours") || "").trim(),
      breakTime: String(formData.get("breakTime") || "").trim(),
      profilePhoto: doctorPhotoPreview || String(profile?.profilePhoto || ""),
    };

    try {
      setIsSavingProfile(true);
      setProfileError("");
      setProfileStatus("");
      const response = await updateUserProfile(profile.id, updates);
      setProfile(response?.user || profile);
      setProfileStatus("Profile updated successfully.");
    } catch (requestError) {
      setProfileError(requestError.message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleConsultationSubmit = async (event) => {
    event.preventDefault();
    if (!selectedConsultation?.id) {
      setConsultErrorMessage("No appointment selected for consultation.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const consultOutcome = String(
      formData.get("consultOutcome") || "Completed"
    );
    const mappedStatus =
      consultOutcome === "Follow-up needed" ? "Confirmed" : consultOutcome;
    const consultationPayload = {
      appointmentId: selectedConsultation.id,
      doctorId: profile?.id || "",
      doctorName: profile?.name || selectedConsultation.doctor || "Doctor",
      ownerName: selectedConsultation.owner || "",
      petName: selectedConsultation.pet || "",
      appointmentDate: selectedConsultation.date || "",
      appointmentTime: selectedConsultation.time || "",
      symptoms: String(formData.get("symptoms") || "").trim(),
      temperature: String(formData.get("temperature") || "").trim(),
      weight: String(formData.get("weight") || "").trim(),
      heartRate: String(formData.get("heartRate") || "").trim(),
      respiratoryRate: String(formData.get("respiratoryRate") || "").trim(),
      clinicalFindings: String(formData.get("clinicalFindings") || "").trim(),
      diagnosis: String(formData.get("diagnosis") || "").trim(),
      prescription: String(formData.get("prescription") || "").trim(),
      followUpDate: String(formData.get("followUpDate") || "").trim(),
      outcome: consultOutcome,
    };

    try {
      setIsSavingConsultation(true);
      setConsultErrorMessage("");
      setConsultStatusMessage("");
      await createConsultation(consultationPayload);
      const response = await updateAppointmentById(selectedConsultation.id, {
        status: mappedStatus,
        auditActorId: String(profile?.id || currentUser?.id || "").trim(),
        auditActorName: String(profile?.name || currentUser?.name || "").trim(),
        auditActorRole: "doctor",
      });
      const updated = response?.appointment;
      if (updated) {
        setAppointments((currentItems) =>
          currentItems.map((item) => (item.id === updated.id ? updated : item))
        );
      }
      setConsultStatusMessage(
        "Consultation notes saved and appointment updated."
      );
    } catch (requestError) {
      setConsultErrorMessage(requestError.message);
    } finally {
      setIsSavingConsultation(false);
    }
  };

  const openConsultationForAppointment = (appointmentId) => {
    setConsultAppointmentId(appointmentId);
    setActivePage("Consultation Details");
  };

  const handleDoctorPasswordSubmit = async (event) => {
    event.preventDefault();
    if (!profile?.id) {
      setPasswordError("Please log in again to change password.");
      return;
    }
    const formData = new FormData(event.currentTarget);
    const currentPassword = String(formData.get("currentPassword") || "");
    const newPassword = String(formData.get("newPassword") || "");

    try {
      setIsChangingPassword(true);
      setPasswordError("");
      setPasswordStatus("");
      await changeUserPassword(profile.id, { currentPassword, newPassword });
      setPasswordStatus("Password updated successfully.");
      event.currentTarget.reset();
    } catch (requestError) {
      setPasswordError(requestError.message);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDoctorNotificationSubmit = async (event) => {
    event.preventDefault();
    if (!profile?.id) {
      setNotificationError(
        "Please log in again to update notification settings."
      );
      return;
    }
    const formData = new FormData(event.currentTarget);
    const notificationPreferences = {
      appointmentRequestAlerts:
        formData.get("appointmentRequestAlerts") === "on",
      paymentConfirmationAlerts:
        formData.get("paymentConfirmationAlerts") === "on",
      doctorScheduleChanges: formData.get("doctorScheduleChanges") === "on",
      weeklyPerformanceSummary:
        formData.get("weeklyPerformanceSummary") === "on",
      appointmentReminders: Boolean(
        profile?.notificationPreferences?.appointmentReminders
      ),
      vaccinationReminders: Boolean(
        profile?.notificationPreferences?.vaccinationReminders
      ),
      medicalRecordUpdates: Boolean(
        profile?.notificationPreferences?.medicalRecordUpdates
      ),
      promotionalUpdates: Boolean(
        profile?.notificationPreferences?.promotionalUpdates
      ),
    };

    try {
      setIsSavingNotifications(true);
      setNotificationError("");
      setNotificationStatus("");
      const response = await updateUserProfile(profile.id, {
        notificationPreferences,
      });
      setProfile(response?.user || profile);
      setNotificationStatus("Notification preferences updated.");
    } catch (requestError) {
      setNotificationError(requestError.message);
    } finally {
      setIsSavingNotifications(false);
    }
  };

  const handleTwoFactorToggle = async (enabled) => {
    if (!profile?.id) {
      setProfileError("Please log in again to update 2FA.");
      return;
    }
    try {
      setProfileError("");
      const response = await updateUserProfile(profile.id, {
        twoFactorEnabled: enabled,
      });
      setProfile(response?.user || profile);
      setProfileStatus(
        enabled
          ? "Two-Factor Authentication enabled."
          : "Two-Factor Authentication disabled."
      );
    } catch (requestError) {
      setProfileError(requestError.message);
    }
  };

  const handleMedicalRecordSubmit = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const petId = String(formData.get("petId") || "").trim();
    const selectedPet = pets.find((item) => item.id === petId);
    if (!selectedPet) {
      setMedicalRecordErrorMessage("Please select a pet first.");
      return;
    }

    const payload = {
      petId: selectedPet.id,
      petName: selectedPet.name,
      ownerName: selectedPet.ownerName || "",
      doctorId: profile?.id || "",
      doctorName: profile?.name || currentUser?.name || "Doctor",
      diagnosis: String(formData.get("diagnosis") || "").trim(),
      prescription: String(formData.get("prescription") || "").trim(),
      vaccine: String(formData.get("vaccine") || "").trim(),
      labResult: String(formData.get("labResult") || "").trim(),
      notes: String(formData.get("notes") || "").trim(),
      recordDate: String(formData.get("recordDate") || "").trim(),
      auditActorId: String(profile?.id || currentUser?.id || "").trim(),
      auditActorName: String(profile?.name || currentUser?.name || "").trim(),
      auditActorRole: "doctor",
    };

    try {
      setIsSavingMedicalRecord(true);
      setMedicalRecordErrorMessage("");
      setMedicalRecordStatusMessage("");
      const response = await createMedicalRecord(payload);
      const created = response?.record;
      if (created) {
        setMedicalRecords((current) => [created, ...current]);
      }
      setMedicalRecordStatusMessage("Medical record saved successfully.");
      event.currentTarget.reset();
    } catch (requestError) {
      setMedicalRecordErrorMessage(requestError.message);
    } finally {
      setIsSavingMedicalRecord(false);
    }
  };

  const handleAddAvailableSlot = async (event) => {
    event.preventDefault();
    const doctorId = String(profile?.id || currentUser?.id || "").trim();
    if (!doctorId) {
      setScheduleErrorMessage("Please log in again to update schedule.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const body = {
      doctorName: profile?.name || currentUser?.name || "",
      date: String(formData.get("date") || "").trim(),
      startTime: String(formData.get("startTime") || "").trim(),
      endTime: String(formData.get("endTime") || "").trim(),
    };

    try {
      setIsSavingSchedule(true);
      setScheduleErrorMessage("");
      setScheduleStatusMessage("");
      const response = await addDoctorAvailableSlot(doctorId, body);
      setDoctorSchedule(response?.schedule || null);
      setScheduleStatusMessage("Available slot added.");
      event.currentTarget.reset();
    } catch (requestError) {
      setScheduleErrorMessage(requestError.message);
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const handleAddBlockedSlot = async (event) => {
    event.preventDefault();
    const doctorId = String(profile?.id || currentUser?.id || "").trim();
    if (!doctorId) {
      setScheduleErrorMessage("Please log in again to update schedule.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const body = {
      doctorName: profile?.name || currentUser?.name || "",
      date: String(formData.get("date") || "").trim(),
      startTime: String(formData.get("startTime") || "").trim(),
      endTime: String(formData.get("endTime") || "").trim(),
      reason: String(formData.get("reason") || "").trim(),
    };

    try {
      setIsSavingSchedule(true);
      setScheduleErrorMessage("");
      setScheduleStatusMessage("");
      const response = await addDoctorBlockedSlot(doctorId, body);
      setDoctorSchedule(response?.schedule || null);
      setScheduleStatusMessage("Busy block added.");
      event.currentTarget.reset();
    } catch (requestError) {
      setScheduleErrorMessage(requestError.message);
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const handleClinicHoursSubmit = async (event) => {
    event.preventDefault();
    const doctorId = String(profile?.id || currentUser?.id || "").trim();
    if (!doctorId) {
      setScheduleErrorMessage("Please log in again to update schedule.");
      return;
    }

    try {
      setIsSavingSchedule(true);
      setScheduleErrorMessage("");
      setScheduleStatusMessage("");
      const response = await updateDoctorClinicHours(doctorId, {
        doctorName: profile?.name || currentUser?.name || "",
        mondayFriday: clinicHours.mondayFriday,
        saturday: clinicHours.saturday,
        sunday: clinicHours.sunday,
      });
      const schedule = response?.schedule || null;
      setDoctorSchedule(schedule);
      setClinicHours({
        mondayFriday:
          schedule?.clinicHours?.mondayFriday || "09:00 AM - 05:00 PM",
        saturday: schedule?.clinicHours?.saturday || "10:00 AM - 02:00 PM",
        sunday: schedule?.clinicHours?.sunday || "Closed",
      });
      setScheduleStatusMessage("Clinic hours updated.");
    } catch (requestError) {
      setScheduleErrorMessage(requestError.message);
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const handleDeleteScheduleSlot = async (slotType, slotId) => {
    const doctorId = String(profile?.id || currentUser?.id || "").trim();
    if (!doctorId) {
      setScheduleErrorMessage("Please log in again to update schedule.");
      return;
    }

    try {
      setIsSavingSchedule(true);
      setScheduleErrorMessage("");
      setScheduleStatusMessage("");
      const response = await deleteDoctorScheduleSlot(
        doctorId,
        slotType,
        slotId
      );
      setDoctorSchedule(response?.schedule || null);
      setScheduleStatusMessage("Schedule updated.");
    } catch (requestError) {
      setScheduleErrorMessage(requestError.message);
    } finally {
      setIsSavingSchedule(false);
    }
  };

  return (
    <main className="dr-screen">
      <section className="dr-shell">
        <aside className="dr-sidebar">
          <img className="dr-mini-logo" src={logo} alt="PawEver logo" />
          <h1>PawEver Doctor</h1>
          <nav aria-label="Doctor navigation">
            {DOCTOR_PAGES.map((page) => (
              <button
                key={page}
                className={`dr-nav-btn${
                  activePage === page ? " is-active" : ""
                }`}
                type="button"
                onClick={() => setActivePage(page)}
              >
                {page}
              </button>
            ))}
          </nav>
          <button className="dr-logout" type="button" onClick={onLogout}>
            Logout
          </button>
        </aside>

        <section className="dr-main">
          <header className="dr-header">
            <h2>{content.title}</h2>
            <p>{content.subtitle}</p>
          </header>

          {activePage === "Doctor Dashboard" ? (
            <div className="dr-grid">
              <article className="dr-card">
                <h3>Today’s Appointments</h3>
                <p className="dr-count">
                  {todayAppointments.length} appointments scheduled
                </p>
                <ul className="dr-list">
                  {todayAppointments.map((item) => (
                    <li key={item.id}>
                      <strong>{item.time || "--:--"}</strong>
                      <span>
                        {item.pet} - {item.owner}
                      </span>
                    </li>
                  ))}
                </ul>
              </article>

              <article className="dr-card">
                <h3>Pending Requests</h3>
                <ul className="dr-list">
                  {PENDING_REQUESTS.map((request) => (
                    <li key={request}>
                      <span>{request}</span>
                    </li>
                  ))}
                </ul>
              </article>

              <article className="dr-card dr-quick-card">
                <h3>Quick Actions</h3>
                <div className="dr-quick-actions">
                  <button
                    type="button"
                    onClick={() => {
                      const nextAppointmentId =
                        todayAppointments[0]?.id ||
                        consultationAppointments[0]?.id ||
                        "";
                      setConsultAppointmentId(nextAppointmentId);
                      setActivePage("Prescriptions and Consultation Page");
                    }}
                  >
                    Start Consultation
                  </button>
                </div>
              </article>
            </div>
          ) : activePage === "Appointments Page" ? (
            <div className="dr-appointments">
              <div className="dr-appointment-tabs">
                {["Today", "Upcoming", "Past"].map((tab) => (
                  <button
                    key={tab}
                    className={`dr-tab-btn${
                      appointmentView === tab ? " is-active" : ""
                    }`}
                    type="button"
                    onClick={() => setAppointmentView(tab)}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="dr-filters">
                <label>
                  Date
                  <input
                    type="date"
                    value={appointmentDate}
                    onChange={(event) => setAppointmentDate(event.target.value)}
                  />
                </label>
                <label>
                  Status
                  <select
                    value={appointmentStatus}
                    onChange={(event) =>
                      setAppointmentStatus(event.target.value)
                    }
                  >
                    <option value="All">All</option>
                    <option value="Pending">Pending</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </label>
              </div>

              <ul className="dr-appointment-list">
                {filteredAppointments.map((item) => (
                  <li key={item.id}>
                    <div>
                      <strong>{formatAppointmentReference(item.id)}</strong>
                      <p className="dr-appointment-id">{item.id}</p>
                      <p>
                        <strong>Date:</strong> {item.date || "-"}
                      </p>
                      <p>
                        <strong>Time:</strong> {item.time || "--:--"}
                      </p>
                      <p>
                        <strong>Pet Name:</strong> {item.pet || "-"}
                      </p>
                      <p>
                        <strong>Pet Owner:</strong> {item.owner || "-"}
                      </p>
                    </div>
                    <span
                      className={`dr-status dr-status-${item.status.toLowerCase()}`}
                    >
                      {item.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => openConsultationForAppointment(item.id)}
                    >
                      Open Details
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : activePage === "Consultation Details" ? (
            <div className="dr-consultation">
              <article className="dr-card">
                <h3>Appointment Details / Consultation</h3>
                {selectedConsultation ? (
                  <>
                    <label className="dr-consult-select">
                      Select Appointment
                      <select
                        value={selectedConsultation.id}
                        onChange={(event) =>
                          setConsultAppointmentId(event.target.value)
                        }
                      >
                        {consultationAppointments.map((item) => (
                          <option key={item.id} value={item.id}>
                            {formatConsultOptionLabel(item)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="dr-info-grid">
                      <p>
                        <strong>Appointment:</strong>{" "}
                        {formatAppointmentReference(selectedConsultation.id)}
                      </p>
                      <p className="dr-appointment-id">
                        <strong>Full ID:</strong> {selectedConsultation.id}
                      </p>
                      <p>
                        <strong>Date:</strong>{" "}
                        {formatConsultDate(selectedConsultation.date)}
                      </p>
                      <p>
                        <strong>Time:</strong>{" "}
                        {selectedConsultation.time || "--:--"}
                      </p>
                      <p>
                        <strong>Status:</strong> {selectedConsultation.status}
                      </p>
                      <p>
                        <strong>Pet Name:</strong> {selectedConsultation.pet}
                      </p>
                      <p>
                        <strong>Owner Name:</strong>{" "}
                        {selectedConsultation.owner}
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="dr-form-error">
                    No appointment available for consultation.
                  </p>
                )}
              </article>

              <article className="dr-card">
                <h3>Consultation Data</h3>
                <ul className="dr-record-list">
                  {consultationMedicalHistory.length ? (
                    consultationMedicalHistory.map((record) => (
                      <li key={record.id}>
                        <p>
                          <strong>Date:</strong> {record.recordDate || "-"} |{" "}
                          <strong>Doctor:</strong> {record.doctorName || "-"}
                        </p>
                        <p>
                          <strong>Symptoms:</strong> {record.notes || "-"}
                        </p>
                        <p>
                          <strong>Diagnosis:</strong> {record.diagnosis || "-"}
                        </p>
                        <p>
                          <strong>Prescription:</strong>{" "}
                          {record.prescription || "-"}
                        </p>
                        <p>
                          <strong>Vaccine:</strong> {record.vaccine || "-"}
                        </p>
                        <p>
                          <strong>Lab Result:</strong> {record.labResult || "-"}
                        </p>
                      </li>
                    ))
                  ) : (
                    <li>
                      <div>
                        <strong>
                          No consultation data for this appointment pet.
                        </strong>
                      </div>
                    </li>
                  )}
                </ul>
              </article>

              <article className="dr-card">
                <h3>Prescription Data</h3>
                <ul className="dr-prescription-list">
                  {consultationPrescriptionHistory.length ? (
                    consultationPrescriptionHistory.map((item) => (
                      <li key={item.id}>
                        <div>
                          <strong>
                            {formatPetReference(item.petId || item.id)} -{" "}
                            {item.petName}
                          </strong>
                          <p className="dr-appointment-id">
                            {item.petId || item.id}
                          </p>
                          <p>
                            {new Date(item.createdAt).toLocaleDateString(
                              "en-US"
                            )}{" "}
                            | {item.medicine}
                          </p>
                          <p>
                            {item.dosage} | {item.duration}
                          </p>
                        </div>
                      </li>
                    ))
                  ) : (
                    <li>
                      <div>
                        <strong>
                          No prescription data for this appointment pet.
                        </strong>
                      </div>
                    </li>
                  )}
                </ul>
              </article>
            </div>
          ) : activePage === "Pet Medical Records Page" ? (
            <div className="dr-records">
              <article className="dr-card">
                <h3>Search Records</h3>
                <p>Search by pet name / owner / ID</p>
                <input
                  className="dr-record-search"
                  type="text"
                  placeholder="Type pet name, owner, or record ID"
                  value={recordSearch}
                  onChange={(event) => setRecordSearch(event.target.value)}
                />
              </article>

              <article className="dr-card">
                <h3>History</h3>
                {!recordSearch.trim() ? (
                  <p>Type in search to see matching history records.</p>
                ) : filteredRecords.length === 0 ? (
                  <p>No matching history found.</p>
                ) : (
                  <ul className="dr-record-list">
                    {filteredRecords.map((record) => (
                      <li key={record.id}>
                        <p>
                          <strong>Date:</strong> {record.recordDate || "-"} |{" "}
                          <strong>Doctor:</strong> {record.doctorName || "-"}
                        </p>
                        <p>
                          <strong>{record.petName}</strong> (
                          {formatPetReference(record.petId || record.id)}) -
                          Owner: {record.ownerName}
                        </p>
                        <p>
                          <strong>Past Diagnoses:</strong> {record.diagnosis}
                        </p>
                        <p>
                          <strong>Prescriptions:</strong> {record.prescription}
                        </p>
                        <p>
                          <strong>Vaccines:</strong> {record.vaccine}
                        </p>
                        <p>
                          <strong>Lab Results:</strong> {record.labResult}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            </div>
          ) : activePage === "Prescriptions and Consultation Page" ? (
            <div className="dr-prescriptions">
              <form
                className="dr-card dr-consult-form"
                onSubmit={handleConsultationSubmit}
                key={`prescription-${selectedConsultation?.id || "none"}`}
              >
                <h3>Consultation Entry</h3>
                <label className="dr-consult-select">
                  Select Appointment
                  <select
                    value={selectedConsultation?.id || ""}
                    onChange={(event) =>
                      setConsultAppointmentId(event.target.value)
                    }
                  >
                    {consultationAppointments.map((item) => (
                      <option key={item.id} value={item.id}>
                        {formatConsultOptionLabel(item)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Prescription / Symptoms / Reason for Visit
                  <textarea
                    name="symptoms"
                    defaultValue={
                      selectedConsultation?.reason ||
                      `${CONSULTATION_CASE.symptoms}\n${CONSULTATION_CASE.reason}`
                    }
                    rows="3"
                  />
                </label>
                <div className="dr-consult-grid">
                  <label>
                    Temperature
                    <input
                      name="temperature"
                      type="text"
                      placeholder="e.g. 101.2 F"
                    />
                  </label>
                  <label>
                    Weight
                    <input name="weight" type="text" placeholder="e.g. 24 kg" />
                  </label>
                  <label>
                    Heart Rate
                    <input
                      name="heartRate"
                      type="text"
                      placeholder="e.g. 88 bpm"
                    />
                  </label>
                  <label>
                    Respiratory Rate
                    <input
                      name="respiratoryRate"
                      type="text"
                      placeholder="e.g. 24 /min"
                    />
                  </label>
                </div>
                <label>
                  Clinical Findings
                  <textarea
                    name="clinicalFindings"
                    placeholder="Enter examination findings..."
                    rows="3"
                  />
                </label>
                <label>
                  Diagnosis
                  <textarea
                    name="diagnosis"
                    placeholder="Enter diagnosis..."
                    rows="3"
                    required
                  />
                </label>
                <label>
                  Prescription
                  <textarea
                    name="prescription"
                    placeholder="Medicine, dosage, and duration..."
                    rows="3"
                    required
                  />
                </label>
                <div className="dr-consult-grid">
                  <label>
                    Follow-up Date
                    <input name="followUpDate" type="date" />
                  </label>
                  <label>
                    Consultation Outcome
                    <select name="consultOutcome" defaultValue="Completed">
                      <option value="Completed">Completed</option>
                      <option value="Follow-up needed">Follow-up needed</option>
                      <option value="Confirmed">Keep Confirmed</option>
                    </select>
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={isSavingConsultation || !selectedConsultation}
                >
                  {isSavingConsultation ? "Saving..." : "Save Consultation"}
                </button>
                {consultStatusMessage ? (
                  <p className="dr-form-success">{consultStatusMessage}</p>
                ) : null}
                {consultErrorMessage ? (
                  <p className="dr-form-error">{consultErrorMessage}</p>
                ) : null}
              </form>

              <article className="dr-card">
                <h3>Prescription History</h3>
                <ul className="dr-prescription-list">
                  {prescriptionHistory.map((item) => (
                    <li key={item.id}>
                      <div>
                        <strong>
                          {formatPetReference(item.petId || item.id)} -{" "}
                          {item.petName}
                        </strong>
                        <p className="dr-appointment-id">
                          {item.petId || item.id}
                        </p>
                        <p>
                          {new Date(item.createdAt).toLocaleDateString("en-US")}{" "}
                          | {item.medicine}
                        </p>
                        <p>
                          {item.dosage} | {item.duration}
                        </p>
                      </div>
                      <div className="dr-prescription-actions">
                        <button type="button" onClick={() => window.print()}>
                          Print
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </article>
            </div>
          ) : activePage === "Doctor Schedule Page" ? (
            <div className="dr-schedule">
              <form className="dr-card" onSubmit={handleAddBlockedSlot}>
                <h3>Busy Time</h3>
                <div className="dr-entry-fields">
                  <input name="date" type="date" required />
                  <input name="startTime" type="time" required />
                  <input name="endTime" type="time" required />
                  <input
                    name="reason"
                    type="text"
                    placeholder="Reason (optional)"
                  />
                </div>
                <button type="submit" disabled={isSavingSchedule}>
                  {isSavingSchedule ? "Saving..." : "Save Busy Time"}
                </button>
                <ul className="dr-simple-list">
                  {(doctorSchedule?.blockedSlots || []).map((slot) => (
                    <li key={slot.id}>
                      <span>
                        {slot.date} | {slot.startTime} - {slot.endTime}
                        {slot.reason ? ` (${slot.reason})` : ""}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleDeleteScheduleSlot("blocked", slot.id)
                        }
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </form>
            </div>
          ) : activePage === "Profile" ? (
            <div className="dr-profile-settings">
              <article className="dr-card dr-profile-summary">
                <div className="dr-profile-avatar" aria-hidden="true">
                  {doctorPhotoPreview || profile?.profilePhoto ? (
                    <img
                      src={doctorPhotoPreview || profile?.profilePhoto}
                      alt="Doctor profile preview"
                    />
                  ) : (
                    profile?.name?.slice(0, 2).toUpperCase() || "DR"
                  )}
                </div>
                <div className="dr-profile-meta">
                  <h3>{profile?.name || "Doctor User"}</h3>
                  <p>{profile?.role || "doctor"}</p>
                  <p>Doctor ID: {formatDoctorReference(profile?.id)}</p>
                  <p className="dr-appointment-id">{profile?.id || "-"}</p>
                </div>
              </article>

              <article className="dr-card">
                <h3>Personal Information</h3>
                <form
                  className="dr-profile-grid"
                  onSubmit={handleProfileSubmit}
                  key={`${profile?.id || "no-id"}-${profile?.name || ""}`}
                >
                  <label>
                    Full Name
                    <input
                      name="name"
                      type="text"
                      defaultValue={profile?.name || ""}
                      required
                    />
                  </label>
                  <label>
                    Profile Photo
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                    />
                  </label>
                  <label>
                    Phone Number
                    <input
                      name="phone"
                      type="tel"
                      defaultValue={profile?.phone || ""}
                    />
                  </label>
                  <label>
                    Email Address
                    <input type="email" value={profile?.email || ""} readOnly />
                  </label>
                  <label className="dr-full">
                    Address
                    <input
                      name="address"
                      type="text"
                      defaultValue={profile?.address || ""}
                    />
                  </label>
                  <label>
                    Preferred Contact
                    <select
                      name="preferredContact"
                      defaultValue={profile?.preferredContact || "Email"}
                    >
                      <option>Email</option>
                      <option>Phone</option>
                      <option>SMS</option>
                    </select>
                  </label>
                  <label>
                    Working Days
                    <input
                      name="workingDays"
                      type="text"
                      defaultValue={profile?.workingDays || "Monday - Saturday"}
                    />
                  </label>
                  <label>
                    Working Hours
                    <input
                      name="workingHours"
                      type="text"
                      defaultValue={
                        profile?.workingHours || "09:00 AM - 05:00 PM"
                      }
                    />
                  </label>
                  <label>
                    Break Time
                    <input
                      name="breakTime"
                      type="text"
                      defaultValue={profile?.breakTime || "12:00 PM - 01:00 PM"}
                    />
                  </label>
                  <button type="submit" disabled={isSavingProfile}>
                    {isSavingProfile ? "Saving..." : "Save Profile"}
                  </button>
                </form>
                {profileStatus ? (
                  <p className="dr-form-success">{profileStatus}</p>
                ) : null}
                {profileError ? (
                  <p className="dr-form-error">{profileError}</p>
                ) : null}
              </article>

              <article className="dr-card">
                <h3>Security & Account</h3>
                <form
                  className="dr-profile-grid"
                  onSubmit={handleDoctorPasswordSubmit}
                >
                  <label>
                    Current Password
                    <input name="currentPassword" type="password" required />
                  </label>
                  <label>
                    New Password
                    <input
                      name="newPassword"
                      type="password"
                      minLength={8}
                      required
                    />
                  </label>
                  <button type="submit" disabled={isChangingPassword}>
                    {isChangingPassword ? "Updating..." : "Change Password"}
                  </button>
                </form>
                {passwordStatus ? (
                  <p className="dr-form-success">{passwordStatus}</p>
                ) : null}
                {passwordError ? (
                  <p className="dr-form-error">{passwordError}</p>
                ) : null}
                <label className="dr-2fa-toggle">
                  <input
                    type="checkbox"
                    checked={Boolean(profile?.twoFactorEnabled)}
                    onChange={(event) =>
                      handleTwoFactorToggle(event.target.checked)
                    }
                  />
                  <span>Enable Two-Factor Authentication (2FA)</span>
                </label>
              </article>
            </div>
          ) : (
            <div className="dr-grid">
              {content.cards.map((card) => (
                <article key={card.title} className="dr-card">
                  <h3>{card.title}</h3>
                  <p>{card.detail}</p>
                  <button type="button">{card.action}</button>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
