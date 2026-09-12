import { useEffect, useState } from "react";
import "../css/dashboard.css";
import {
  addDoctorAvailableSlot,
  addDoctorBlockedSlot,
  changeUserPassword,
  createBillingRecord,
  createAppointment,
  createReportSnapshot,
  createPet,
  deleteDoctorScheduleSlot,
  deletePetById,
  deleteUserById,
  getBillingReceiptById,
  getDoctorSchedule,
  getUserProfile,
  listBillingRecords,
  listReportSnapshots,
  listAppointments,
  listPets,
  listVaccinations,
  createVaccination,
  deleteVaccinationById,
  getReportsAnalytics,
  listUsers,
  recordBillingPaymentById,
  registerUser,
  updateBillingChargesById,
  updateDoctorClinicHours,
  updateAppointmentById,
  updatePetById,
  updateUserProfile,
} from "../../../lib/api";
import { formatAppointmentReference } from "../../../lib/appointmentRef";
import { compressImageFileToDataUrl } from "../../../lib/imageUpload";
import logo from "../../../images/Web_Logo.png";

const STAFF_PAGES = [
  "Dashboard",
  "Appointment Management",
  "Pet Owner Management",
  "Pet Records",
  "Vaccination",
  "Billing & Payments",
  "Profile",
];

const STAFF_CONTENT = {
  Dashboard: {
    subtitle:
      "Track appointments, owner requests, and payment updates in one place.",
    cards: [],
  },
  "Appointment Management": {
    subtitle: "Manage booking queue, reschedules, and cancellations.",
    cards: [
      {
        title: "Upcoming Bookings",
        text: "Review and confirm next appointment slots.",
      },
      {
        title: "Reschedule Requests",
        text: "Handle owner-requested schedule changes.",
      },
      {
        title: "Cancelled Visits",
        text: "Monitor cancelled records and reasons.",
      },
      {
        title: "Doctor Assignment",
        text: "Assign available doctor to open slots.",
      },
    ],
  },
  "Pet Owner Management": {
    subtitle: "Manage owner accounts and pet registration records.",
    cards: [
      { title: "New Owners", text: "Approve new owner account registrations." },
      {
        title: "Owner Profiles",
        text: "Update contact details and account status.",
      },
      { title: "Pet Records", text: "Review linked pet details per owner." },
      {
        title: "Verification",
        text: "Resolve duplicate or incomplete records.",
      },
    ],
  },
  "Pet Records": {
    subtitle: "View and manage registered pet information and records.",
    cards: [
      {
        title: "All Pets",
        text: "Browse all registered pets and owner mapping.",
      },
      {
        title: "Pet Profile Updates",
        text: "Edit breed, age, weight, and vaccine details.",
      },
      {
        title: "Record Validation",
        text: "Resolve duplicate pet records and missing fields.",
      },
      {
        title: "Medical Snapshot",
        text: "Quick view of recent diagnosis and vaccine status.",
      },
    ],
  },
  Vaccination: {
    subtitle: "Record and track pet vaccination details.",
    cards: [
      {
        title: "Vaccination Register",
        text: "Add vaccination entries with due date tracking.",
      },
      {
        title: "Due Follow-up",
        text: "Monitor upcoming next-dose schedule by pet.",
      },
    ],
  },
  "Billing & Payments": {
    subtitle: "Handle invoices, payments, and billing history.",
    cards: [
      {
        title: "Generate Invoice",
        text: "Create invoice after consultation completion.",
      },
      {
        title: "Payment Status",
        text: "Track paid, pending, and overdue payments.",
      },
      { title: "Refund Requests", text: "Review and process refund tickets." },
      { title: "Reports", text: "Export daily and weekly payment reports." },
    ],
  },
  Profile: {
    subtitle: "Manage staff profile and security settings.",
    cards: [
      {
        title: "Edit Profile",
        text: "Update name, phone, and email information.",
      },
      { title: "Change Password", text: "Rotate password for account safety." },
      {
        title: "Notification Settings",
        text: "Choose alerts for appointments and payments.",
      },
      { title: "Access Logs", text: "Review account activity history." },
    ],
  },
};

const STAFF_QUICK_ACTIONS = [
  {
    title: "Add Appointment",
    text: "Create a new scheduled appointment.",
    targetPage: "Appointment Management",
  },
  {
    title: "Register Pet Owner",
    text: "Add a new owner account with contact details.",
    targetPage: "Pet Owner Management",
  },
  {
    title: "Generate Invoice",
    text: "Create bill and move to payment flow.",
    targetPage: "Billing & Payments",
  },
];

function isPetOwnerRole(role) {
  const normalized = String(role || "")
    .trim()
    .toLowerCase();
  return (
    normalized === "pet-owner" ||
    normalized === "petowner" ||
    normalized === "pet owner"
  );
}

function isDoctorRole(role) {
  return (
    String(role || "")
      .trim()
      .toLowerCase() === "doctor"
  );
}

function formatBaht(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "฿0.00";
  }
  return `฿${numeric.toFixed(2)}`;
}

function normalizeIsoDate(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return parsed.toISOString().slice(0, 10);
}

function parseIsoDate(value) {
  const normalized = normalizeIsoDate(value);
  if (!normalized) {
    return null;
  }
  const parsed = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function getDaysUntilDate(value) {
  const target = parseIsoDate(value);
  if (!target) {
    return Number.NaN;
  }
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = target.getTime() - today.getTime();
  return Math.floor(diffMs / 86_400_000);
}

function getVaccinationDueState(nextDueDate) {
  const daysUntil = getDaysUntilDate(nextDueDate);
  if (!Number.isFinite(daysUntil)) {
    return { label: "Unknown", className: "st-history-pending" };
  }
  if (daysUntil < 0) {
    return { label: "Overdue", className: "st-history-cancelled" };
  }
  if (daysUntil <= 14) {
    return { label: "Due Soon", className: "st-history-pending" };
  }
  return { label: "Up to Date", className: "st-history-completed" };
}

function formatUiDate(value) {
  const parsed = parseIsoDate(value);
  if (!parsed) {
    return "-";
  }
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatOwnerReference(ownerId) {
  const rawId = String(ownerId || "").trim();
  if (!rawId) {
    return "OWN-UNKNOWN";
  }
  return `OWN-${rawId.slice(-6).toUpperCase()}`;
}

function formatPetReference(petId) {
  const rawId = String(petId || "").trim();
  if (!rawId) {
    return "PET-UNKNOWN";
  }
  return `PET-${rawId.slice(-6).toUpperCase()}`;
}

function formatEmployeeReference(employeeId) {
  const rawId = String(employeeId || "").trim();
  if (!rawId) {
    return "EMP-UNKNOWN";
  }
  return `EMP-${rawId.slice(-6).toUpperCase()}`;
}

function getLocalIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseTimeToMinutes(value) {
  const text = String(value || "").trim();
  if (!text) {
    return Number.NaN;
  }
  const direct = /^(\d{1,2}):(\d{2})$/.exec(text);
  if (direct) {
    const hour = Number(direct[1]);
    const minute = Number(direct[2]);
    return hour * 60 + minute;
  }
  const amPm = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(text);
  if (amPm) {
    let hour = Number(amPm[1]) % 12;
    const minute = Number(amPm[2]);
    const period = amPm[3].toUpperCase();
    if (period === "PM") {
      hour += 12;
    }
    return hour * 60 + minute;
  }
  return Number.NaN;
}

export default function StaffDashboard({ currentUser, onLogout }) {
  const [activePage, setActivePage] = useState("Dashboard");
  const [filterDate, setFilterDate] = useState("");
  const [filterDoctor, setFilterDoctor] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [appointments, setAppointments] = useState([]);
  const [appointmentError, setAppointmentError] = useState("");
  const [appointmentStatusMessage, setAppointmentStatusMessage] = useState("");
  const [owners, setOwners] = useState([]);
  const [ownerPetCounts, setOwnerPetCounts] = useState({});
  const [isLoadingOwners, setIsLoadingOwners] = useState(false);
  const [ownerError, setOwnerError] = useState("");
  const [ownerStatusMessage, setOwnerStatusMessage] = useState("");
  const [ownerSearch, setOwnerSearch] = useState("");
  const [pets, setPets] = useState([]);
  const [isLoadingPets, setIsLoadingPets] = useState(false);
  const [petRecordError, setPetRecordError] = useState("");
  const [petRecordStatusMessage, setPetRecordStatusMessage] = useState("");
  const [petSearch, setPetSearch] = useState("");
  const [vaccinations, setVaccinations] = useState([]);
  const [vaccinationSearch, setVaccinationSearch] = useState("");
  const [vaccinationError, setVaccinationError] = useState("");
  const [vaccinationStatusMessage, setVaccinationStatusMessage] = useState("");
  const [isLoadingVaccinations, setIsLoadingVaccinations] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [availableDoctorCount, setAvailableDoctorCount] = useState(0);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [doctorSchedule, setDoctorSchedule] = useState(null);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState("");
  const [scheduleStatusMessage, setScheduleStatusMessage] = useState("");
  const [clinicHours, setClinicHours] = useState({
    mondayFriday: "09:00 AM - 05:00 PM",
    saturday: "10:00 AM - 02:00 PM",
    sunday: "Closed",
  });
  const [billingRecords, setBillingRecords] = useState([]);
  const [isLoadingBilling, setIsLoadingBilling] = useState(false);
  const [isSavingBilling, setIsSavingBilling] = useState(false);
  const [billingError, setBillingError] = useState("");
  const [billingStatusMessage, setBillingStatusMessage] = useState("");
  const [selectedBillingId, setSelectedBillingId] = useState("");
  const [reportRange, setReportRange] = useState("this-month");
  const [reportDoctor, setReportDoctor] = useState("All");
  const [reportType, setReportType] = useState("Financial + Operational");
  const [reportFromDate, setReportFromDate] = useState("");
  const [reportToDate, setReportToDate] = useState("");
  const [reportMetrics, setReportMetrics] = useState([]);
  const [reportTrendRows, setReportTrendRows] = useState([]);
  const [reportInsights, setReportInsights] = useState([]);
  const [reportSnapshots, setReportSnapshots] = useState([]);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reportStatusMessage, setReportStatusMessage] = useState("");
  const [profile, setProfile] = useState(currentUser || null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileStatus, setProfileStatus] = useState("");
  const [profileError, setProfileError] = useState("");
  const [isSavingStaffNotifications, setIsSavingStaffNotifications] =
    useState(false);
  const [staffNotificationStatus, setStaffNotificationStatus] = useState("");
  const [staffNotificationError, setStaffNotificationError] = useState("");
  const [isChangingStaffPassword, setIsChangingStaffPassword] = useState(false);
  const [staffPasswordStatus, setStaffPasswordStatus] = useState("");
  const [staffPasswordError, setStaffPasswordError] = useState("");
  const [ownerModalMode, setOwnerModalMode] = useState("");
  const [activeOwner, setActiveOwner] = useState(null);
  const [ownerModalPets, setOwnerModalPets] = useState([]);
  const [isLoadingOwnerModalPets, setIsLoadingOwnerModalPets] = useState(false);
  const [ownerEditForm, setOwnerEditForm] = useState({
    name: "",
    phone: "",
    address: "",
    preferredContact: "Email",
  });
  const [petHistoryModalPet, setPetHistoryModalPet] = useState(null);
  const [petEditModalMode, setPetEditModalMode] = useState("");
  const [petEditModalPet, setPetEditModalPet] = useState(null);
  const [petEditModalValue, setPetEditModalValue] = useState("");
  const [rescheduleModalAppointment, setRescheduleModalAppointment] =
    useState(null);
  const [rescheduleModalDate, setRescheduleModalDate] = useState("");
  const [rescheduleModalTime, setRescheduleModalTime] = useState("");
  const [assignDoctorModalAppointment, setAssignDoctorModalAppointment] =
    useState(null);
  const [assignDoctorModalValue, setAssignDoctorModalValue] = useState("");
  const activeContent = STAFF_CONTENT[activePage] || STAFF_CONTENT.Dashboard;
  const todayDashboardDate = new Date().toISOString().slice(0, 10);
  const todayAppointments = appointments.filter(
    (item) => item.appointmentDate === todayDashboardDate
  );
  const pendingDashboardAppointments = todayAppointments.filter(
    (item) => item.status === "Pending"
  );
  const filteredAppointments = appointments.filter((item) => {
    const dateMatch = !filterDate || item.appointmentDate === filterDate;
    const doctorMatch =
      filterDoctor === "All" || item.doctorName === filterDoctor;
    const statusMatch = filterStatus === "All" || item.status === filterStatus;
    return dateMatch && doctorMatch && statusMatch;
  });
  const doctorFilterOptions = Array.from(
    new Set(doctors.map((doctor) => String(doctor.name || "").trim()))
  )
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const filteredOwners = owners.filter((owner) => {
    const query = ownerSearch.trim().toLowerCase();
    if (!query) {
      return true;
    }
    return (
      owner.name.toLowerCase().includes(query) ||
      owner.email.toLowerCase().includes(query) ||
      owner.id.toLowerCase().includes(query)
    );
  });
  const filteredPets = pets.filter((pet) => {
    const query = petSearch.trim().toLowerCase();
    if (!query) {
      return true;
    }
    return (
      String(pet.name || "")
        .toLowerCase()
        .includes(query) ||
      String(pet.breed || "")
        .toLowerCase()
        .includes(query) ||
      String(pet.ownerName || "")
        .toLowerCase()
        .includes(query) ||
      String(pet.id || "")
        .toLowerCase()
        .includes(query)
    );
  });
  const filteredVaccinations = vaccinations.filter((item) => {
    const query = vaccinationSearch.trim().toLowerCase();
    if (!query) {
      return true;
    }
    return (
      item.vaccineId.toLowerCase().includes(query) ||
      item.petId.toLowerCase().includes(query) ||
      item.vaccineName.toLowerCase().includes(query)
    );
  });
  const sortedVaccinations = [...filteredVaccinations].sort((a, b) =>
    String(a.nextDueDate || "").localeCompare(String(b.nextDueDate || ""))
  );
  const vaccinationStats = vaccinations.reduce(
    (summary, item) => {
      const dueState = getVaccinationDueState(item.nextDueDate).label;
      if (dueState === "Overdue") {
        summary.overdue += 1;
      } else if (dueState === "Due Soon") {
        summary.dueSoon += 1;
      } else if (dueState === "Up to Date") {
        summary.upToDate += 1;
      }
      return summary;
    },
    { overdue: 0, dueSoon: 0, upToDate: 0 }
  );
  const petLookup = pets.reduce((accumulator, pet) => {
    accumulator[String(pet.id || "")] = pet;
    return accumulator;
  }, {});
  const ownerLookup = owners.reduce((accumulator, owner) => {
    accumulator[String(owner.id || "")] = owner;
    return accumulator;
  }, {});
  const linkedVaccinatedPetCount = new Set(
    vaccinations.map((item) => String(item.petId || ""))
  ).size;
  const selectedDoctor =
    doctors.find((doctor) => doctor.id === selectedDoctorId) || null;
  const availableSlots = Array.isArray(doctorSchedule?.availableSlots)
    ? doctorSchedule.availableSlots
    : [];
  const blockedSlots = Array.isArray(doctorSchedule?.blockedSlots)
    ? doctorSchedule.blockedSlots
    : [];
  const emergencySlots = availableSlots.filter(
    (slot) => slot.slotType === "emergency"
  );
  const selectedBillingRecord =
    billingRecords.find((item) => item.id === selectedBillingId) || null;
  const totalCollected = billingRecords
    .reduce((sum, item) => sum + Number(item.amountPaid || 0), 0);
  const totalPending = billingRecords
    .reduce((sum, item) => sum + Number(item.balanceDue || 0), 0);
  const todayCollected = billingRecords
    .filter(
      (item) =>
        Number(item.amountPaid || 0) > 0 &&
        normalizeIsoDate(item.paymentDate) === todayDashboardDate
    )
    .reduce((sum, item) => sum + Number(item.amountPaid || 0), 0);
  const dashboardMetrics = [
    {
      title: "Today’s Total Appointments",
      value: String(todayAppointments.length),
      note: "Scheduled today",
    },
    {
      title: "Pending Appointment Requests",
      value: String(pendingDashboardAppointments.length),
      note: "Awaiting confirmation",
    },
    {
      title: "Total Doctors Available",
      value: String(availableDoctorCount),
      note: "Available right now",
    },
    {
      title: "Payment Summary (Today)",
      value: formatBaht(todayCollected),
      note: "Collected payments",
    },
  ];
  const billingSummary = [
    { title: "Invoices Total", value: String(billingRecords.length) },
    { title: "Collected", value: formatBaht(totalCollected) },
    { title: "Unpaid Balance", value: formatBaht(totalPending) },
  ];
  useEffect(() => {
    let cancelled = false;

    const loadAppointments = async () => {
      try {
        const response = await listAppointments();
        if (!cancelled) {
          setAppointments(
            Array.isArray(response?.appointments) ? response.appointments : []
          );
        }
      } catch (requestError) {
        if (!cancelled) {
          setAppointments([]);
          setAppointmentError(requestError.message);
        }
      }
    };

    loadAppointments();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadVaccinationData = async () => {
    const response = await listVaccinations();
    const items = Array.isArray(response?.vaccinations)
      ? response.vaccinations
      : [];
    return items.map((item) => ({
      id: String(item.id || ""),
      vaccineId: String(item.vaccineId || ""),
      petId: String(item.petId || ""),
      vaccineName: String(item.vaccineName || ""),
      dateGiven: normalizeIsoDate(item.dateGiven),
      nextDueDate: normalizeIsoDate(item.nextDueDate),
    }));
  };

  useEffect(() => {
    let cancelled = false;

    const loadVaccinationsData = async () => {
      try {
        setIsLoadingVaccinations(true);
        setVaccinationError("");
        const items = await loadVaccinationData();
        if (!cancelled) {
          setVaccinations(items);
        }
      } catch (requestError) {
        if (!cancelled) {
          setVaccinations([]);
          setVaccinationError(requestError.message);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingVaccinations(false);
        }
      }
    };

    loadVaccinationsData();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadBillingData = async () => {
    const response = await listBillingRecords();
    const records = Array.isArray(response?.records) ? response.records : [];
    return records;
  };

  const loadReportsData = async (overrides = {}) => {
    const query = {
      range: overrides.range ?? reportRange,
      doctorName: overrides.doctorName ?? reportDoctor,
      reportType: overrides.reportType ?? reportType,
      fromDate: overrides.fromDate ?? reportFromDate,
      toDate: overrides.toDate ?? reportToDate,
    };
    const response = await getReportsAnalytics(query);
    return response?.report || null;
  };

  const loadReportSnapshotsData = async () => {
    const response = await listReportSnapshots();
    return Array.isArray(response?.snapshots) ? response.snapshots : [];
  };

  useEffect(() => {
    let cancelled = false;

    const loadBilling = async () => {
      try {
        setIsLoadingBilling(true);
        setBillingError("");
        const records = await loadBillingData();
        if (!cancelled) {
          setBillingRecords(records);
          setSelectedBillingId((current) =>
            current && records.some((item) => item.id === current)
              ? current
              : records[0]?.id || ""
          );
        }
      } catch (requestError) {
        if (!cancelled) {
          setBillingRecords([]);
          setSelectedBillingId("");
          setBillingError(requestError.message);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingBilling(false);
        }
      }
    };

    loadBilling();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadReports = async () => {
      try {
        setIsLoadingReports(true);
        setReportError("");
        const [report, snapshots] = await Promise.all([
          loadReportsData(),
          loadReportSnapshotsData(),
        ]);
        if (!cancelled) {
          setReportMetrics(
            Array.isArray(report?.metrics) ? report.metrics : []
          );
          setReportTrendRows(
            Array.isArray(report?.trendRows) ? report.trendRows : []
          );
          setReportInsights(
            Array.isArray(report?.insights) ? report.insights : []
          );
          setReportSnapshots(snapshots);
        }
      } catch (requestError) {
        if (!cancelled) {
          setReportMetrics([]);
          setReportTrendRows([]);
          setReportInsights([]);
          setReportSnapshots([]);
          setReportError(requestError.message);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingReports(false);
        }
      }
    };

    loadReports();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadDoctors = async () => {
      try {
        setScheduleError("");
        const doctorList = await loadDoctorDirectory();
        if (!cancelled) {
          setDoctors(doctorList);
          setSelectedDoctorId((current) =>
            current && doctorList.some((item) => item.id === current)
              ? current
              : doctorList[0]?.id || ""
          );
        }
      } catch (requestError) {
        if (!cancelled) {
          setDoctors([]);
          setSelectedDoctorId("");
          setScheduleError(requestError.message);
        }
      }
    };

    loadDoctors();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadSchedule = async () => {
      if (!selectedDoctor) {
        setDoctorSchedule(null);
        return;
      }
      try {
        setIsLoadingSchedule(true);
        setScheduleError("");
        const schedule = await loadDoctorScheduleData(selectedDoctor);
        if (!cancelled) {
          setDoctorSchedule(schedule);
          setClinicHours({
            mondayFriday:
              schedule?.clinicHours?.mondayFriday || "09:00 AM - 05:00 PM",
            saturday: schedule?.clinicHours?.saturday || "10:00 AM - 02:00 PM",
            sunday: schedule?.clinicHours?.sunday || "Closed",
          });
        }
      } catch (requestError) {
        if (!cancelled) {
          setDoctorSchedule(null);
          setScheduleError(requestError.message);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSchedule(false);
        }
      }
    };

    loadSchedule();
    return () => {
      cancelled = true;
    };
  }, [selectedDoctorId, selectedDoctor?.id, selectedDoctor?.name]);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        await refreshDoctorAvailabilityCount();
      } catch (_error) {
        if (!cancelled) {
          setAvailableDoctorCount(doctors.length);
        }
      }
    };

    void refresh();
    const intervalId = window.setInterval(() => {
      void refresh();
    }, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [doctors]);

  const loadPetRecordsData = async () => {
    const response = await listPets();
    const allPets = Array.isArray(response?.pets) ? response.pets : [];
    return allPets.map((pet) => ({
      id: pet.id,
      ownerId: String(pet.ownerId || ""),
      ownerName: String(pet.ownerName || ""),
      name: String(pet.name || ""),
      breed: String(pet.breed || ""),
      age: String(pet.age || ""),
      weight: String(pet.weight || ""),
      vaccinationStatus: String(pet.vaccinationStatus || ""),
    }));
  };

  useEffect(() => {
    let cancelled = false;

    const loadPetsData = async () => {
      try {
        setIsLoadingPets(true);
        setPetRecordError("");
        const items = await loadPetRecordsData();
        if (!cancelled) {
          setPets(items);
        }
      } catch (requestError) {
        if (!cancelled) {
          setPets([]);
          setPetRecordError(requestError.message);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPets(false);
        }
      }
    };

    loadPetsData();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadOwnerManagementData = async () => {
    const [userResponse, petResponse] = await Promise.all([
      listUsers(),
      listPets(),
    ]);
    const allUsers = Array.isArray(userResponse?.users)
      ? userResponse.users
      : [];
    const ownerUsers = allUsers.filter((user) => isPetOwnerRole(user.role));
    const pets = Array.isArray(petResponse?.pets) ? petResponse.pets : [];
    const petCounts = {};
    pets.forEach((pet) => {
      const key = String(pet.ownerId || "").trim();
      if (!key) {
        return;
      }
      petCounts[key] = (petCounts[key] || 0) + 1;
    });

    return {
      owners: ownerUsers.map((owner) => ({
        id: owner.id,
        name: String(owner.name || ""),
        email: String(owner.email || ""),
        role: String(owner.role || ""),
        phone: String(owner.phone || ""),
        address: String(owner.address || ""),
        preferredContact: String(owner.preferredContact || "Email"),
      })),
      petCounts,
    };
  };

  const loadDoctorDirectory = async () => {
    const response = await listUsers({ role: "doctor" });
    const users = Array.isArray(response?.users) ? response.users : [];
    return users
      .filter((user) => isDoctorRole(user.role))
      .map((user) => ({
        id: String(user.id || ""),
        name: String(user.name || ""),
        email: String(user.email || ""),
      }));
  };

  const loadDoctorScheduleData = async (doctor) => {
    if (!doctor?.id) {
      return null;
    }
    const response = await getDoctorSchedule(
      doctor.id,
      doctor.name ? { doctorName: doctor.name } : {}
    );
    return response?.schedule || null;
  };

  const toDateInputValue = (value) => {
    const date = value instanceof Date ? value : new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(date.getDate()).padStart(2, "0")}`;
  };

  const toTimeInputValue = (value) => {
    const date = value instanceof Date ? value : new Date();
    return `${String(date.getHours()).padStart(2, "0")}:${String(
      date.getMinutes()
    ).padStart(2, "0")}`;
  };

  const refreshDoctorAvailabilityCount = async () => {
    if (!doctors.length) {
      setAvailableDoctorCount(0);
      return;
    }

    const now = new Date();
    const today = getLocalIsoDate(now);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const schedules = await Promise.all(
      doctors.map(async (doctor) => {
        try {
          return await loadDoctorScheduleData(doctor);
        } catch (_error) {
          return null;
        }
      })
    );

    const availableCount = doctors.reduce((count, _doctor, index) => {
      const blockedSlots = Array.isArray(schedules[index]?.blockedSlots)
        ? schedules[index].blockedSlots
        : [];
      const isBlockedNow = blockedSlots.some((slot) => {
        const slotDate = normalizeIsoDate(slot.date);
        if (slotDate !== today) {
          return false;
        }
        const start = parseTimeToMinutes(slot.startTime);
        const end = parseTimeToMinutes(slot.endTime);
        if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
          return false;
        }
        return nowMinutes >= start && nowMinutes < end;
      });
      return isBlockedNow ? count : count + 1;
    }, 0);

    setAvailableDoctorCount(availableCount);
  };

  useEffect(() => {
    let cancelled = false;

    const loadOwners = async () => {
      try {
        setIsLoadingOwners(true);
        setOwnerError("");
        const data = await loadOwnerManagementData();
        if (!cancelled) {
          setOwners(data.owners);
          setOwnerPetCounts(data.petCounts);
        }
      } catch (requestError) {
        if (!cancelled) {
          setOwners([]);
          setOwnerPetCounts({});
          setOwnerError(requestError.message);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingOwners(false);
        }
      }
    };

    loadOwners();
    return () => {
      cancelled = true;
    };
  }, []);

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
      } catch (_error) {
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

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    if (!profile?.id) {
      setProfileError("Please log in again to update profile.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    let profilePhoto = String(profile?.profilePhoto || "");
    const photoFile = formData.get("profilePhoto");
    if (photoFile instanceof File && photoFile.size > 0) {
      profilePhoto = await compressImageFileToDataUrl(photoFile);
    }
    const updates = {
      name: String(formData.get("name") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      address: String(formData.get("address") || "").trim(),
      preferredContact: String(formData.get("preferredContact") || "Email"),
      profilePhoto,
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

  const handleAppointmentUpdate = async (appointmentId, updates) => {
    try {
      setAppointmentError("");
      setAppointmentStatusMessage("");
      const response = await updateAppointmentById(appointmentId, {
        ...updates,
        auditActorId: String(profile?.id || currentUser?.id || "").trim(),
        auditActorName: String(profile?.name || currentUser?.name || "").trim(),
        auditActorRole: "staff",
      });
      const updated = response?.appointment;
      if (updated) {
        setAppointments((currentItems) =>
          currentItems.map((item) => (item.id === updated.id ? updated : item))
        );
      }
      setAppointmentStatusMessage("Appointment updated successfully.");
    } catch (requestError) {
      setAppointmentError(requestError.message);
    }
  };

  const openRescheduleModal = (appointment) => {
    setRescheduleModalAppointment(appointment);
    setRescheduleModalDate(String(appointment.appointmentDate || ""));
    setRescheduleModalTime(String(appointment.appointmentTime || ""));
  };

  const closeRescheduleModal = () => {
    setRescheduleModalAppointment(null);
    setRescheduleModalDate("");
    setRescheduleModalTime("");
  };

  const handleRescheduleAppointment = async (event) => {
    event.preventDefault();
    if (!rescheduleModalAppointment?.id) {
      return;
    }
    const newDate = String(rescheduleModalDate || "").trim();
    const newTime = String(rescheduleModalTime || "").trim();
    if (!newDate || !newTime) {
      setAppointmentError("Date and time are required.");
      return;
    }

    await handleAppointmentUpdate(rescheduleModalAppointment.id, {
      appointmentDate: newDate,
      appointmentTime: newTime,
      status: "Pending",
    });
    closeRescheduleModal();
  };

  const openAssignDoctorModal = (appointment) => {
    setAssignDoctorModalAppointment(appointment);
    setAssignDoctorModalValue(
      String(appointment.doctorName || doctors[0]?.name || "")
    );
  };

  const closeAssignDoctorModal = () => {
    setAssignDoctorModalAppointment(null);
    setAssignDoctorModalValue("");
  };

  const handleAssignDoctorSubmit = async (event) => {
    event.preventDefault();
    if (!assignDoctorModalAppointment?.id) {
      return;
    }
    const selectedDoctorName = String(assignDoctorModalValue || "").trim();
    if (!selectedDoctorName) {
      setAppointmentError("Please select a doctor.");
      return;
    }

    await handleAppointmentUpdate(assignDoctorModalAppointment.id, {
      doctorName: selectedDoctorName,
    });
    closeAssignDoctorModal();
  };

  const handleRegisterOwner = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const address = String(formData.get("address") || "").trim();
    const preferredContact = String(
      formData.get("preferredContact") || "Email"
    );

    try {
      setOwnerError("");
      setOwnerStatusMessage("");
      const registerResponse = await registerUser({
        name,
        email,
        password,
        role: "pet-owner",
      });
      const createdUser = registerResponse?.user;
      if (createdUser?.id) {
        await updateUserProfile(createdUser.id, {
          name,
          phone,
          address,
          preferredContact,
        });
      }
      const data = await loadOwnerManagementData();
      setOwners(data.owners);
      setOwnerPetCounts(data.petCounts);
      setOwnerStatusMessage("Pet owner registered successfully.");
      event.currentTarget.reset();
    } catch (requestError) {
      const message = String(requestError?.message || "Request failed.");
      if (message.toLowerCase().includes("route not found")) {
        setOwnerError(
          "Remove endpoint not loaded on backend. Please restart backend server and try again."
        );
      } else {
        setOwnerError(message);
      }
    }
  };

  const handleEditOwner = async (owner) => {
    setOwnerError("");
    setOwnerModalPets([]);
    setActiveOwner(owner);
    setOwnerEditForm({
      name: String(owner.name || ""),
      phone: String(owner.phone || ""),
      address: String(owner.address || ""),
      preferredContact: String(owner.preferredContact || "Email"),
    });
    setOwnerModalMode("edit");
  };

  const handleViewOwnerProfile = (owner) => {
    setOwnerError("");
    setOwnerModalPets([]);
    setActiveOwner(owner);
    setOwnerModalMode("profile");
  };

  const handleViewOwnerPets = async (owner) => {
    setOwnerError("");
    setOwnerModalPets([]);
    setActiveOwner(owner);
    setOwnerModalMode("pets");
    setIsLoadingOwnerModalPets(true);
    try {
      const response = await listPets({ userId: owner.id });
      const ownerPets = Array.isArray(response?.pets) ? response.pets : [];
      setOwnerModalPets(ownerPets);
    } catch (requestError) {
      setOwnerError(requestError.message);
    } finally {
      setIsLoadingOwnerModalPets(false);
    }
  };

  const handleRemoveOwner = async (owner) => {
    if (!owner?.id) {
      return;
    }

    try {
      setOwnerError("");
      setOwnerStatusMessage("");
      await deleteUserById(owner.id);
      const data = await loadOwnerManagementData();
      setOwners(data.owners);
      setOwnerPetCounts(data.petCounts);
      setPets((current) =>
        current.filter((pet) => String(pet.ownerId || "") !== owner.id)
      );
      if (activeOwner?.id === owner.id) {
        closeOwnerModal();
      }
      setOwnerStatusMessage("Pet owner removed successfully.");
    } catch (requestError) {
      setOwnerError(requestError.message);
    }
  };

  const closeOwnerModal = () => {
    setOwnerModalMode("");
    setActiveOwner(null);
    setOwnerModalPets([]);
    setIsLoadingOwnerModalPets(false);
  };

  const handleOwnerEditFieldChange = (event) => {
    const { name, value } = event.currentTarget;
    setOwnerEditForm((current) => ({ ...current, [name]: value }));
  };

  const handleOwnerEditSubmit = async (event) => {
    event.preventDefault();
    if (!activeOwner?.id) {
      return;
    }

    try {
      setOwnerError("");
      setOwnerStatusMessage("");
      const response = await updateUserProfile(activeOwner.id, {
        name: String(ownerEditForm.name || "").trim(),
        phone: String(ownerEditForm.phone || "").trim(),
        address: String(ownerEditForm.address || "").trim(),
        preferredContact:
          String(ownerEditForm.preferredContact || "Email").trim() || "Email",
      });
      const updated = response?.user;
      if (updated) {
        setOwners((current) =>
          current.map((item) =>
            item.id === updated.id
              ? {
                  ...item,
                  name: updated.name || "",
                  phone: updated.phone || "",
                  address: updated.address || "",
                  preferredContact: updated.preferredContact || "Email",
                }
              : item
          )
        );
      }
      setOwnerStatusMessage("Owner details updated.");
      closeOwnerModal();
    } catch (requestError) {
      setOwnerError(requestError.message);
    }
  };

  const refreshOwnersAndPets = async () => {
    const [ownerData, petData] = await Promise.all([
      loadOwnerManagementData(),
      loadPetRecordsData(),
    ]);
    setOwners(ownerData.owners);
    setOwnerPetCounts(ownerData.petCounts);
    setPets(petData);
  };

  const handleCreatePetRecord = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const ownerId = String(formData.get("ownerId") || "").trim();
    const selectedOwner = owners.find((owner) => owner.id === ownerId);
    const payload = {
      ownerId,
      ownerName: selectedOwner?.name || "",
      name: String(formData.get("name") || "").trim(),
      breed: String(formData.get("breed") || "").trim(),
      age: String(formData.get("age") || "").trim(),
      weight: String(formData.get("weight") || "").trim(),
      vaccinationStatus: String(formData.get("vaccinationStatus") || "").trim(),
    };

    try {
      setPetRecordError("");
      setPetRecordStatusMessage("");
      await createPet(payload);
      await refreshOwnersAndPets();
      setPetRecordStatusMessage("Pet added to pet_data successfully.");
      event.currentTarget.reset();
    } catch (requestError) {
      setPetRecordError(requestError.message);
    }
  };

  const openPetWeightModal = (pet) => {
    setPetEditModalPet(pet);
    setPetEditModalMode("weight");
    setPetEditModalValue(String(pet.weight || ""));
  };

  const openPetVaccinationModal = (pet) => {
    setPetEditModalPet(pet);
    setPetEditModalMode("vaccination");
    setPetEditModalValue(String(pet.vaccinationStatus || ""));
  };

  const closePetEditModal = () => {
    setPetEditModalMode("");
    setPetEditModalPet(null);
    setPetEditModalValue("");
  };

  const handlePetEditSubmit = async (event) => {
    event.preventDefault();
    if (!petEditModalPet?.id || !petEditModalMode) {
      return;
    }
    const cleanedValue = String(petEditModalValue || "").trim();
    if (!cleanedValue) {
      setPetRecordError(
        petEditModalMode === "weight"
          ? "Weight is required."
          : "Vaccination date/status is required."
      );
      return;
    }

    const payload =
      petEditModalMode === "weight"
        ? { weight: cleanedValue }
        : { vaccinationStatus: cleanedValue };

    try {
      setPetRecordError("");
      setPetRecordStatusMessage("");
      const response = await updatePetById(petEditModalPet.id, {
        ...payload,
        auditActorId: String(profile?.id || currentUser?.id || "").trim(),
        auditActorName: String(profile?.name || currentUser?.name || "").trim(),
        auditActorRole: "staff",
      });
      const updated = response?.pet;
      if (updated) {
        setPets((current) =>
          current.map((item) =>
            item.id === updated.id ? { ...item, ...updated } : item
          )
        );
      }
      setPetRecordStatusMessage(
        petEditModalMode === "weight"
          ? "Pet weight updated."
          : "Vaccination status updated."
      );
      closePetEditModal();
    } catch (requestError) {
      setPetRecordError(requestError.message);
    }
  };

  const handleDeletePetRecord = async (pet) => {
    const confirmed = window.confirm(
      `Delete ${pet.name}? This will remove the pet from pet_data.`
    );
    if (!confirmed) {
      return;
    }
    try {
      setPetRecordError("");
      setPetRecordStatusMessage("");
      await deletePetById(pet.id);
      await refreshOwnersAndPets();
      setPetRecordStatusMessage("Pet deleted from pet_data.");
    } catch (requestError) {
      setPetRecordError(requestError.message);
    }
  };

  const handleViewPetHistory = (pet) => {
    setPetHistoryModalPet(pet);
  };

  const handleCreateVaccinationRecord = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const vaccineId = String(formData.get("vaccineId") || "").trim();
    const petId = String(formData.get("petId") || "").trim();
    const vaccineName = String(formData.get("vaccineName") || "").trim();
    const dateGiven = normalizeIsoDate(formData.get("dateGiven"));
    const nextDueDate = normalizeIsoDate(formData.get("nextDueDate"));
    const selectedPet = petLookup[petId];

    if (!vaccineId || !petId || !vaccineName || !dateGiven || !nextDueDate) {
      setVaccinationError("All vaccination fields are required.");
      setVaccinationStatusMessage("");
      return;
    }
    if (!selectedPet) {
      setVaccinationError("Please select a valid pet from pet records.");
      setVaccinationStatusMessage("");
      return;
    }
    if (nextDueDate < dateGiven) {
      setVaccinationError("Next due date must be on or after date given.");
      setVaccinationStatusMessage("");
      return;
    }

    const exists = vaccinations.some(
      (item) => item.vaccineId.toLowerCase() === vaccineId.toLowerCase()
    );
    if (exists) {
      setVaccinationError("Vaccine ID already exists.");
      setVaccinationStatusMessage("");
      return;
    }

    try {
      setVaccinationError("");
      setVaccinationStatusMessage("");
      const response = await createVaccination({
        vaccineId,
        petId,
        vaccineName,
        dateGiven,
        nextDueDate,
      });
      const created = response?.vaccination;
      if (created?.id) {
        setVaccinations((current) => [
          {
            id: String(created.id || ""),
            vaccineId: String(created.vaccineId || vaccineId),
            petId: String(created.petId || petId),
            vaccineName: String(created.vaccineName || vaccineName),
            dateGiven: normalizeIsoDate(created.dateGiven || dateGiven),
            nextDueDate: normalizeIsoDate(created.nextDueDate || nextDueDate),
          },
          ...current,
        ]);
      } else {
        const items = await loadVaccinationData();
        setVaccinations(items);
      }
      try {
        await updatePetById(selectedPet.id, {
          vaccinationStatus: `${vaccineName} | Given: ${dateGiven} | Next due: ${nextDueDate}`,
          auditActorId: String(profile?.id || currentUser?.id || "").trim(),
          auditActorName: String(profile?.name || currentUser?.name || "").trim(),
          auditActorRole: "staff",
        });
      } catch (_syncError) {
      }
      setVaccinationStatusMessage("Vaccination record added.");
      event.currentTarget.reset();
    } catch (requestError) {
      setVaccinationError(requestError.message);
    }
  };

  const handleDeleteVaccinationRecord = async (item) => {
    if (!item?.id) {
      setVaccinationError("Vaccination record ID is missing.");
      return;
    }
    const confirmed = window.confirm(
      `Delete vaccination record ${item.vaccineId}? This action cannot be undone.`
    );
    if (!confirmed) {
      return;
    }
    try {
      setVaccinationError("");
      setVaccinationStatusMessage("");
      await deleteVaccinationById(item.id);
      setVaccinations((current) => current.filter((row) => row.id !== item.id));
      setVaccinationStatusMessage("Vaccination record deleted.");
    } catch (requestError) {
      setVaccinationError(requestError.message);
    }
  };

  const handleStaffNotificationSubmit = async (event) => {
    event.preventDefault();
    if (!profile?.id) {
      setStaffNotificationError(
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
      setIsSavingStaffNotifications(true);
      setStaffNotificationError("");
      setStaffNotificationStatus("");
      const response = await updateUserProfile(profile.id, {
        notificationPreferences,
      });
      setProfile(response?.user || profile);
      setStaffNotificationStatus("Notification preferences updated.");
    } catch (requestError) {
      setStaffNotificationError(requestError.message);
    } finally {
      setIsSavingStaffNotifications(false);
    }
  };

  const handleStaffPasswordSubmit = async (event) => {
    event.preventDefault();
    if (!profile?.id) {
      setStaffPasswordError("Please log in again to change password.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const currentPassword = String(formData.get("currentPassword") || "");
    const newPassword = String(formData.get("newPassword") || "");

    try {
      setIsChangingStaffPassword(true);
      setStaffPasswordError("");
      setStaffPasswordStatus("");
      await changeUserPassword(profile.id, { currentPassword, newPassword });
      setStaffPasswordStatus("Password updated successfully.");
      event.currentTarget.reset();
    } catch (requestError) {
      setStaffPasswordError(requestError.message);
    } finally {
      setIsChangingStaffPassword(false);
    }
  };

  const handleStaffTwoFactorToggle = async (enabled) => {
    if (!profile?.id) {
      setProfileError("Please log in again to update 2FA.");
      return;
    }
    try {
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

  const handleBlockUnavailableTime = async (event) => {
    event.preventDefault();
    if (!selectedDoctor) {
      setScheduleError("Select a doctor first.");
      return;
    }
    const formData = new FormData(event.currentTarget);
    const body = {
      doctorName: selectedDoctor.name,
      date: String(formData.get("date") || "").trim(),
      startTime: String(formData.get("startTime") || "").trim(),
      endTime: String(formData.get("endTime") || "").trim(),
      reason: String(formData.get("reason") || "").trim() || "Busy",
    };
    try {
      setIsSavingSchedule(true);
      setScheduleError("");
      setScheduleStatusMessage("");
      const response = await addDoctorBlockedSlot(selectedDoctor.id, body);
      const schedule = response?.schedule || null;
      setDoctorSchedule(schedule);
      await refreshDoctorAvailabilityCount();
      setScheduleStatusMessage("Unavailable time blocked.");
      event.currentTarget.reset();
    } catch (requestError) {
      setScheduleError(requestError.message);
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const handleAssignEmergencySlot = async (event) => {
    event.preventDefault();
    if (!selectedDoctor) {
      setScheduleError("Select a doctor first.");
      return;
    }
    const formData = new FormData(event.currentTarget);
    const body = {
      doctorName: selectedDoctor.name,
      date: String(formData.get("date") || "").trim(),
      startTime: String(formData.get("startTime") || "").trim(),
      endTime: String(formData.get("endTime") || "").trim(),
      slotType: "emergency",
    };
    try {
      setIsSavingSchedule(true);
      setScheduleError("");
      setScheduleStatusMessage("");
      const response = await addDoctorAvailableSlot(selectedDoctor.id, body);
      setDoctorSchedule(response?.schedule || null);
      setScheduleStatusMessage("Emergency slot assigned.");
      event.currentTarget.reset();
    } catch (requestError) {
      setScheduleError(requestError.message);
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const handleSaveClinicHours = async (event) => {
    event.preventDefault();
    if (!selectedDoctor) {
      setScheduleError("Select a doctor first.");
      return;
    }
    try {
      setIsSavingSchedule(true);
      setScheduleError("");
      setScheduleStatusMessage("");
      const response = await updateDoctorClinicHours(selectedDoctor.id, {
        doctorName: selectedDoctor.name,
        mondayFriday: clinicHours.mondayFriday,
        saturday: clinicHours.saturday,
        sunday: clinicHours.sunday,
      });
      setDoctorSchedule(response?.schedule || null);
      await refreshDoctorAvailabilityCount();
      setScheduleStatusMessage("Clinic hours updated.");
    } catch (requestError) {
      setScheduleError(requestError.message);
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const handleRemoveScheduleSlot = async (slotType, slotId) => {
    if (!selectedDoctor) {
      return;
    }
    try {
      setIsSavingSchedule(true);
      setScheduleError("");
      setScheduleStatusMessage("");
      const response = await deleteDoctorScheduleSlot(
        selectedDoctor.id,
        slotType,
        slotId
      );
      setDoctorSchedule(response?.schedule || null);
      await refreshDoctorAvailabilityCount();
      setScheduleStatusMessage("Slot removed.");
    } catch (requestError) {
      setScheduleError(requestError.message);
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const handleGenerateInvoice = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = {
      invoiceId: String(formData.get("invoiceId") || "").trim(),
      appointmentId: String(formData.get("appointmentId") || "").trim(),
      ownerName: String(formData.get("ownerName") || "").trim(),
      petName: String(formData.get("petName") || "").trim(),
      doctorName: String(formData.get("doctorName") || "").trim(),
    };

    try {
      setIsSavingBilling(true);
      setBillingError("");
      setBillingStatusMessage("");
      const response = await createBillingRecord(payload);
      const created = response?.record;
      if (created) {
        setBillingRecords((current) => [created, ...current]);
        setSelectedBillingId(created.id);
      }
      setBillingStatusMessage("Invoice generated successfully.");
      event.currentTarget.reset();
    } catch (requestError) {
      setBillingError(requestError.message);
    } finally {
      setIsSavingBilling(false);
    }
  };

  const handleSaveCharges = async (event) => {
    event.preventDefault();
    if (!selectedBillingRecord?.id) {
      setBillingError("Select an invoice first.");
      return;
    }
    const formData = new FormData(event.currentTarget);
    const payload = {
      consultationFee: Number(formData.get("consultationFee") || 0),
      serviceCharges: Number(formData.get("serviceCharges") || 0),
      medicineCharges: Number(formData.get("medicineCharges") || 0),
      labCharges: Number(formData.get("labCharges") || 0),
      taxAmount: Number(formData.get("taxAmount") || 0),
      discountAmount: Number(formData.get("discountAmount") || 0),
    };

    try {
      setIsSavingBilling(true);
      setBillingError("");
      setBillingStatusMessage("");
      const response = await updateBillingChargesById(
        selectedBillingRecord.id,
        payload
      );
      const updated = response?.record;
      if (updated) {
        setBillingRecords((current) =>
          current.map((item) => (item.id === updated.id ? updated : item))
        );
      }
      setBillingStatusMessage("Charges saved.");
    } catch (requestError) {
      setBillingError(requestError.message);
    } finally {
      setIsSavingBilling(false);
    }
  };

  const handleRecordPayment = async (event) => {
    event.preventDefault();
    if (!selectedBillingRecord?.id) {
      setBillingError("Select an invoice first.");
      return;
    }
    const formData = new FormData(event.currentTarget);
    const payload = {
      paymentMethod: String(formData.get("paymentMethod") || "").trim(),
      paymentDate: String(formData.get("paymentDate") || "").trim(),
      referenceNumber: String(formData.get("referenceNumber") || "").trim(),
      paymentAmount: Number(formData.get("paymentAmount") || 0),
      paymentStatus: String(formData.get("paymentStatus") || "").trim(),
    };

    try {
      setIsSavingBilling(true);
      setBillingError("");
      setBillingStatusMessage("");
      const response = await recordBillingPaymentById(
        selectedBillingRecord.id,
        payload
      );
      const updated = response?.record;
      if (updated) {
        setBillingRecords((current) =>
          current.map((item) => (item.id === updated.id ? updated : item))
        );
      }
      setBillingStatusMessage("Payment recorded.");
    } catch (requestError) {
      setBillingError(requestError.message);
    } finally {
      setIsSavingBilling(false);
    }
  };

  const escapeHtml = (value) =>
    String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const buildReceiptHtml = (receipt) => {
    const consultationFee = Number(receipt.consultationFee || 0);
    const serviceCharges = Number(receipt.serviceCharges || 0);
    const medicineCharges = Number(receipt.medicineCharges || 0);
    const labCharges = Number(receipt.labCharges || 0);
    const taxAmount = Number(receipt.taxAmount || 0);
    const discountAmount = Number(receipt.discountAmount || 0);
    const subTotal = Number(receipt.subTotal || 0);
    const totalAmount = Number(receipt.totalAmount || 0);
    const amountPaid = Number(receipt.amountPaid || 0);
    const balanceDue = Number(receipt.balanceDue || 0);
    const printedAt = new Date().toLocaleString("en-US");
    const staffName = String(profile?.name || currentUser?.name || "Staff");

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Receipt ${escapeHtml(receipt.invoiceId || receipt.id || "")}</title>
    <style>
      @page { size: A5 portrait; margin: 12mm; }
      body { font-family: Arial, sans-serif; color: #1f2f2d; margin: 0; }
      .receipt { border: 1px solid #d3dfdb; border-radius: 10px; padding: 14px; max-width: 520px; margin: 0 auto; }
      .header { display: flex; justify-content: space-between; align-items: start; gap: 12px; border-bottom: 1px solid #d3dfdb; padding-bottom: 10px; margin-bottom: 12px; }
      .clinic { font-size: 20px; font-weight: 700; color: #20463e; margin: 0; }
      .sub { margin: 4px 0 0; font-size: 12px; color: #4d6a63; }
      .meta { font-size: 12px; text-align: right; line-height: 1.5; }
      .section { margin-top: 10px; }
      .section h3 { margin: 0 0 6px; font-size: 13px; color: #2f5d54; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 10px; font-size: 12px; }
      .label { color: #5a746d; }
      .value { font-weight: 700; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 6px; }
      th, td { border: 1px solid #d3dfdb; padding: 6px 8px; text-align: left; }
      th { background: #eef5f2; color: #315f56; }
      .total { font-weight: 700; background: #eef5f2; }
      .footer { margin-top: 12px; border-top: 1px dashed #d3dfdb; padding-top: 10px; font-size: 11px; color: #5a746d; }
      .note { margin-top: 6px; font-size: 11px; color: #738a84; }
    </style>
  </head>
  <body>
    <div class="receipt">
      <div class="header">
        <div>
          <p class="clinic">PawEver Vet Clinic</p>
          <p class="sub">Payment Receipt</p>
        </div>
        <div class="meta">
          <div><strong>Invoice:</strong> ${escapeHtml(
            receipt.invoiceNumber || receipt.invoiceId || "-"
          )}</div>
          <div><strong>Appointment:</strong> ${escapeHtml(
            formatAppointmentReference(receipt.appointmentId)
          )}</div>
          <div><strong>Full ID:</strong> ${escapeHtml(
            receipt.appointmentId || "-"
          )}</div>
          <div><strong>Printed:</strong> ${escapeHtml(printedAt)}</div>
        </div>
      </div>
      <div class="section">
        <h3>Bill To</h3>
        <div class="grid">
          <div class="label">Owner</div><div class="value">${escapeHtml(
            receipt.ownerName || "-"
          )}</div>
          <div class="label">Pet</div><div class="value">${escapeHtml(
            receipt.petName || "-"
          )}</div>
          <div class="label">Doctor</div><div class="value">${escapeHtml(
            receipt.doctorName || "-"
          )}</div>
        </div>
      </div>
      <div class="section">
        <h3>Charges</h3>
        <table>
          <thead><tr><th>Item</th><th>Amount</th></tr></thead>
          <tbody>
            <tr><td>Consultation Fee</td><td>${escapeHtml(
              formatBaht(consultationFee)
            )}</td></tr>
            <tr><td>Service Charges</td><td>${escapeHtml(
              formatBaht(serviceCharges)
            )}</td></tr>
            <tr><td>Medicine Charges</td><td>${escapeHtml(
              formatBaht(medicineCharges)
            )}</td></tr>
            <tr><td>Lab Charges</td><td>${escapeHtml(
              formatBaht(labCharges)
            )}</td></tr>
            <tr><td>Subtotal</td><td>${escapeHtml(
              formatBaht(subTotal)
            )}</td></tr>
            <tr><td>Tax</td><td>${escapeHtml(
              formatBaht(taxAmount)
            )}</td></tr>
            <tr><td>Discount</td><td>${escapeHtml(
              formatBaht(discountAmount)
            )}</td></tr>
            <tr class="total"><td>Total</td><td>${escapeHtml(
              formatBaht(totalAmount)
            )}</td></tr>
            <tr><td>Paid</td><td>${escapeHtml(
              formatBaht(amountPaid)
            )}</td></tr>
            <tr class="total"><td>Balance</td><td>${escapeHtml(
              formatBaht(balanceDue)
            )}</td></tr>
          </tbody>
        </table>
      </div>
      <div class="section">
        <h3>Payment</h3>
        <div class="grid">
          <div class="label">Status</div><div class="value">${escapeHtml(
            receipt.paymentStatus || "-"
          )}</div>
          <div class="label">Method</div><div class="value">${escapeHtml(
            receipt.paymentMethod || "-"
          )}</div>
          <div class="label">Date</div><div class="value">${escapeHtml(
            receipt.paymentDate || "-"
          )}</div>
          <div class="label">Reference</div><div class="value">${escapeHtml(
            receipt.referenceNumber || "-"
          )}</div>
          <div class="label">Processed By</div><div class="value">${escapeHtml(
            staffName
          )}</div>
        </div>
      </div>
      <div class="footer">
        This is a system-generated receipt.
        <div class="note">Please keep this slip for audit and refund support.</div>
      </div>
    </div>
  </body>
</html>`;
  };

  const openReceiptWindow = (receipt, shouldPrint = false) => {
    const receiptWindow = window.open(
      "",
      "_blank",
      "noopener,noreferrer,width=760,height=920"
    );
    if (!receiptWindow) {
      return;
    }

    receiptWindow.document.open();
    receiptWindow.document.write(buildReceiptHtml(receipt));
    receiptWindow.document.close();
    receiptWindow.focus();

    if (shouldPrint) {
      receiptWindow.onload = () => {
        receiptWindow.print();
        receiptWindow.onafterprint = () => receiptWindow.close();
      };
    }
  };

  const fetchReceipt = async (billingId) => {
    const response = await getBillingReceiptById(billingId);
    return response?.receipt || null;
  };

  const handleViewReceipt = async (billingId) => {
    try {
      setBillingError("");
      const receipt = await fetchReceipt(billingId);
      if (!receipt) {
        setBillingError("Receipt not found.");
        return;
      }
      openReceiptWindow(receipt, false);
    } catch (requestError) {
      setBillingError(requestError.message);
    }
  };

  const handlePrintReceipt = async () => {
    if (!selectedBillingRecord?.id) {
      setBillingError("Select an invoice first.");
      return;
    }
    try {
      setBillingError("");
      const receipt = await fetchReceipt(selectedBillingRecord.id);
      if (!receipt) {
        setBillingError("Receipt not found for selected invoice.");
        return;
      }
      openReceiptWindow(receipt, true);
    } catch (requestError) {
      setBillingError(requestError.message);
    }
  };

  const handleApplyReportFilters = async () => {
    try {
      setIsLoadingReports(true);
      setReportError("");
      setReportStatusMessage("");
      const report = await loadReportsData();
      setReportMetrics(Array.isArray(report?.metrics) ? report.metrics : []);
      setReportTrendRows(
        Array.isArray(report?.trendRows) ? report.trendRows : []
      );
      setReportInsights(Array.isArray(report?.insights) ? report.insights : []);
      setReportStatusMessage("Report refreshed.");
    } catch (requestError) {
      setReportError(requestError.message);
    } finally {
      setIsLoadingReports(false);
    }
  };

  const handleSaveReportSnapshot = async () => {
    try {
      setReportError("");
      setReportStatusMessage("");
      await createReportSnapshot({
        range: reportRange,
        doctorName: reportDoctor,
        reportType,
        fromDate: reportFromDate,
        toDate: reportToDate,
      });
      const snapshots = await loadReportSnapshotsData();
      setReportSnapshots(snapshots);
      setReportStatusMessage("Report snapshot saved to database.");
    } catch (requestError) {
      setReportError(requestError.message);
    }
  };

  const handleExportReportCsv = () => {
    const rows = ["Period,Income,Appointments,Top Doctor"];
    reportTrendRows.forEach((row) => {
      rows.push(
        `${row.period},${row.income},${row.appointments},${row.topDoctor}`
      );
    });
    const blob = new Blob([rows.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute("download", `staff-report-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportReportPdf = () => {
    window.print();
  };

  const handleQuickAction = (action) => {
    if (!action?.targetPage) {
      return;
    }
    setActivePage(action.targetPage);
  };

  return (
    <main className="st-screen">
      <section className="st-shell">
        <aside className="st-sidebar">
          <img className="st-mini-logo" src={logo} alt="PawEver logo" />
          <h1>PawEver Staff</h1>
          <nav aria-label="Staff navigation">
            {STAFF_PAGES.map((page) => (
              <button
                key={page}
                className={`st-nav-btn${
                  activePage === page ? " is-active" : ""
                }`}
                type="button"
                onClick={() => setActivePage(page)}
              >
                {page}
              </button>
            ))}
          </nav>
          <button className="st-logout" type="button" onClick={onLogout}>
            Logout
          </button>
        </aside>

        <section className="st-main">
          <header className="st-header">
            <h2>{activePage}</h2>
            <p>{activeContent.subtitle}</p>
          </header>

          {activePage === "Dashboard" ? (
            <div className="st-dashboard-layout">
              <article className="st-card st-quick-overview">
                <h3>At a Glance</h3>
                <div className="st-dashboard-metrics">
                  {dashboardMetrics.map((item) => (
                    <div key={item.title} className="st-dashboard-metric">
                      <p>{item.title}</p>
                      <strong>{item.value}</strong>
                      <span>{item.note}</span>
                    </div>
                  ))}
                </div>
              </article>

              <article className="st-card">
                <h3>Quick Actions</h3>
                <div className="st-dashboard-actions">
                  {STAFF_QUICK_ACTIONS.map((item) => (
                    <button
                      key={item.title}
                      type="button"
                      className="st-action-card"
                      onClick={() => handleQuickAction(item)}
                    >
                      <strong>{item.title}</strong>
                      <span>{item.text}</span>
                    </button>
                  ))}
                </div>
              </article>

              <article className="st-card">
                <h3>Today’s Appointments</h3>
                <ul className="st-dashboard-list">
                  {todayAppointments.map((item) => (
                    <li key={item.id}>
                      <div>
                        <strong className="st-appointment-ref" title={item.id}>
                          {formatAppointmentReference(item.id)}
                        </strong>
                        <p className="st-appointment-id">{item.id}</p>
                        <p>
                          {item.ownerName || item.petName} | {item.doctorName}
                        </p>
                      </div>
                      <span
                        className={`st-history-status st-history-${item.status.toLowerCase()}`}
                      >
                        {item.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </article>

              <article className="st-card">
                <h3>Pending Requests</h3>
                <p>
                  {pendingDashboardAppointments.length} request(s) need
                  attention.
                </p>
                <ul className="st-dashboard-list">
                  {pendingDashboardAppointments.map((item) => (
                    <li key={`${item.id}-pending`}>
                      <div>
                        <strong className="st-appointment-ref" title={item.id}>
                          {formatAppointmentReference(item.id)}
                        </strong>
                        <p className="st-appointment-id">{item.id}</p>
                        <p>
                          {item.ownerName || item.petName} requested
                          confirmation
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleAppointmentUpdate(item.id, {
                            status: "Confirmed",
                          })
                        }
                      >
                        Review
                      </button>
                    </li>
                  ))}
                </ul>
              </article>
            </div>
          ) : activePage === "Appointment Management" ? (
            <div className="st-appointments">
              <article className="st-card">
                <h3>Filters</h3>
                <div className="st-filters">
                  <label>
                    Date
                    <input
                      type="date"
                      value={filterDate}
                      onChange={(event) => setFilterDate(event.target.value)}
                    />
                  </label>
                  <label>
                    Doctor
                    <select
                      value={filterDoctor}
                      onChange={(event) => setFilterDoctor(event.target.value)}
                    >
                      <option value="All">All</option>
                      {doctorFilterOptions.map((doctorName) => (
                        <option key={doctorName} value={doctorName}>
                          {doctorName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Status
                    <select
                      value={filterStatus}
                      onChange={(event) => setFilterStatus(event.target.value)}
                    >
                      <option value="All">All</option>
                      <option value="Pending">Pending</option>
                      <option value="Confirmed">Confirmed</option>
                      <option value="Completed">Completed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </label>
                </div>
              </article>

              <article className="st-card">
                <h3>View All Appointments</h3>
                <ul className="st-appointment-list">
                  {filteredAppointments.map((item) => (
                    <li key={item.id}>
                      <div>
                        <strong className="st-appointment-ref" title={item.id}>
                          {formatAppointmentReference(item.id)}
                        </strong>
                        <p className="st-appointment-id">{item.id}</p>
                        <p>
                          {item.appointmentDate} |{" "}
                          {item.ownerName || item.petName}
                        </p>
                        <p>
                          {item.doctorName} | {item.status}
                        </p>
                      </div>
                      <div className="st-appointment-actions">
                        <button
                          type="button"
                          onClick={() =>
                            handleAppointmentUpdate(item.id, {
                              status: "Confirmed",
                            })
                          }
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleAppointmentUpdate(item.id, {
                              status: "Completed",
                            })
                          }
                          disabled={item.status !== "Confirmed"}
                        >
                          Complete
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleAppointmentUpdate(item.id, {
                              status: "Cancelled",
                            })
                          }
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => openRescheduleModal(item)}
                        >
                          Reschedule
                        </button>
                        <button
                          type="button"
                          onClick={() => openAssignDoctorModal(item)}
                        >
                          Assign Doctor
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </article>
            </div>
          ) : activePage === "Pet Owner Management" ? (
            <div className="st-appointments">
              <article className="st-card">
                <h3>Register New Pet Owner</h3>
                <form className="st-filters" onSubmit={handleRegisterOwner}>
                  <label>
                    Full Name
                    <input
                      name="name"
                      type="text"
                      placeholder="Enter owner name"
                      required
                    />
                  </label>
                  <label>
                    Email
                    <input
                      name="email"
                      type="email"
                      placeholder="Enter email address"
                      required
                    />
                  </label>
                  <label>
                    Password
                    <input
                      name="password"
                      type="password"
                      placeholder="Minimum 8 characters"
                      minLength={8}
                      required
                    />
                  </label>
                  <label>
                    Phone Number
                    <input
                      name="phone"
                      type="tel"
                      placeholder="Enter phone number"
                    />
                  </label>
                  <label>
                    Preferred Contact
                    <select name="preferredContact" defaultValue="Email">
                      <option>Email</option>
                      <option>Phone</option>
                      <option>SMS</option>
                    </select>
                  </label>
                  <label>
                    Address
                    <input
                      name="address"
                      type="text"
                      placeholder="Enter address"
                    />
                  </label>
                  <button type="submit" className="st-plain-btn">
                    Register New Pet Owner
                  </button>
                </form>
                {ownerStatusMessage ? (
                  <p className="st-form-success">{ownerStatusMessage}</p>
                ) : null}
                {ownerError ? (
                  <p className="st-form-error">{ownerError}</p>
                ) : null}
              </article>

              <article className="st-card">
                <h3>Pet Owner Management</h3>
                <div className="st-filters">
                  <label>
                    Search Owner
                    <input
                      type="text"
                      value={ownerSearch}
                      placeholder="Search by name, email, or ID"
                      onChange={(event) => setOwnerSearch(event.target.value)}
                    />
                  </label>
                </div>
                <ul className="st-appointment-list">
                  {isLoadingOwners ? (
                    <li>
                      <div>
                        <strong>Loading owners...</strong>
                      </div>
                    </li>
                  ) : filteredOwners.length ? (
                    filteredOwners.map((owner) => (
                      <li key={owner.id}>
                        <div>
                          <strong
                            className="st-appointment-ref"
                            title={owner.id}
                          >
                            {formatOwnerReference(owner.id)} - {owner.name}
                          </strong>
                          <p className="st-appointment-id">{owner.id}</p>
                          <p>{owner.email}</p>
                          <p>
                            {owner.phone || "-"} | Pets:{" "}
                            {ownerPetCounts[owner.id] || 0}
                          </p>
                          <p>
                            Preferred Contact:{" "}
                            {owner.preferredContact || "Email"}
                          </p>
                        </div>
                        <div className="st-appointment-actions">
                          <button
                            type="button"
                            onClick={() => handleEditOwner(owner)}
                          >
                            Edit Owner Details
                          </button>
                          <button
                            type="button"
                            onClick={() => handleViewOwnerProfile(owner)}
                          >
                            View Profile
                          </button>
                          <button
                            type="button"
                            onClick={() => handleViewOwnerPets(owner)}
                          >
                            View Owner’s Pets
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveOwner(owner)}
                          >
                            Remove Owner
                          </button>
                        </div>
                      </li>
                    ))
                  ) : (
                    <li>
                      <div>
                        <strong>No pet owners found.</strong>
                      </div>
                    </li>
                  )}
                </ul>
              </article>
            </div>
          ) : activePage === "Pet Records" ? (
            <div className="st-appointments">
              <article className="st-card">
                <h3>Add Pet Basic Information</h3>
                <form className="st-filters" onSubmit={handleCreatePetRecord}>
                  <label>
                    Pet Owner
                    <select name="ownerId" required defaultValue="">
                      <option value="" disabled>
                        Select owner
                      </option>
                      {owners.map((owner) => (
                        <option key={owner.id} value={owner.id}>
                          {owner.name} ({owner.email})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Pet Name
                    <input
                      name="name"
                      type="text"
                      placeholder="Enter pet name"
                      required
                    />
                  </label>
                  <label>
                    Breed
                    <input
                      name="breed"
                      type="text"
                      placeholder="Enter breed"
                      required
                    />
                  </label>
                  <label>
                    Age
                    <input
                      name="age"
                      type="text"
                      placeholder="Enter age"
                      required
                    />
                  </label>
                  <label>
                    Weight
                    <input
                      name="weight"
                      type="text"
                      placeholder="Enter weight"
                      required
                    />
                  </label>
                  <label>
                    Vaccination Date / Status
                    <input
                      name="vaccinationStatus"
                      type="text"
                      placeholder="e.g. 2026-03-22 / Up to date"
                      required
                    />
                  </label>
                  <button type="submit" className="st-plain-btn">
                    Add Pet Basic Information
                  </button>
                </form>
                {petRecordStatusMessage ? (
                  <p className="st-form-success">{petRecordStatusMessage}</p>
                ) : null}
                {petRecordError ? (
                  <p className="st-form-error">{petRecordError}</p>
                ) : null}
              </article>

              <article className="st-card">
                <h3>Pet Records</h3>
                <div className="st-filters">
                  <label>
                    Search Pet
                    <input
                      type="text"
                      value={petSearch}
                      placeholder="Search by pet, breed, owner, or ID"
                      onChange={(event) => setPetSearch(event.target.value)}
                    />
                  </label>
                </div>
                <ul className="st-appointment-list">
                  {isLoadingPets ? (
                    <li>
                      <div>
                        <strong>Loading pet records...</strong>
                      </div>
                    </li>
                  ) : filteredPets.length ? (
                    filteredPets.map((pet) => (
                      <li key={pet.id}>
                        <div>
                          <strong className="st-appointment-ref" title={pet.id}>
                            {formatPetReference(pet.id)} - {pet.name}
                          </strong>
                          <p className="st-appointment-id">{pet.id}</p>
                          <p>Owner: {pet.ownerName || pet.ownerId || "-"}</p>
                          <p>Breed: {pet.breed}</p>
                          <p>Age: {pet.age}</p>
                          <p>Weight: {pet.weight}</p>
                          <p>
                            Vaccination Date/Status: {pet.vaccinationStatus}
                          </p>
                          <p>History (Read-only): Basic info only for staff.</p>
                        </div>
                        <div className="st-appointment-actions">
                          <button
                            type="button"
                            onClick={() => openPetWeightModal(pet)}
                          >
                            Update Weight
                          </button>
                          <button
                            type="button"
                            onClick={() => openPetVaccinationModal(pet)}
                          >
                            Update Vaccination Date
                          </button>
                          <button
                            type="button"
                            onClick={() => handleViewPetHistory(pet)}
                          >
                            View Pet History
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePetRecord(pet)}
                          >
                            Delete Pet
                          </button>
                        </div>
                      </li>
                    ))
                  ) : (
                    <li>
                      <div>
                        <strong>No pet records found in pet_data.</strong>
                      </div>
                    </li>
                  )}
                </ul>
              </article>

              <article className="st-card st-restriction-card">
                <h3>Access Restriction</h3>
                <p>
                  Staff cannot add diagnosis or prescription. These actions are
                  doctor-only permissions.
                </p>
              </article>
            </div>
          ) : activePage === "Vaccination" ? (
            <div className="st-appointments">
              <article className="st-card">
                <h3>Vaccination Overview</h3>
                <div className="st-vaccination-stats">
                  <div className="st-vaccination-stat">
                    <p>Total Records</p>
                    <strong>{vaccinations.length}</strong>
                  </div>
                  <div className="st-vaccination-stat">
                    <p>Linked Pets</p>
                    <strong>{linkedVaccinatedPetCount}</strong>
                  </div>
                  <div className="st-vaccination-stat">
                    <p>Total Pets (pet_data)</p>
                    <strong>{pets.length}</strong>
                  </div>
                  <div className="st-vaccination-stat">
                    <p>Total Owners (users)</p>
                    <strong>{owners.length}</strong>
                  </div>
                  <div className="st-vaccination-stat">
                    <p>Overdue</p>
                    <strong>{vaccinationStats.overdue}</strong>
                  </div>
                  <div className="st-vaccination-stat">
                    <p>Due Soon (14 days)</p>
                    <strong>{vaccinationStats.dueSoon}</strong>
                  </div>
                  <div className="st-vaccination-stat">
                    <p>Up to Date</p>
                    <strong>{vaccinationStats.upToDate}</strong>
                  </div>
                </div>
              </article>

              <article className="st-card">
                <h3>Add Vaccination Record</h3>
                <p className="st-vaccination-helper">
                  Save each dose with a clear due date so staff can follow up on
                  time.
                </p>
                <form
                  className="st-filters st-vaccination-form"
                  onSubmit={handleCreateVaccinationRecord}
                >
                  <label>
                    Vaccine ID
                    <input
                      name="vaccineId"
                      type="text"
                      placeholder="e.g. VAC-000123"
                      required
                    />
                  </label>
                  <label>
                    Pet (from pet_data)
                    <select
                      name="petId"
                      defaultValue=""
                      required
                    >
                      <option value="" disabled>
                        {isLoadingPets ? "Loading pets..." : "Select pet"}
                      </option>
                      {pets.map((pet) => (
                        <option key={pet.id} value={pet.id}>
                          {pet.name} ({formatPetReference(pet.id)}) -{" "}
                          {pet.ownerName || pet.ownerId || "-"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Vaccine Name
                    <input
                      name="vaccineName"
                      type="text"
                      placeholder="e.g. Rabies Booster"
                      required
                    />
                  </label>
                  <label>
                    Date Given
                    <input name="dateGiven" type="date" required />
                  </label>
                  <label>
                    Next Due Date
                    <input name="nextDueDate" type="date" required />
                  </label>
                  <button
                    type="submit"
                    className="st-plain-btn st-vaccination-submit"
                  >
                    Save Vaccination Record
                  </button>
                </form>
                {vaccinationStatusMessage ? (
                  <p className="st-form-success">{vaccinationStatusMessage}</p>
                ) : null}
                {vaccinationError ? (
                  <p className="st-form-error">{vaccinationError}</p>
                ) : null}
              </article>

              <article className="st-card">
                <h3>Vaccination Records</h3>
                <div className="st-filters st-vaccination-search">
                  <label>
                    Search Records
                    <input
                      type="text"
                      value={vaccinationSearch}
                      placeholder="Search by Vaccine ID, Pet ID, or Vaccine Name"
                      onChange={(event) =>
                        setVaccinationSearch(event.target.value)
                      }
                    />
                  </label>
                </div>
                <ul className="st-appointment-list st-vaccination-list">
                  {isLoadingVaccinations ? (
                    <li>
                      <div>
                        <strong>Loading vaccination records...</strong>
                      </div>
                    </li>
                  ) : sortedVaccinations.length ? (
                    sortedVaccinations.map((item) => {
                      const dueState = getVaccinationDueState(item.nextDueDate);
                      const daysUntil = getDaysUntilDate(item.nextDueDate);
                      return (
                        <li key={item.id || item.vaccineId}>
                          <div>
                            <strong>{item.vaccineId}</strong>
                            <p>
                              Pet: {petLookup[item.petId]?.name || "-"} (
                              {formatPetReference(item.petId)})
                            </p>
                            <p>
                              Owner:{" "}
                              {petLookup[item.petId]?.ownerName ||
                                ownerLookup[petLookup[item.petId]?.ownerId]
                                  ?.name ||
                                "-"}
                            </p>
                            <p>Vaccine: {item.vaccineName}</p>
                            <p>Date Given: {formatUiDate(item.dateGiven)}</p>
                            <p>Next Due: {formatUiDate(item.nextDueDate)}</p>
                            <span
                              className={`st-history-status ${dueState.className}`}
                            >
                              {dueState.label}
                              {Number.isFinite(daysUntil)
                                ? ` (${daysUntil} day${
                                    daysUntil === 1 ? "" : "s"
                                  })`
                                : ""}
                            </span>
                          </div>
                          <div className="st-appointment-actions">
                            <button
                              type="button"
                              onClick={() => handleDeleteVaccinationRecord(item)}
                            >
                              Delete
                            </button>
                          </div>
                        </li>
                      );
                    })
                  ) : (
                    <li className="st-vaccination-empty">
                      <div>
                        <strong>No vaccination records yet.</strong>
                        <p>
                          Add the first record above to start tracking due dates.
                        </p>
                      </div>
                    </li>
                  )}
                </ul>
              </article>
            </div>
          ) : activePage === "Doctor Schedule Management" ? (
            <div className="st-appointments">
              <article className="st-card">
                <h3>Select Doctor</h3>
                <div className="st-filters">
                  <label>
                    Doctor
                    <select
                      value={selectedDoctorId}
                      onChange={(event) =>
                        setSelectedDoctorId(event.target.value)
                      }
                    >
                      {doctors.length ? (
                        doctors.map((doctor) => (
                          <option key={doctor.id} value={doctor.id}>
                            {doctor.name}
                          </option>
                        ))
                      ) : (
                        <option value="">No doctors found</option>
                      )}
                    </select>
                  </label>
                </div>
                {isLoadingSchedule ? (
                  <p>Loading selected doctor schedule...</p>
                ) : null}
                {scheduleStatusMessage ? (
                  <p className="st-form-success">{scheduleStatusMessage}</p>
                ) : null}
                {scheduleError ? (
                  <p className="st-form-error">{scheduleError}</p>
                ) : null}
              </article>

              <form className="st-card" onSubmit={handleBlockUnavailableTime}>
                <h3>Block Unavailable Time</h3>
                <div className="st-filters">
                  <label>
                    Date
                    <input name="date" type="date" required />
                  </label>
                  <label>
                    Start Time
                    <input name="startTime" type="time" required />
                  </label>
                  <label>
                    End Time
                    <input name="endTime" type="time" required />
                  </label>
                  <label>
                    Reason
                    <input
                      name="reason"
                      type="text"
                      placeholder="Busy / Meeting / Leave"
                    />
                  </label>
                </div>
                <button
                  type="submit"
                  className="st-plain-btn"
                  disabled={isSavingSchedule || !selectedDoctor}
                >
                  {isSavingSchedule ? "Saving..." : "Block Time"}
                </button>
                <ul className="st-appointment-list">
                  {blockedSlots.map((slot) => (
                    <li key={slot.id}>
                      <div>
                        <strong>{selectedDoctor?.name || "Doctor"}</strong>
                        <p>
                          {slot.date} | {slot.startTime} - {slot.endTime}
                        </p>
                        <p>{slot.reason || "Busy"}</p>
                      </div>
                      <div className="st-appointment-actions">
                        <button
                          type="button"
                          onClick={() =>
                            handleRemoveScheduleSlot("blocked", slot.id)
                          }
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </form>

              <form className="st-card" onSubmit={handleSaveClinicHours}>
                <h3>Adjust Clinic Hours</h3>
                <div className="st-filters">
                  <label>
                    Monday - Friday
                    <input
                      type="text"
                      value={clinicHours.mondayFriday}
                      onChange={(event) =>
                        setClinicHours((current) => ({
                          ...current,
                          mondayFriday: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Saturday
                    <input
                      type="text"
                      value={clinicHours.saturday}
                      onChange={(event) =>
                        setClinicHours((current) => ({
                          ...current,
                          saturday: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Sunday
                    <input
                      type="text"
                      value={clinicHours.sunday}
                      onChange={(event) =>
                        setClinicHours((current) => ({
                          ...current,
                          sunday: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <button
                  type="submit"
                  className="st-plain-btn"
                  disabled={isSavingSchedule || !selectedDoctor}
                >
                  {isSavingSchedule ? "Saving..." : "Save Clinic Hours"}
                </button>
              </form>

              <form className="st-card" onSubmit={handleAssignEmergencySlot}>
                <h3>Assign Emergency Slots</h3>
                <div className="st-filters">
                  <label>
                    Date
                    <input name="date" type="date" required />
                  </label>
                  <label>
                    Start Time
                    <input name="startTime" type="time" required />
                  </label>
                  <label>
                    End Time
                    <input name="endTime" type="time" required />
                  </label>
                </div>
                <button
                  type="submit"
                  className="st-plain-btn"
                  disabled={isSavingSchedule || !selectedDoctor}
                >
                  {isSavingSchedule ? "Saving..." : "Assign Emergency Slot"}
                </button>
                <ul className="st-appointment-list">
                  {emergencySlots.length ? (
                    emergencySlots.map((slot) => (
                      <li key={slot.id}>
                        <div>
                          <strong>
                            {slot.date} | {slot.startTime} - {slot.endTime}
                          </strong>
                        </div>
                        <div className="st-appointment-actions">
                          <button
                            type="button"
                            onClick={() =>
                              handleRemoveScheduleSlot("available", slot.id)
                            }
                          >
                            Remove
                          </button>
                        </div>
                      </li>
                    ))
                  ) : (
                    <li>
                      <div>
                        <strong>No emergency slots assigned.</strong>
                      </div>
                    </li>
                  )}
                </ul>
              </form>

              <article className="st-card">
                <h3>Doctor Schedule Snapshot</h3>
                <p>Available slots: {availableSlots.length}</p>
                <p>Blocked slots: {blockedSlots.length}</p>
                <p>Emergency slots: {emergencySlots.length}</p>
                <p>
                  Clinic Hours: {clinicHours.mondayFriday} | {clinicHours.saturday} |{" "}
                  {clinicHours.sunday}
                </p>
              </article>
            </div>
          ) : activePage === "Profile" ? (
            <div className="st-profile-layout">
              <article className="st-card st-profile-summary">
                <div className="st-profile-avatar" aria-hidden="true">
                  {profile?.profilePhoto ? (
                    <img src={profile.profilePhoto} alt="Profile" />
                  ) : (
                    profile?.name?.slice(0, 2).toUpperCase() || "ST"
                  )}
                </div>
                <div className="st-profile-meta">
                  <h3>{profile?.name || "Staff User"}</h3>
                  <p>{profile?.role || "staff"}</p>
                  <p>Employee ID: {formatEmployeeReference(profile?.id)}</p>
                  <p className="st-appointment-id">{profile?.id || "-"}</p>
                </div>
              </article>

              <article className="st-card">
                <h3>Personal Information</h3>
                <form
                  className="st-profile-form"
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
                    Phone Number
                    <input
                      name="phone"
                      type="tel"
                      defaultValue={profile?.phone || ""}
                    />
                  </label>
                  <label>
                    Profile Photo
                    <input name="profilePhoto" type="file" accept="image/*" />
                  </label>
                  <label>
                    Email Address
                    <input type="email" value={profile?.email || ""} readOnly />
                  </label>
                  <label>
                    Role
                    <input
                      type="text"
                      value={profile?.role || "staff"}
                      readOnly
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
                  <label className="st-profile-full">
                    Address
                    <input
                      name="address"
                      type="text"
                      defaultValue={profile?.address || ""}
                    />
                  </label>
                  <button
                    type="submit"
                    className="st-plain-btn"
                    disabled={isSavingProfile}
                  >
                    {isSavingProfile ? "Saving..." : "Save Profile Changes"}
                  </button>
                </form>
                {profileStatus ? (
                  <p className="st-form-success">{profileStatus}</p>
                ) : null}
                {profileError ? (
                  <p className="st-form-error">{profileError}</p>
                ) : null}
              </article>

              <article className="st-card">
                <h3>Security & Account</h3>
                <form
                  className="st-profile-form"
                  onSubmit={handleStaffPasswordSubmit}
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
                  <button
                    type="submit"
                    className="st-plain-btn"
                    disabled={isChangingStaffPassword}
                  >
                    {isChangingStaffPassword
                      ? "Updating..."
                      : "Change Password"}
                  </button>
                </form>
                {staffPasswordStatus ? (
                  <p className="st-form-success">{staffPasswordStatus}</p>
                ) : null}
                {staffPasswordError ? (
                  <p className="st-form-error">{staffPasswordError}</p>
                ) : null}
                <div className="st-toggle-list">
                  <label>
                    <input
                      type="checkbox"
                      checked={Boolean(profile?.twoFactorEnabled)}
                      onChange={(event) =>
                        handleStaffTwoFactorToggle(event.target.checked)
                      }
                    />
                    Enable Two-Factor Authentication
                  </label>
                </div>
              </article>
            </div>
          ) : activePage === "Billing & Payments" ? (
            <div className="st-billing-layout">
              <article className="st-card st-billing-summary">
                {billingSummary.map((item) => (
                  <div key={item.title} className="st-billing-metric">
                    <p>{item.title}</p>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </article>

              <form className="st-card" onSubmit={handleGenerateInvoice}>
                <h3>Generate Invoice</h3>
                <div className="st-profile-form">
                  <label>
                    Invoice Number
                    <input
                      name="invoiceId"
                      type="text"
                      placeholder="Leave empty to auto-generate"
                    />
                  </label>
                  <label>
                    Appointment ID
                    <input
                      name="appointmentId"
                      type="text"
                      placeholder="Enter appointment ID"
                    />
                  </label>
                  <label>
                    Pet Owner Name
                    <input
                      name="ownerName"
                      type="text"
                      placeholder="Enter owner name"
                      required
                    />
                  </label>
                  <label>
                    Pet Name
                    <input
                      name="petName"
                      type="text"
                      placeholder="Enter pet name"
                      required
                    />
                  </label>
                  <label>
                    Doctor
                    <select name="doctorName" defaultValue="" required>
                      <option value="" disabled>
                        Select doctor
                      </option>
                      {doctors.map((doctor) => (
                        <option key={doctor.id} value={doctor.name}>
                          {doctor.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <button
                  type="submit"
                  className="st-plain-btn"
                  disabled={isSavingBilling}
                >
                  {isSavingBilling ? "Saving..." : "Generate Invoice"}
                </button>
              </form>

              <form
                className="st-card"
                onSubmit={handleSaveCharges}
                key={`charges-${selectedBillingId || "none"}`}
              >
                <h3>Charges</h3>
                <div className="st-filters">
                  <label>
                    Select Invoice
                    <select
                      value={selectedBillingId}
                      onChange={(event) =>
                        setSelectedBillingId(event.target.value)
                      }
                    >
                      {billingRecords.length ? (
                        billingRecords.map((item) => (
                          <option key={item.id} value={item.id}>
                            {(item.invoiceNumber || item.invoiceId)} | {item.ownerName} | {item.petName}
                          </option>
                        ))
                      ) : (
                        <option value="">No invoices</option>
                      )}
                    </select>
                  </label>
                </div>
                <div className="st-charge-grid">
                  <label>
                    Consultation Fee
                    <input
                      name="consultationFee"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={selectedBillingRecord?.consultationFee || 0}
                    />
                  </label>
                  <label>
                    Service Charges
                    <input
                      name="serviceCharges"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={selectedBillingRecord?.serviceCharges || 0}
                    />
                  </label>
                  <label>
                    Medicine Charges
                    <input
                      name="medicineCharges"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={selectedBillingRecord?.medicineCharges || 0}
                    />
                  </label>
                  <label>
                    Lab Charges
                    <input
                      name="labCharges"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={selectedBillingRecord?.labCharges || 0}
                    />
                  </label>
                  <label>
                    Tax
                    <input
                      name="taxAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={selectedBillingRecord?.taxAmount || 0}
                    />
                  </label>
                  <label>
                    Discount
                    <input
                      name="discountAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={selectedBillingRecord?.discountAmount || 0}
                    />
                  </label>
                </div>
                <div className="st-billing-total">
                  <span>Subtotal</span>
                  <strong>{selectedBillingRecord?.subTotalDisplay || "฿0.00"}</strong>
                </div>
                <div className="st-billing-total">
                  <span>Total Amount</span>
                  <strong>{selectedBillingRecord?.totalAmountDisplay || "฿0.00"}</strong>
                </div>
                <div className="st-billing-total">
                  <span>Unpaid Balance</span>
                  <strong>{selectedBillingRecord?.balanceDueDisplay || "฿0.00"}</strong>
                </div>
                <button
                  type="submit"
                  className="st-plain-btn"
                  disabled={isSavingBilling || !selectedBillingRecord}
                >
                  {isSavingBilling ? "Saving..." : "Save Charges"}
                </button>
              </form>

              <form
                className="st-card"
                onSubmit={handleRecordPayment}
                key={`payment-${selectedBillingId || "none"}`}
              >
                <h3>Record Payment</h3>
                <div className="st-profile-form">
                  <label>
                    Payment Method
                    <select
                      name="paymentMethod"
                      defaultValue={
                        selectedBillingRecord?.paymentMethod || "Card"
                      }
                    >
                      <option>Card</option>
                      <option>Cash</option>
                      <option>Transfer</option>
                    </select>
                  </label>
                  <label>
                    Payment Amount
                    <input
                      name="paymentAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={selectedBillingRecord?.balanceDue || 0}
                    />
                  </label>
                  <label>
                    Payment Date
                    <input
                      name="paymentDate"
                      type="date"
                      defaultValue={selectedBillingRecord?.paymentDate || ""}
                    />
                  </label>
                  <label>
                    Reference Number
                    <input
                      name="referenceNumber"
                      type="text"
                      defaultValue={selectedBillingRecord?.referenceNumber || ""}
                      placeholder="Card slip / transfer ref"
                    />
                  </label>
                  <label>
                    Payment Status
                    <select
                      name="paymentStatus"
                      defaultValue=""
                    >
                      <option value="">Auto (from paid amount)</option>
                      <option>Failed</option>
                      <option>Unpaid</option>
                    </select>
                  </label>
                </div>
                <div className="st-billing-total">
                  <span>Already Paid</span>
                  <strong>{selectedBillingRecord?.amountPaidDisplay || "฿0.00"}</strong>
                </div>
                <div className="st-billing-total">
                  <span>Current Balance</span>
                  <strong>{selectedBillingRecord?.balanceDueDisplay || "฿0.00"}</strong>
                </div>
                <div className="st-billing-actions">
                  <button
                    type="submit"
                    disabled={isSavingBilling || !selectedBillingRecord}
                  >
                    {isSavingBilling ? "Saving..." : "Record Payment"}
                  </button>
                  <button
                    type="button"
                    onClick={handlePrintReceipt}
                    disabled={!selectedBillingRecord}
                  >
                    Print Receipt
                  </button>
                </div>
                {billingStatusMessage ? (
                  <p className="st-form-success">{billingStatusMessage}</p>
                ) : null}
                {billingError ? (
                  <p className="st-form-error">{billingError}</p>
                ) : null}
              </form>

              <article className="st-card st-history-card">
                <h3>Payment History</h3>
                <ul className="st-history-list">
                  {isLoadingBilling ? (
                    <li>
                      <div>
                        <strong>Loading payment history...</strong>
                      </div>
                    </li>
                  ) : billingRecords.length ? (
                    billingRecords.map((item) => (
                      <li key={item.id}>
                        <div>
                          <strong>{item.invoiceNumber || item.invoiceId}</strong>
                          <p>
                            {item.ownerName} | {item.petName}
                          </p>
                          <p>Doctor: {item.doctorName || "-"}</p>
                          <p>
                            Paid: {item.amountPaidDisplay || formatBaht(item.amountPaid)} | Balance:{" "}
                            {item.balanceDueDisplay || formatBaht(item.balanceDue)}
                          </p>
                        </div>
                        <span>
                          {item.totalAmountDisplay ||
                            formatBaht(item.totalAmount)}
                        </span>
                        <span>{item.paymentMethod || "-"}</span>
                        <span
                          className={`st-history-status st-history-${item.paymentStatus.toLowerCase()}`}
                        >
                          {item.paymentStatus}
                        </span>
                      </li>
                    ))
                  ) : (
                    <li>
                      <div>
                        <strong>No billing records found.</strong>
                      </div>
                    </li>
                  )}
                </ul>
              </article>
            </div>
          ) : activePage === "Reports & Analytics" ? (
            <div className="st-reports-layout">
              <article className="st-card st-reports-filters">
                <h3>Report Filters</h3>
                <div className="st-filters">
                  <label>
                    Date Range
                    <select
                      value={reportRange}
                      onChange={(event) => setReportRange(event.target.value)}
                    >
                      <option value="this-week">This Week</option>
                      <option value="this-month">This Month</option>
                      <option value="last-month">Last Month</option>
                      <option value="custom">Custom Range</option>
                    </select>
                  </label>
                  {reportRange === "custom" ? (
                    <>
                      <label>
                        From
                        <input
                          type="date"
                          value={reportFromDate}
                          onChange={(event) =>
                            setReportFromDate(event.target.value)
                          }
                        />
                      </label>
                      <label>
                        To
                        <input
                          type="date"
                          value={reportToDate}
                          onChange={(event) =>
                            setReportToDate(event.target.value)
                          }
                        />
                      </label>
                    </>
                  ) : null}
                  <label>
                    Doctor
                    <select
                      value={reportDoctor}
                      onChange={(event) => setReportDoctor(event.target.value)}
                    >
                      <option value="All">All Doctors</option>
                      {doctors.map((doctor) => (
                        <option key={doctor.id} value={doctor.name}>
                          {doctor.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Report Type
                    <select
                      value={reportType}
                      onChange={(event) => setReportType(event.target.value)}
                    >
                      <option value="Financial + Operational">
                        Financial + Operational
                      </option>
                      <option value="Financial Only">Financial Only</option>
                      <option value="Appointments Only">
                        Appointments Only
                      </option>
                    </select>
                  </label>
                </div>
                <div className="st-billing-actions">
                  <button
                    type="button"
                    onClick={handleApplyReportFilters}
                    disabled={isLoadingReports}
                  >
                    {isLoadingReports ? "Loading..." : "Apply Filters"}
                  </button>
                  <button type="button" onClick={handleExportReportCsv}>
                    Export CSV
                  </button>
                  <button type="button" onClick={handleExportReportPdf}>
                    Export PDF
                  </button>
                  <button type="button" onClick={handleSaveReportSnapshot}>
                    Save Snapshot
                  </button>
                </div>
                {reportStatusMessage ? (
                  <p className="st-form-success">{reportStatusMessage}</p>
                ) : null}
                {reportError ? (
                  <p className="st-form-error">{reportError}</p>
                ) : null}
              </article>

              <article className="st-card st-reports-kpis">
                {reportMetrics.map((item) => (
                  <div key={item.title} className="st-report-kpi">
                    <p>{item.title}</p>
                    <strong>{item.value}</strong>
                    <span>{item.note}</span>
                  </div>
                ))}
              </article>

              <article className="st-card">
                <h3>Income & Appointment Trend</h3>
                <ul className="st-report-trend-list">
                  {reportTrendRows.map((row) => (
                    <li key={row.period}>
                      <span>{row.period}</span>
                      <strong>{row.income}</strong>
                      <strong>{row.appointments} appts</strong>
                      <span>{row.topDoctor}</span>
                    </li>
                  ))}
                </ul>
              </article>

              <article className="st-card">
                <h3>Top Insights</h3>
                <ul className="st-dashboard-list">
                  {reportInsights.map((item) => (
                    <li key={item.title}>
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.text}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </article>

              <article className="st-card">
                <h3>Saved Snapshots</h3>
                <ul className="st-report-trend-list">
                  {reportSnapshots.map((snapshot) => (
                    <li key={snapshot.id}>
                      <strong>
                        {snapshot.fromDate} to {snapshot.toDate}
                      </strong>
                      <span>
                        {snapshot.doctorName} | {snapshot.reportType}
                      </span>
                    </li>
                  ))}
                </ul>
              </article>
            </div>
          ) : (
            <div className="st-grid">
              {activeContent.cards.map((card) => (
                <article key={card.title} className="st-card">
                  <h3>{card.title}</h3>
                  <p>{card.text}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
      {rescheduleModalAppointment ? (
        <div
          className="st-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Reschedule appointment"
        >
          <div className="st-modal">
            <h3>Reschedule Appointment</h3>
            <form
              className="st-profile-form"
              onSubmit={handleRescheduleAppointment}
            >
              <p>
                <strong>Appointment:</strong>{" "}
                {formatAppointmentReference(rescheduleModalAppointment.id)}
              </p>
              <p className="st-appointment-id">
                Full ID: {rescheduleModalAppointment.id}
              </p>
              <label>
                New Date
                <input
                  type="date"
                  value={rescheduleModalDate}
                  onChange={(event) =>
                    setRescheduleModalDate(event.target.value)
                  }
                  required
                />
              </label>
              <label>
                New Time
                <input
                  type="time"
                  value={rescheduleModalTime}
                  onChange={(event) =>
                    setRescheduleModalTime(event.target.value)
                  }
                  required
                />
              </label>
              <div className="st-billing-actions">
                <button type="submit" className="st-plain-btn">
                  Save
                </button>
                <button
                  type="button"
                  className="st-plain-btn st-danger-btn"
                  onClick={closeRescheduleModal}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {assignDoctorModalAppointment ? (
        <div
          className="st-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Assign doctor"
        >
          <div className="st-modal">
            <h3>Assign Doctor</h3>
            <form
              className="st-profile-form"
              onSubmit={handleAssignDoctorSubmit}
            >
              <p>
                <strong>Appointment:</strong>{" "}
                {formatAppointmentReference(assignDoctorModalAppointment.id)}
              </p>
              <p className="st-appointment-id">
                Full ID: {assignDoctorModalAppointment.id}
              </p>
              <p>
                <strong>Date:</strong>{" "}
                {assignDoctorModalAppointment.appointmentDate}{" "}
                {assignDoctorModalAppointment.appointmentTime}
              </p>
              <label>
                Doctor
                <select
                  value={assignDoctorModalValue}
                  onChange={(event) =>
                    setAssignDoctorModalValue(event.target.value)
                  }
                  required
                >
                  <option value="" disabled>
                    Select doctor
                  </option>
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.name}>
                      {doctor.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="st-billing-actions">
                <button type="submit" className="st-plain-btn">
                  Save
                </button>
                <button
                  type="button"
                  className="st-plain-btn st-danger-btn"
                  onClick={closeAssignDoctorModal}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {ownerModalMode && activeOwner ? (
        <div
          className="st-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Owner details modal"
        >
          <div className="st-modal">
            {ownerModalMode === "edit" ? (
              <>
                <h3>Edit Owner Details</h3>
                <form
                  className="st-profile-form"
                  onSubmit={handleOwnerEditSubmit}
                >
                  <label>
                    Owner Name
                    <input
                      name="name"
                      type="text"
                      value={ownerEditForm.name}
                      onChange={handleOwnerEditFieldChange}
                      required
                    />
                  </label>
                  <label>
                    Phone Number
                    <input
                      name="phone"
                      type="tel"
                      value={ownerEditForm.phone}
                      onChange={handleOwnerEditFieldChange}
                    />
                  </label>
                  <label className="st-profile-full">
                    Address
                    <input
                      name="address"
                      type="text"
                      value={ownerEditForm.address}
                      onChange={handleOwnerEditFieldChange}
                    />
                  </label>
                  <label>
                    Preferred Contact
                    <select
                      name="preferredContact"
                      value={ownerEditForm.preferredContact}
                      onChange={handleOwnerEditFieldChange}
                    >
                      <option>Email</option>
                      <option>Phone</option>
                      <option>SMS</option>
                    </select>
                  </label>
                  <div className="st-billing-actions">
                    <button type="submit" className="st-plain-btn">
                      Save Changes
                    </button>
                    <button
                      type="button"
                      className="st-plain-btn st-danger-btn"
                      onClick={closeOwnerModal}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </>
            ) : null}
            {ownerModalMode === "profile" ? (
              <>
                <h3>Owner Profile</h3>
                <div className="st-owner-profile-grid">
                  <p>
                    <strong>Owner ID:</strong> {activeOwner.id}
                  </p>
                  <p>
                    <strong>Name:</strong> {activeOwner.name || "-"}
                  </p>
                  <p>
                    <strong>Email:</strong> {activeOwner.email || "-"}
                  </p>
                  <p>
                    <strong>Phone:</strong> {activeOwner.phone || "-"}
                  </p>
                  <p>
                    <strong>Preferred Contact:</strong>{" "}
                    {activeOwner.preferredContact || "Email"}
                  </p>
                  <p>
                    <strong>Address:</strong> {activeOwner.address || "-"}
                  </p>
                  <p>
                    <strong>Total Pets:</strong>{" "}
                    {ownerPetCounts[activeOwner.id] || 0}
                  </p>
                </div>
                <div className="st-billing-actions">
                  <button
                    type="button"
                    className="st-plain-btn"
                    onClick={closeOwnerModal}
                  >
                    Close
                  </button>
                </div>
              </>
            ) : null}
            {ownerModalMode === "pets" ? (
              <>
                <h3>{activeOwner.name || "Owner"}'s Pets</h3>
                {isLoadingOwnerModalPets ? (
                  <p>Loading pets...</p>
                ) : ownerModalPets.length ? (
                  <ul className="st-appointment-list">
                    {ownerModalPets.map((pet) => (
                      <li key={pet.id}>
                        <div>
                          <strong className="st-appointment-ref" title={pet.id}>
                            {formatPetReference(pet.id)} - {pet.name}
                          </strong>
                          <p className="st-appointment-id">{pet.id}</p>
                          <p>Breed: {pet.breed || "-"}</p>
                          <p>Age: {pet.age || "-"}</p>
                          <p>Weight: {pet.weight || "-"}</p>
                          <p>Vaccination: {pet.vaccinationStatus || "-"}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No pets registered for this owner.</p>
                )}
                <div className="st-billing-actions">
                  <button
                    type="button"
                    className="st-plain-btn"
                    onClick={closeOwnerModal}
                  >
                    Close
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
      {petEditModalMode && petEditModalPet ? (
        <div
          className="st-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Pet update modal"
        >
          <div className="st-modal">
            <h3>
              {petEditModalMode === "weight"
                ? "Update Pet Weight"
                : "Update Vaccination Date / Status"}
            </h3>
            <form className="st-profile-form" onSubmit={handlePetEditSubmit}>
              <p>
                <strong>Pet:</strong> {petEditModalPet.name || "-"} (
                {petEditModalPet.id})
              </p>
              <label>
                {petEditModalMode === "weight"
                  ? "Weight"
                  : "Vaccination Date / Status"}
                <input
                  type="text"
                  value={petEditModalValue}
                  onChange={(event) => setPetEditModalValue(event.target.value)}
                  placeholder={
                    petEditModalMode === "weight"
                      ? "Enter new weight"
                      : "e.g. 2026-03-22 / Up to date"
                  }
                  required
                />
              </label>
              <div className="st-billing-actions">
                <button type="submit" className="st-plain-btn">
                  Save
                </button>
                <button
                  type="button"
                  className="st-plain-btn st-danger-btn"
                  onClick={closePetEditModal}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {petHistoryModalPet ? (
        <div
          className="st-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Pet history details"
        >
          <div className="st-modal">
            <h3>Pet History</h3>
            <div className="st-owner-profile-grid">
              <p>
                <strong>Pet:</strong> {petHistoryModalPet.name || "-"}
              </p>
              <p>
                <strong>Owner:</strong> {petHistoryModalPet.ownerName || "-"}
              </p>
              <p>
                <strong>Breed:</strong> {petHistoryModalPet.breed || "-"}
              </p>
              <p>
                <strong>Age:</strong> {petHistoryModalPet.age || "-"}
              </p>
              <p>
                <strong>Weight:</strong> {petHistoryModalPet.weight || "-"}
              </p>
              <p>
                <strong>Vaccination:</strong>{" "}
                {petHistoryModalPet.vaccinationStatus || "-"}
              </p>
              <p>
                <strong>Note:</strong> History is read-only for staff.
              </p>
            </div>
            <div className="st-billing-actions">
              <button
                type="button"
                className="st-plain-btn"
                onClick={() => setPetHistoryModalPet(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
