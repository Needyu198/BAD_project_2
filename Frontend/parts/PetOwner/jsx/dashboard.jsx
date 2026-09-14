import QueuePage from "../../../components/Queue/QueuePage";
import { useEffect, useState } from "react";
import "../css/dashboard.css";
import {
  changeUserPassword,
  createAppointment,
  createPet,
  deleteAppointmentById,
  deletePetById,
  getUserProfile,
  listAppointments,
  listMedicalRecords,
  listPets,
  listVaccinations,
  listUsers,
  updatePetById,
  updateUserProfile,
} from "../../../lib/api";
import { formatAppointmentReference } from "../../../lib/appointmentRef";
import { compressImageFileToDataUrl } from "../../../lib/imageUpload";
import logo from "../../../images/Web_Logo.png";

const SIDEBAR_ITEMS = [
  { id: "Queue Status", label: "Queue Status", icon: "🎟️" },
  { id: "Dashboard", label: "Dashboard", icon: "🏠" },
  { id: "Book Appointment", label: "Book Appointment", icon: "📝" },
  { id: "My Pets", label: "My Pets", icon: "🐾" },
  { id: "Appointment History", label: "Appointment History", icon: "📅" },
  { id: "Medical Records", label: "Medical Records", icon: "📋" },
  { id: "Profile", label: "Profile", icon: "👤" },
];

const PAGE_DESCRIPTIONS = {
  "Queue Status": "Check in your pet and follow your place in the queue.",
  "My Pets": "Manage pet profiles, photos, vaccines, and basic health details.",
  "Appointment History":
    "Review upcoming, completed, and cancelled appointments.",
  "Medical Records":
    "Browse diagnosis, prescriptions, reports, and treatment updates.",
  Profile: "Update owner details, preferences, and account settings.",
};

function toTimestamp(dateValue, timeValue = "00:00") {
  if (!dateValue) {
    return Number.NaN;
  }
  const withTime = Date.parse(`${dateValue}T${timeValue || "00:00"}`);
  if (!Number.isNaN(withTime)) {
    return withTime;
  }
  return Date.parse(dateValue);
}

function getSortedAppointments(appointments, order = "desc") {
  return [...appointments].sort((a, b) => {
    const aTs = toTimestamp(a.appointmentDate || a.date, a.appointmentTime);
    const bTs = toTimestamp(b.appointmentDate || b.date, b.appointmentTime);
    const safeA = Number.isNaN(aTs) ? 0 : aTs;
    const safeB = Number.isNaN(bTs) ? 0 : bTs;
    return order === "asc" ? safeA - safeB : safeB - safeA;
  });
}

function formatNotificationChannels(preferredContact, includeEmailEligible = true) {
  const channels = ["In-app"];
  if (
    includeEmailEligible &&
    String(preferredContact || "").trim().toLowerCase() === "email"
  ) {
    channels.push("Email");
  }
  return channels.join(" / ");
}

const DAY_MS = 24 * 60 * 60 * 1000;
const VACCINATION_DUE_SOON_DAYS = 30;
const VACCINE_INTERVAL_RULES = [
  { keywords: ["rabies"], days: 365 },
  { keywords: ["dhpp", "distemper", "parvo", "adenovirus"], days: 365 },
  { keywords: ["bordetella"], days: 180 },
  { keywords: ["leptospirosis", "lepto"], days: 365 },
  { keywords: ["influenza", "flu"], days: 365 },
  { keywords: ["fvrcp"], days: 365 },
  { keywords: ["fe lv", "felv"], days: 365 },
];

function parseDateValue(value) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS);
}

function getDaysUntil(date, fromDate = new Date()) {
  const diff = startOfDay(date).getTime() - startOfDay(fromDate).getTime();
  return Math.round(diff / DAY_MS);
}

function getVaccineIntervalDays(vaccineName) {
  const normalized = String(vaccineName || "").trim().toLowerCase();
  if (!normalized) {
    return 365;
  }
  const matchedRule = VACCINE_INTERVAL_RULES.find((rule) =>
    rule.keywords.some((keyword) => normalized.includes(keyword))
  );
  return matchedRule?.days || 365;
}

function getVaccinationSchedules(pets, vaccinationRecords) {
  const now = new Date();
  const petIds = new Set(pets.map((pet) => String(pet.id || "")));
  const scopedRecords = (Array.isArray(vaccinationRecords)
    ? vaccinationRecords
    : []
  ).filter((record) => {
    const petId = String(record.petId || "");
    return petId && petIds.has(petId);
  });

  return pets.map((pet) => {
    const history = scopedRecords
      .filter(
        (record) => String(record.petId || "") === String(pet.id || "")
      )
      .map((record) => {
        const eventDate = parseDateValue(record.dateGiven);
        const nextDueDate = parseDateValue(record.nextDueDate);
        return {
          id: record.id,
          petId: record.petId,
          petName: pet.name,
          vaccineName: record.vaccineName,
          eventDate,
          nextDueDate,
        };
      })
      .sort((a, b) => {
        const aTs = a.eventDate?.getTime() || 0;
        const bTs = b.eventDate?.getTime() || 0;
        return bTs - aTs;
      });

    const latestRecord = history[0] || null;
    const normalizedManualStatus = String(pet.vaccinationStatus || "")
      .trim()
      .toLowerCase();

    if (!latestRecord || !latestRecord.eventDate) {
      let reminderStatus = "unknown";
      if (normalizedManualStatus === "pending") {
        reminderStatus = "overdue";
      } else if (normalizedManualStatus.includes("due soon")) {
        reminderStatus = "due-soon";
      } else if (normalizedManualStatus === "up to date") {
        reminderStatus = "up-to-date";
      }
      return {
        petId: pet.id,
        petName: pet.name,
        manualStatus: pet.vaccinationStatus,
        latestRecord: null,
        history,
        nextDueDate: null,
        nextDueDateLabel: "No vaccine date recorded",
        reminderStatus,
        reminderStatusLabel:
          reminderStatus === "overdue"
            ? "Overdue"
            : reminderStatus === "due-soon"
            ? "Due soon"
            : reminderStatus === "up-to-date"
            ? "Up to date"
            : "No history",
        daysUntilDue: null,
      };
    }

    const nextDueDate = latestRecord.nextDueDate;
    if (!nextDueDate) {
      return {
        petId: pet.id,
        petName: pet.name,
        manualStatus: pet.vaccinationStatus,
        latestRecord,
        history,
        nextDueDate: null,
        nextDueDateLabel: "No due date recorded",
        reminderStatus: "unknown",
        reminderStatusLabel: "No due date",
        daysUntilDue: null,
      };
    }
    const daysUntilDue = getDaysUntil(nextDueDate, now);
    let reminderStatus = "up-to-date";
    if (daysUntilDue < 0) {
      reminderStatus = "overdue";
    } else if (daysUntilDue <= VACCINATION_DUE_SOON_DAYS) {
      reminderStatus = "due-soon";
    }

    return {
      petId: pet.id,
      petName: pet.name,
      manualStatus: pet.vaccinationStatus,
      latestRecord,
      history,
      nextDueDate,
      nextDueDateLabel: formatAppointmentDate(nextDueDate.toISOString()),
      reminderStatus,
      reminderStatusLabel:
        reminderStatus === "overdue"
          ? "Overdue"
          : reminderStatus === "due-soon"
          ? "Due soon"
          : "Up to date",
      daysUntilDue,
    };
  });
}

function DashboardCards({
  pets,
  appointments,
  vaccinationRecords,
  profile,
  onBookAppointment,
  onAddPet,
}) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const now = new Date();
  const nowTs = now.getTime();
  const upcomingReminderWindowTs = nowTs + 48 * 60 * 60 * 1000;
  const appointmentReminderEnabled =
    profile?.notificationPreferences?.appointmentReminders !== false;
  const vaccinationReminderEnabled =
    profile?.notificationPreferences?.vaccinationReminders !== false;
  const reminderChannels = formatNotificationChannels(profile?.preferredContact);
  const upcomingAppointment =
    getSortedAppointments(
      appointments.filter((item) => {
        const status = String(item.status || "").toLowerCase();
        if (status === "cancelled" || status === "completed") {
          return false;
        }
        const ts = toTimestamp(
          item.appointmentDate || item.date,
          item.appointmentTime
        );
        return !Number.isNaN(ts) && ts >= todayStart.getTime();
      }),
      "asc"
    )[0] || null;
  const recentAppointment =
    getSortedAppointments(appointments, "desc")[0] || null;
  const vaccinationSchedules = getVaccinationSchedules(pets, vaccinationRecords);
  const vaccineReminders = vaccinationSchedules.filter(
    (item) => item.reminderStatus === "due-soon" || item.reminderStatus === "overdue"
  );
  const appointmentStatusNotifications = getSortedAppointments(
    appointments.filter((item) => {
      const status = String(item.status || "").toLowerCase();
      return status === "confirmed" || status === "cancelled";
    }),
    "desc"
  ).slice(0, 3);
  const upcomingReminderAppointments = appointmentReminderEnabled
    ? getSortedAppointments(
        appointments.filter((item) => {
          const status = String(item.status || "").toLowerCase();
          if (status === "cancelled" || status === "completed") {
            return false;
          }
          const ts = toTimestamp(
            item.appointmentDate || item.date,
            item.appointmentTime
          );
          return (
            !Number.isNaN(ts) &&
            ts >= nowTs &&
            ts <= upcomingReminderWindowTs
          );
        }),
        "asc"
      ).slice(0, 2)
    : [];

  return (
    <div className="po-card-grid">
      <article className="po-card">
        <h3>Upcoming Appointment</h3>
        {upcomingAppointment ? (
          <ul className="po-detail-list">
            <li>
              <span>Pet</span>
              <strong>{upcomingAppointment.petName}</strong>
            </li>
            <li>
              <span>Doctor</span>
              <strong>{upcomingAppointment.doctorName}</strong>
            </li>
            <li>
              <span>Date & Time</span>
              <strong>
                {formatAppointmentDate(
                  upcomingAppointment.appointmentDate ||
                    upcomingAppointment.date
                )}
                {upcomingAppointment.appointmentTime
                  ? `, ${upcomingAppointment.appointmentTime}`
                  : ""}
              </strong>
            </li>
          </ul>
        ) : (
          <p className="po-mypets-subtitle">
            No upcoming appointments in your account.
          </p>
        )}
      </article>

      <article className="po-card">
        <h3>Pet Vaccination Reminders</h3>
        {vaccineReminders.length ? (
          <ul className="po-note-list">
            {vaccineReminders.map((entry) => (
              <li key={entry.petId}>
                {entry.petName}: {entry.reminderStatusLabel}
                {entry.nextDueDate
                  ? ` (next due ${entry.nextDueDateLabel})`
                  : ` (${entry.nextDueDateLabel})`}
                {entry.latestRecord?.vaccineName
                  ? ` - last vaccine: ${entry.latestRecord.vaccineName}`
                  : ""}
                .
              </li>
            ))}
          </ul>
        ) : (
          <p className="po-mypets-subtitle">
            All pets are marked as up to date.
          </p>
        )}
      </article>

      <article className="po-card">
        <h3>Recent Medical Record</h3>
        {recentAppointment ? (
          <ul className="po-detail-list">
            <li>
              <span>Pet</span>
              <strong>{recentAppointment.petName}</strong>
            </li>
            <li>
              <span>Reason</span>
              <strong>{recentAppointment.reason}</strong>
            </li>
            <li>
              <span>Updated</span>
              <strong>
                {formatAppointmentDate(
                  recentAppointment.appointmentDate || recentAppointment.date
                )}
              </strong>
            </li>
          </ul>
        ) : (
          <p className="po-mypets-subtitle">No medical records found yet.</p>
        )}
      </article>

      <article className="po-card">
        <h3>Quick Buttons</h3>
        <div className="po-quick-actions">
          <button type="button" onClick={onBookAppointment}>
            Book Appointment
          </button>
          <button type="button" onClick={onAddPet}>
            Add Pet
          </button>
        </div>
      </article>

      <article className="po-card">
        <h3>Notifications</h3>
        <ul className="po-note-list">
          {appointmentStatusNotifications.map((item) => (
            <li key={`appt-status-${item.id}`}>
              Appointment {String(item.status || "").toLowerCase()} for{" "}
              {item.petName} with {item.doctorName} on{" "}
              {formatAppointmentDate(item.appointmentDate || item.date)}
              {item.appointmentTime ? `, ${item.appointmentTime}` : ""}. (In-app)
            </li>
          ))}

          {vaccinationReminderEnabled
            ? vaccineReminders.slice(0, 3).map((entry) => (
                <li key={`vax-${entry.petId}`}>
                  Vaccination reminder: {entry.petName} is {entry.reminderStatusLabel}
                  {entry.nextDueDate ? ` (next due ${entry.nextDueDateLabel})` : ""}. (
                  {reminderChannels})
                </li>
              ))
            : null}

          {upcomingReminderAppointments.map((item) => (
            <li key={`upcoming-${item.id}`}>
              Upcoming appointment reminder: {item.petName} with{" "}
              {item.doctorName} on{" "}
              {formatAppointmentDate(item.appointmentDate || item.date)}
              {item.appointmentTime ? `, ${item.appointmentTime}` : ""}. (
              {reminderChannels})
            </li>
          ))}

          {!appointmentStatusNotifications.length &&
          (!vaccinationReminderEnabled || !vaccineReminders.length) &&
          !upcomingReminderAppointments.length ? (
            <li>No new notifications right now.</li>
          ) : null}
        </ul>
      </article>
    </div>
  );
}

function MyPetsPage({
  pets,
  onAddNewPet,
  onDeletePet,
  onUpdatePet,
  onUploadPetPhoto,
}) {
  const [editingPetId, setEditingPetId] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");
  const [uploadErrorPetId, setUploadErrorPetId] = useState("");
  const [uploadErrorMessage, setUploadErrorMessage] = useState("");

  const handleEditSubmit = async (event, petId) => {
    event.preventDefault();
    if (isSavingEdit) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const updates = {
      name: String(formData.get("name") || "").trim(),
      breed: String(formData.get("breed") || "").trim(),
      age: String(formData.get("age") || "").trim(),
      weight: String(formData.get("weight") || "").trim(),
      vaccinationStatus: String(formData.get("vaccinationStatus") || "").trim(),
    };

    if (
      !updates.name ||
      !updates.breed ||
      !updates.age ||
      !updates.weight ||
      !updates.vaccinationStatus
    ) {
      setEditError("All fields are required.");
      return;
    }

    try {
      setIsSavingEdit(true);
      setEditError("");
      await onUpdatePet(petId, updates);
      setEditingPetId("");
    } catch (requestError) {
      setEditError(requestError.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handlePhotoChange = async (event, petId) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const toDataUrl = (inputFile) =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Unable to read photo file."));
        reader.readAsDataURL(inputFile);
      });
    const compressImage = (inputFile) =>
      new Promise((resolve, reject) => {
        const imageUrl = URL.createObjectURL(inputFile);
        const image = new Image();
        image.onload = () => {
          const maxSize = 1200;
          const ratio = Math.min(
            1,
            maxSize / Math.max(image.width, image.height)
          );
          const width = Math.max(1, Math.round(image.width * ratio));
          const height = Math.max(1, Math.round(image.height * ratio));
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext("2d");
          if (!context) {
            URL.revokeObjectURL(imageUrl);
            reject(new Error("Unable to process photo file."));
            return;
          }
          context.drawImage(image, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
          URL.revokeObjectURL(imageUrl);
          resolve(dataUrl);
        };
        image.onerror = () => {
          URL.revokeObjectURL(imageUrl);
          reject(new Error("Unable to process photo file."));
        };
        image.src = imageUrl;
      });

    try {
      const photoDataUrl =
        file.size > 1024 * 1024
          ? await compressImage(file)
          : await toDataUrl(file);
      await onUploadPetPhoto(petId, photoDataUrl);
      setUploadErrorPetId("");
      setUploadErrorMessage("");
    } catch (requestError) {
      setUploadErrorPetId(petId);
      setUploadErrorMessage(
        requestError?.message || "Unable to upload pet photo."
      );
    } finally {
      event.currentTarget.value = "";
    }
  };

  return (
    <section className="po-mypets">
      <article className="po-card">
        <h3>My Pets</h3>
        <p className="po-mypets-subtitle">
          Add new pet, edit pet information, delete pet, upload pet photo, and
          review basic pet details.
        </p>
        <button
          type="button"
          className="po-mypets-add-btn"
          onClick={onAddNewPet}
        >
          Add New Pet
        </button>
      </article>

      {pets.length === 0 ? (
        <article className="po-card">
          <p className="po-mypets-subtitle">
            No pets added yet. Click "Add New Pet" to create your first pet
            profile.
          </p>
        </article>
      ) : (
        <div className="po-mypets-grid">
          {pets.map((pet) => (
            <article key={pet.id} className="po-card po-mypet-card">
              <h3>{pet.name}</h3>
              {pet.petPhoto ? (
                <img
                  className="po-pet-photo"
                  src={pet.petPhoto}
                  alt={`${pet.name} profile`}
                />
              ) : (
                <div
                  className="po-pet-photo po-pet-photo-placeholder"
                  aria-hidden="true"
                >
                  🐾
                </div>
              )}

              <div className="po-mypet-actions">
                <button
                  type="button"
                  onClick={() =>
                    setEditingPetId((current) =>
                      current === pet.id ? "" : pet.id
                    )
                  }
                >
                  Edit Pet Information
                </button>
                <button type="button" onClick={() => void onDeletePet(pet.id)}>
                  Delete Pet
                </button>
                <input
                  id={`po-upload-${pet.id}`}
                  type="file"
                  accept="image/*"
                  className="po-file-input-hidden"
                  onChange={(event) => void handlePhotoChange(event, pet.id)}
                />
                <button
                  type="button"
                  onClick={() =>
                    document.getElementById(`po-upload-${pet.id}`)?.click()
                  }
                >
                  Upload Pet Photo
                </button>
              </div>
              {uploadErrorPetId === pet.id && uploadErrorMessage ? (
                <p className="po-form-error">{uploadErrorMessage}</p>
              ) : null}

              {editingPetId === pet.id ? (
                <form
                  className="po-book-grid"
                  onSubmit={(event) => void handleEditSubmit(event, pet.id)}
                >
                  <label>
                    Name
                    <input
                      name="name"
                      type="text"
                      defaultValue={pet.name}
                      required
                    />
                  </label>
                  <label>
                    Breed
                    <input
                      name="breed"
                      type="text"
                      defaultValue={pet.breed}
                      required
                    />
                  </label>
                  <label>
                    Age
                    <input
                      name="age"
                      type="text"
                      defaultValue={pet.age}
                      required
                    />
                  </label>
                  <label>
                    Weight
                    <input
                      name="weight"
                      type="text"
                      defaultValue={pet.weight}
                      required
                    />
                  </label>
                  <label>
                    Vaccination Status
                    <select
                      name="vaccinationStatus"
                      defaultValue={pet.vaccinationStatus}
                      required
                    >
                      <option>Up to date</option>
                      <option>Pending</option>
                      <option>Booster due soon</option>
                    </select>
                  </label>
                  <div className="po-mypet-actions">
                    <button type="submit" disabled={isSavingEdit}>
                      {isSavingEdit ? "Saving..." : "Save Changes"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingPetId("")}
                      disabled={isSavingEdit}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : null}
              {editingPetId === pet.id && editError ? (
                <p className="po-form-error">{editError}</p>
              ) : null}

              <ul className="po-detail-list">
                <li>
                  <span>Name</span>
                  <strong>{pet.name}</strong>
                </li>
                <li>
                  <span>Breed</span>
                  <strong>{pet.breed}</strong>
                </li>
                <li>
                  <span>Age</span>
                  <strong>{pet.age}</strong>
                </li>
                <li>
                  <span>Weight</span>
                  <strong>{pet.weight}</strong>
                </li>
                <li>
                  <span>Vaccination Status</span>
                  <strong>{pet.vaccinationStatus}</strong>
                </li>
              </ul>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function AddPetPage({ onBackToPets, onSavePet }) {
  const PET_BREED_OPTIONS = [
    "Golden Retriever",
    "Labrador Retriever",
    "German Shepherd",
    "Poodle",
    "Bulldog",
    "Beagle",
    "Rottweiler",
    "Siberian Husky",
    "Pomeranian",
    "Shih Tzu",
    "Persian",
    "Siamese",
    "Maine Coon",
    "British Shorthair",
    "Bengal",
    "Mixed Breed",
    "Other",
  ];

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }
    const formData = new FormData(event.currentTarget);
    const newPet = {
      name: String(formData.get("petName") || "").trim(),
      breed: String(formData.get("breed") || "").trim(),
      age: String(formData.get("age") || "").trim(),
      weight: String(formData.get("weight") || "").trim(),
      vaccinationStatus: String(formData.get("vaccinationStatus") || "").trim(),
    };

    if (
      !newPet.name ||
      !newPet.breed ||
      !newPet.age ||
      !newPet.weight ||
      !newPet.vaccinationStatus
    ) {
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage("");
      await onSavePet(newPet);
      event.currentTarget.reset();
    } catch (requestError) {
      setErrorMessage(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="po-mypets">
      <article className="po-card">
        <h3>Add New Pet</h3>
        <p className="po-mypets-subtitle">
          Enter your pet details and save to your profile.
        </p>
      </article>

      <article className="po-card po-book-layout">
        <form className="po-book-grid" onSubmit={handleSubmit}>
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
            Breed
            <select name="breed" defaultValue="" required>
              <option value="" disabled>
                Select breed
              </option>
              {PET_BREED_OPTIONS.map((breed) => (
                <option key={breed} value={breed}>
                  {breed}
                </option>
              ))}
            </select>
          </label>
          <label>
            Age
            <input name="age" type="text" placeholder="e.g. 2 years" required />
          </label>
          <label>
            Weight
            <input name="weight" type="text" placeholder="e.g. 7 kg" required />
          </label>
          <label>
            Vaccination Status
            <select name="vaccinationStatus" defaultValue="Up to date" required>
              <option>Up to date</option>
              <option>Pending</option>
              <option>Booster due soon</option>
            </select>
          </label>
          <label>
            Upload Pet Photo
            <input type="file" accept="image/*" />
          </label>
          <div className="po-book-actions po-book-full">
            <button
              type="submit"
              className="po-record-download"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : "Save Pet"}
            </button>
            <button
              type="button"
              className="po-record-secondary"
              onClick={onBackToPets}
            >
              Back to My Pets
            </button>
          </div>
        </form>
        {errorMessage ? <p className="po-form-error">{errorMessage}</p> : null}
      </article>
    </section>
  );
}

function formatAppointmentDate(value) {
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
}

function AppointmentHistoryPage({
  appointments,
  onBookAppointment,
  onDeleteAppointment,
}) {
  const [selectedAppointmentId, setSelectedAppointmentId] = useState(
    appointments[0]?.id || ""
  );

  useEffect(() => {
    setSelectedAppointmentId((currentId) => {
      if (!appointments.length) {
        return "";
      }
      if (appointments.some((item) => item.id === currentId)) {
        return currentId;
      }
      return appointments[0].id;
    });
  }, [appointments]);

  const selectedAppointment =
    appointments.find((item) => item.id === selectedAppointmentId) || null;

  return (
    <section className="po-mypets">
      <article className="po-card">
        <h3>Appointment History</h3>
        <p className="po-mypets-subtitle">
          Track all appointments with doctor and status details.
        </p>
        <button
          type="button"
          className="po-mypets-add-btn"
          onClick={onBookAppointment}
        >
          Book New Appointment
        </button>
      </article>

      <article className="po-card">
        <div className="po-history-head">
          <span>Date</span>
          <span>Doctor Name</span>
          <span>Status</span>
          <span>Action</span>
        </div>

        <ul className="po-history-list">
          {appointments.map((item) => (
            <li key={item.id}>
              <span>
                {formatAppointmentDate(item.appointmentDate || item.date)}
              </span>
              <strong>{item.doctorName}</strong>
              <em
                className={`po-status po-status-${String(
                  item.status || "pending"
                ).toLowerCase()}`}
              >
                {item.status}
              </em>
              <div className="po-mypet-actions">
                <button
                  type="button"
                  onClick={() => setSelectedAppointmentId(item.id)}
                >
                  View Details
                </button>
                <button
                  type="button"
                  onClick={() => void onDeleteAppointment(item.id)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </article>

      {!appointments.length ? (
        <article className="po-card">
          <p className="po-mypets-subtitle">No appointments found yet.</p>
        </article>
      ) : null}

      {selectedAppointment ? (
        <article className="po-card po-appointment-details">
          <h3>Appointment Details</h3>
          <ul className="po-detail-list">
            <li>
              <span>Appointment ID</span>
              <strong>
                {formatAppointmentReference(selectedAppointment.id)}
              </strong>
              <p className="po-appointment-id">{selectedAppointment.id}</p>
            </li>
            <li>
              <span>Date</span>
              <strong>
                {formatAppointmentDate(
                  selectedAppointment.appointmentDate ||
                    selectedAppointment.date
                )}
              </strong>
            </li>
            <li>
              <span>Time</span>
              <strong>{selectedAppointment.appointmentTime}</strong>
            </li>
            <li>
              <span>Pet</span>
              <strong>{selectedAppointment.petName}</strong>
            </li>
            <li>
              <span>Doctor</span>
              <strong>{selectedAppointment.doctorName}</strong>
            </li>
            <li>
              <span>Status</span>
              <strong>{selectedAppointment.status}</strong>
            </li>
            <li>
              <span>Reason</span>
              <strong>{selectedAppointment.reason}</strong>
            </li>
          </ul>
        </article>
      ) : null}
    </section>
  );
}

function BookAppointmentPage({
  pets,
  doctors,
  ownerId,
  ownerName,
  onViewHistory,
  onAppointmentBooked,
}) {
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    if (!pets.length) {
      setErrorMessage("Add a pet first before booking an appointment.");
      return;
    }
    if (!doctors.length) {
      setErrorMessage("No doctor accounts found. Please contact staff.");
      return;
    }

    const body = {
      ownerId: String(ownerId || "").trim(),
      ownerName: String(ownerName || "").trim(),
      petName: String(formData.get("petName") || "").trim(),
      doctorName: String(formData.get("doctorName") || "").trim(),
      appointmentDate: String(formData.get("appointmentDate") || "").trim(),
      appointmentTime: String(formData.get("appointmentTime") || "").trim(),
      reason: String(formData.get("reason") || "").trim(),
    };
    if (!body.ownerId) {
      setErrorMessage("Please log in again before booking an appointment.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage("");
      setStatusMessage("");
      const response = await createAppointment(body);
      if (response?.appointment) {
        onAppointmentBooked(response.appointment);
      }
      setStatusMessage("Appointment booked successfully.");
      formElement.reset();
      onViewHistory();
    } catch (requestError) {
      setErrorMessage(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="po-mypets">
      <article className="po-card">
        <h3>Book Appointment</h3>
        <p className="po-mypets-subtitle">
          Select pet, doctor, date, and reason for visit to book an appointment.
        </p>
        {!pets.length ? (
          <p className="po-form-error">
            No pets found in your account. Please add a pet first.
          </p>
        ) : null}
        {!doctors.length ? (
          <p className="po-form-error">
            No doctor accounts found. Please contact staff.
          </p>
        ) : null}
      </article>

      <article className="po-card po-book-layout">
        <form className="po-book-grid" onSubmit={handleSubmit}>
          <label>
            Pet
            <select
              name="petName"
              defaultValue={pets[0]?.name || ""}
              required
              disabled={!pets.length || isSubmitting}
            >
              {pets.map((pet) => (
                <option key={pet.id} value={pet.name}>
                  {pet.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Doctor
            <select
              name="doctorName"
              defaultValue={doctors[0]?.name || ""}
              required
              disabled={isSubmitting || !doctors.length}
            >
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.name}>
                  {doctor.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Date
            <input
              name="appointmentDate"
              type="date"
              required
              disabled={isSubmitting}
            />
          </label>
          <label>
            Time
            <input
              name="appointmentTime"
              type="time"
              required
              disabled={isSubmitting}
            />
          </label>
          <label className="po-book-full">
            Reason for Visit
            <textarea
              name="reason"
              rows="4"
              placeholder="Describe symptoms or reason for appointment"
              required
              disabled={isSubmitting}
            />
          </label>

          <div className="po-book-actions po-book-full">
            <button
              type="submit"
              className="po-record-download"
              disabled={isSubmitting || !pets.length || !doctors.length}
            >
              {isSubmitting ? "Booking..." : "Confirm Booking"}
            </button>
            <button
              type="button"
              className="po-record-secondary"
              onClick={onViewHistory}
            >
              View Appointment History
            </button>
          </div>
        </form>

        {statusMessage ? (
          <p className="po-form-success">{statusMessage}</p>
        ) : null}
        {errorMessage ? <p className="po-form-error">{errorMessage}</p> : null}
      </article>
    </section>
  );
}

function MedicalRecordsPage({
  pets,
  appointments,
  medicalRecords,
  vaccinationRecords,
}) {
  const [petFilter, setPetFilter] = useState("All Pets");
  const [recordTypeFilter, setRecordTypeFilter] = useState("All Types");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecordId, setSelectedRecordId] = useState(
    appointments[0]?.id || ""
  );
  const searchQuery = String(searchTerm || "")
    .trim()
    .toLowerCase();
  const filteredRecords = appointments.filter((item) => {
    if (petFilter !== "All Pets" && item.petName !== petFilter) {
      return false;
    }

    const reason = String(item.reason || "").toLowerCase();
    if (recordTypeFilter !== "All Types" && !reason) {
      return false;
    }

    const typeMatches =
      recordTypeFilter === "All Types" ||
      recordTypeFilter === "Diagnosis" ||
      recordTypeFilter === "Prescription" ||
      recordTypeFilter === "Lab Result" ||
      recordTypeFilter === "Vaccination";

    if (!typeMatches) {
      return false;
    }

    if (!searchQuery) {
      return true;
    }

    const haystack = [
      item.id,
      item.petName,
      item.doctorName,
      item.reason,
      item.status,
      item.appointmentDate,
      item.appointmentTime,
    ]
      .map((value) => String(value || "").toLowerCase())
      .join(" ");
    return haystack.includes(searchQuery);
  });

  const selectedRecord =
    filteredRecords.find((item) => item.id === selectedRecordId) || null;
  const vaccinationSchedules = getVaccinationSchedules(pets, vaccinationRecords);
  const vaccineTimelineEntries = vaccinationRecords
    .filter((record) => {
      if (petFilter === "All Pets") {
        return true;
      }
      const matchedPet = pets.find((pet) => pet.id === record.petId);
      return matchedPet?.name === petFilter;
    })
    .map((record) => {
      const eventDate = parseDateValue(record.dateGiven);
      return {
        ...record,
        eventDate,
      };
    })
    .sort((a, b) => (b.eventDate?.getTime() || 0) - (a.eventDate?.getTime() || 0));
  const latestMedicalRecord = [...medicalRecords]
    .map((record) => ({
      ...record,
      eventDate:
        parseDateValue(record.recordDate) ||
        parseDateValue(record.createdAt) ||
        parseDateValue(record.updatedAt),
    }))
    .sort((a, b) => (b.eventDate?.getTime() || 0) - (a.eventDate?.getTime() || 0))[0];
  const nextVaccineDue = [...vaccinationSchedules]
    .filter((item) => item.nextDueDate)
    .sort((a, b) => (a.nextDueDate?.getTime() || 0) - (b.nextDueDate?.getTime() || 0))[0];

  useEffect(() => {
    setSelectedRecordId((currentId) => {
      if (!filteredRecords.length) {
        return "";
      }
      if (filteredRecords.some((item) => item.id === currentId)) {
        return currentId;
      }
      return filteredRecords[0].id;
    });
  }, [filteredRecords]);
  const buildRecordLines = (record) => [
    "Pet Medical Record",
    "",
    `Appointment: ${formatAppointmentReference(record.id)}`,
    `Full ID: ${record.id}`,
    `Pet: ${record.petName}`,
    `Doctor: ${record.doctorName}`,
    `Date: ${formatAppointmentDate(record.appointmentDate || record.date)}`,
    `Time: ${record.appointmentTime || "-"}`,
    `Status: ${record.status || "-"}`,
    `Reason: ${record.reason || "-"}`,
  ];

  const handleDownloadPdf = () => {
    if (!selectedRecord) {
      return;
    }

    const sanitize = (value) =>
      String(value || "").replace(/[^\x20-\x7E]/g, "?");
    const escapePdf = (value) =>
      sanitize(value)
        .replace(/\\/g, "\\\\")
        .replace(/\(/g, "\\(")
        .replace(/\)/g, "\\)");
    const lines = buildRecordLines(selectedRecord);
    const textCommands = lines
      .map(
        (line, index) =>
          `1 0 0 1 50 ${780 - index * 20} Tm (${escapePdf(line)}) Tj`
      )
      .join("\n");
    const stream = `BT\n/F1 12 Tf\n${textCommands}\nET`;
    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    const addObj = (id, content) => {
      offsets[id] = pdf.length;
      pdf += `${id} 0 obj\n${content}\nendobj\n`;
    };
    addObj(1, "<< /Type /Catalog /Pages 2 0 R >>");
    addObj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
    addObj(
      3,
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>"
    );
    addObj(4, `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    addObj(5, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    const startXref = pdf.length;
    pdf += `xref\n0 6\n0000000000 65535 f \n`;
    for (let i = 1; i <= 5; i += 1) {
      pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF`;

    const blob = new Blob([pdf], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `medical-record-${formatAppointmentReference(
      selectedRecord.id
    )}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handlePrintRecord = () => {
    if (!selectedRecord) {
      return;
    }
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      return;
    }
    const lines = buildRecordLines(selectedRecord);
    printWindow.document.write(
      `<html><head><title>Medical Record</title></head><body><pre style="font-family: Arial, sans-serif; font-size: 14px;">${lines.join(
        "\n"
      )}</pre></body></html>`
    );
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <section className="po-mypets">
      <article className="po-card">
        <h3>Medical Records</h3>
        <p className="po-mypets-subtitle">
          View diagnosis, prescriptions, lab results, and vaccination history by
          visit.
        </p>
      </article>

      <section className="po-medical-layout">
        <article className="po-card po-medical-summary">
          <div className="po-medical-stat">
            <p>Total Records</p>
            <strong>{medicalRecords.length || appointments.length}</strong>
          </div>
          <div className="po-medical-stat">
            <p>Last Updated</p>
            <strong>
              {latestMedicalRecord
                ? formatAppointmentDate(
                    latestMedicalRecord.recordDate || latestMedicalRecord.createdAt
                  )
                : "-"}
            </strong>
          </div>
          <div className="po-medical-stat">
            <p>Upcoming Vaccine</p>
            <strong>
              {nextVaccineDue
                ? `${nextVaccineDue.petName} (${nextVaccineDue.reminderStatusLabel}${
                    nextVaccineDue.nextDueDate ? `: ${nextVaccineDue.nextDueDateLabel}` : ""
                  })`
                : "No vaccine schedule data"}
            </strong>
          </div>
        </article>

        <article className="po-card">
          <h3>Find Records</h3>
          <div className="po-medical-filters">
            <label>
              Pet
              <select
                value={petFilter}
                onChange={(event) => setPetFilter(event.target.value)}
              >
                <option>All Pets</option>
                {pets.map((pet) => (
                  <option key={pet.id} value={pet.name}>
                    {pet.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Record Type
              <select
                value={recordTypeFilter}
                onChange={(event) => setRecordTypeFilter(event.target.value)}
              >
                <option>All Types</option>
                <option>Diagnosis</option>
                <option>Prescription</option>
                <option>Lab Result</option>
                <option>Vaccination</option>
              </select>
            </label>
            <label>
              Search
              <input
                type="text"
                placeholder="Search by doctor, diagnosis, or ID"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </label>
          </div>
        </article>

        <article className="po-card">
          <h3>Vaccine History Timeline</h3>
          {!vaccineTimelineEntries.length ? (
            <p className="po-mypets-subtitle">
              No vaccination entries found in medical records yet.
            </p>
          ) : (
            <ul className="po-note-list">
              {vaccineTimelineEntries.slice(0, 12).map((record) => (
                <li key={`vax-timeline-${record.id}`}>
                  {formatAppointmentDate(record.dateGiven)}:{" "}
                  <strong>
                    {pets.find((pet) => pet.id === record.petId)?.name ||
                      record.petId}
                  </strong>{" "}
                  received <strong>{record.vaccineName}</strong>.
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="po-card">
          <h3>Recent Visits</h3>
          {!filteredRecords.length ? (
            <p className="po-mypets-subtitle">
              No medical visit records found in your account.
            </p>
          ) : (
            <ul className="po-medical-visit-list">
              {filteredRecords.map((visit) => (
                <li key={visit.id}>
                  <div>
                    <strong>{formatAppointmentReference(visit.id)}</strong>
                    <p className="po-appointment-id">{visit.id}</p>
                    <p>
                      {formatAppointmentDate(
                        visit.appointmentDate || visit.date
                      )}{" "}
                      | {visit.petName} | {visit.doctorName}
                    </p>
                    <p>{visit.reason}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedRecordId(visit.id)}
                  >
                    View Details
                  </button>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="po-card">
          <h3>Record Details</h3>
          {selectedRecord ? (
            <ul className="po-record-list">
              <li>
                <h4>Appointment ID</h4>
                <p>{formatAppointmentReference(selectedRecord.id)}</p>
                <p className="po-appointment-id">{selectedRecord.id}</p>
              </li>
              <li>
                <h4>Pet</h4>
                <p>{selectedRecord.petName}</p>
              </li>
              <li>
                <h4>Doctor</h4>
                <p>{selectedRecord.doctorName}</p>
              </li>
              <li>
                <h4>Date & Time</h4>
                <p>
                  {formatAppointmentDate(
                    selectedRecord.appointmentDate || selectedRecord.date
                  )}
                  {selectedRecord.appointmentTime
                    ? `, ${selectedRecord.appointmentTime}`
                    : ""}
                </p>
              </li>
              <li>
                <h4>Status</h4>
                <p>{selectedRecord.status}</p>
              </li>
              <li>
                <h4>Reason</h4>
                <p>{selectedRecord.reason}</p>
              </li>
            </ul>
          ) : (
            <p className="po-mypets-subtitle">
              Select a visit to view details.
            </p>
          )}
          <div className="po-record-actions">
            <button
              type="button"
              className="po-record-download"
              onClick={handleDownloadPdf}
              disabled={!selectedRecord}
            >
              Download PDF
            </button>
            <button
              type="button"
              className="po-record-secondary"
              onClick={handlePrintRecord}
              disabled={!selectedRecord}
            >
              Print
            </button>
          </div>
        </article>
      </section>
    </section>
  );
}

function ProfilePage({
  profile,
  onSaveProfile,
  onSaveNotifications,
  onChangePassword,
  onToggleTwoFactor,
  isSavingProfile,
  isSavingNotifications,
  isChangingPassword,
  profileError,
  profileStatus,
  notificationError,
  notificationStatus,
  passwordError,
  passwordStatus,
}) {
  const handleSubmit = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    let profilePhoto = String(profile?.profilePhoto || "");
    const photoFile = formData.get("profilePhoto");
    if (photoFile instanceof File && photoFile.size > 0) {
      profilePhoto = await compressImageFileToDataUrl(photoFile);
    }
    await onSaveProfile({
      name: String(formData.get("name") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      address: String(formData.get("address") || "").trim(),
      preferredContact: String(formData.get("preferredContact") || "Email"),
      profilePhoto,
    });
  };

  const handleNotificationSubmit = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await onSaveNotifications({
      appointmentRequestAlerts:
        formData.get("appointmentRequestAlerts") === "on",
      paymentConfirmationAlerts:
        formData.get("paymentConfirmationAlerts") === "on",
      doctorScheduleChanges: formData.get("doctorScheduleChanges") === "on",
      weeklyPerformanceSummary:
        formData.get("weeklyPerformanceSummary") === "on",
    });
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await onChangePassword({
      currentPassword: String(formData.get("currentPassword") || ""),
      newPassword: String(formData.get("newPassword") || ""),
    });
    event.currentTarget.reset();
  };

  return (
    <section className="po-mypets">
      <article className="po-card">
        <h3>Profile</h3>
        <p className="po-mypets-subtitle">
          Manage your account settings and preferences.
        </p>
      </article>

      <section className="po-profile-layout">
        <article className="po-card po-profile-summary">
          <div className="po-profile-avatar" aria-hidden="true">
            {profile?.profilePhoto ? (
              <img src={profile.profilePhoto} alt="Profile" />
            ) : (
              profile?.name?.slice(0, 2).toUpperCase() || "PO"
            )}
          </div>
          <div>
            <h4>{profile?.name || "User"}</h4>
            <p>{profile?.role || "pet-owner"}</p>
            <p>User ID: {profile?.id || "-"}</p>
          </div>
          <span className="po-profile-badge">Active</span>
        </article>

        <article className="po-card">
          <h3>Personal Information</h3>
          <form
            className="po-profile-form"
            onSubmit={handleSubmit}
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
              Email Address
              <input type="email" value={profile?.email || ""} readOnly />
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
              Profile Photo
              <input name="profilePhoto" type="file" accept="image/*" />
            </label>
            <label className="po-profile-full">
              Address
              <input
                name="address"
                type="text"
                defaultValue={profile?.address || ""}
              />
            </label>
            <button
              type="submit"
              className="po-profile-save"
              disabled={isSavingProfile}
            >
              {isSavingProfile ? "Saving..." : "Save Profile Changes"}
            </button>
          </form>
          {profileStatus ? (
            <p className="po-form-success">{profileStatus}</p>
          ) : null}
          {profileError ? (
            <p className="po-form-error">{profileError}</p>
          ) : null}
        </article>

        <article className="po-card">
          <h3>Notification Preferences</h3>
          <p>Choose which updates you want to receive.</p>
          <form className="po-pref-list" onSubmit={handleNotificationSubmit}>
            <label>
              <input
                name="appointmentRequestAlerts"
                type="checkbox"
                defaultChecked={Boolean(
                  profile?.notificationPreferences?.appointmentRequestAlerts
                )}
              />
              Appointment request alerts
            </label>
            <label>
              <input
                name="paymentConfirmationAlerts"
                type="checkbox"
                defaultChecked={Boolean(
                  profile?.notificationPreferences?.paymentConfirmationAlerts
                )}
              />
              Payment confirmation alerts
            </label>
            <label>
              <input
                name="doctorScheduleChanges"
                type="checkbox"
                defaultChecked={Boolean(
                  profile?.notificationPreferences?.doctorScheduleChanges
                )}
              />
              Doctor schedule changes
            </label>
            <label>
              <input
                name="weeklyPerformanceSummary"
                type="checkbox"
                defaultChecked={Boolean(
                  profile?.notificationPreferences?.weeklyPerformanceSummary
                )}
              />
              Weekly performance summary
            </label>
            <button
              type="submit"
              className="po-profile-save"
              disabled={isSavingNotifications}
            >
              {isSavingNotifications
                ? "Saving..."
                : "Save Notification Preferences"}
            </button>
          </form>
          {notificationStatus ? (
            <p className="po-form-success">{notificationStatus}</p>
          ) : null}
          {notificationError ? (
            <p className="po-form-error">{notificationError}</p>
          ) : null}
        </article>

        <article className="po-card">
          <h3>Security & Account</h3>
          <form className="po-profile-form" onSubmit={handlePasswordSubmit}>
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
              className="po-profile-save"
              disabled={isChangingPassword}
            >
              {isChangingPassword ? "Updating..." : "Change Password"}
            </button>
          </form>
          {passwordStatus ? (
            <p className="po-form-success">{passwordStatus}</p>
          ) : null}
          {passwordError ? (
            <p className="po-form-error">{passwordError}</p>
          ) : null}
          <div className="po-security-actions">
            <label>
              <input
                type="checkbox"
                checked={Boolean(profile?.twoFactorEnabled)}
                onChange={(event) => onToggleTwoFactor(event.target.checked)}
              />
              Enable Two-Factor Authentication
            </label>
          </div>
        </article>
      </section>
    </section>
  );
}

export default function PetOwnerDashboard({ role, currentUser, onLogout }) {
  const [activePage, setActivePage] = useState("Dashboard");
  const [pets, setPets] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [vaccinationRecords, setVaccinationRecords] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [profile, setProfile] = useState(currentUser || null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileStatus, setProfileStatus] = useState("");
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const [notificationStatus, setNotificationStatus] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordStatus, setPasswordStatus] = useState("");
  const isPetOwner = role === "pet-owner" || !role;
  const currentUserId = String(currentUser?.id || "").trim();
  const currentUserName = String(profile?.name || currentUser?.name || "")
    .trim()
    .toLowerCase();

  const isAppointmentOwnedByCurrentUser = (item) => {
    const ownerId = String(item?.ownerId || item?.userId || "").trim();
    if (ownerId && currentUserId) {
      return ownerId === currentUserId;
    }

    const ownerName = String(item?.ownerName || "")
      .trim()
      .toLowerCase();
    const reason = String(item?.reason || "").toLowerCase();
    const isWalkIn = reason.includes("walk-in");
    return Boolean(
      currentUserName && ownerName && ownerName === currentUserName && !isWalkIn
    );
  };

  useEffect(() => {
    let cancelled = false;

    const loadPets = async () => {
      if (!currentUser?.id) {
        if (!cancelled) {
          setPets([]);
        }
        return;
      }
      try {
        const response = await listPets({ userId: currentUser.id });
        if (!cancelled) {
          setPets(Array.isArray(response?.pets) ? response.pets : []);
        }
      } catch (_error) {
        if (!cancelled) {
          setPets([]);
        }
      }
    };

    loadPets();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

  useEffect(() => {
    let cancelled = false;

    const loadAppointments = async () => {
      if (!currentUser?.id) {
        if (!cancelled) {
          setAppointments([]);
        }
        return;
      }
      try {
        const response = await listAppointments({ userId: currentUser.id });
        if (!cancelled) {
          const fetched = Array.isArray(response?.appointments)
            ? response.appointments
            : [];
          setAppointments(fetched.filter(isAppointmentOwnedByCurrentUser));
        }
      } catch (_error) {
        if (!cancelled) {
          setAppointments([]);
        }
      }
    };

    loadAppointments();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, currentUser?.name, profile?.name]);

  useEffect(() => {
    let cancelled = false;

    const loadMedicalRecordsForOwnedPets = async () => {
      if (!currentUser?.id) {
        if (!cancelled) {
          setMedicalRecords([]);
        }
        return;
      }

      if (!pets.length) {
        if (!cancelled) {
          setMedicalRecords([]);
        }
        return;
      }

      try {
        const response = await listMedicalRecords();
        const records = Array.isArray(response?.records) ? response.records : [];
        const petIdSet = new Set(pets.map((pet) => String(pet.id || "")));
        const petNameSet = new Set(pets.map((pet) => String(pet.name || "")));
        const ownerNameLower = String(profile?.name || currentUser?.name || "")
          .trim()
          .toLowerCase();
        const filtered = records.filter((record) => {
          const recordPetId = String(record.petId || "");
          const recordPetName = String(record.petName || "");
          const recordOwnerName = String(record.ownerName || "")
            .trim()
            .toLowerCase();
          if (recordPetId && petIdSet.has(recordPetId)) {
            return true;
          }
          if (recordPetName && petNameSet.has(recordPetName)) {
            if (!ownerNameLower) {
              return true;
            }
            return !recordOwnerName || recordOwnerName === ownerNameLower;
          }
          return false;
        });
        if (!cancelled) {
          setMedicalRecords(filtered);
        }
      } catch (_error) {
        if (!cancelled) {
          setMedicalRecords([]);
        }
      }
    };

    loadMedicalRecordsForOwnedPets();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, currentUser?.name, profile?.name, pets]);

  useEffect(() => {
    let cancelled = false;

    const loadVaccinationRecordsForOwnedPets = async () => {
      if (!pets.length) {
        if (!cancelled) {
          setVaccinationRecords([]);
        }
        return;
      }
      try {
        const petIds = pets.map((pet) => String(pet.id || "")).filter(Boolean);
        const response = await listVaccinations({ petIds: petIds.join(",") });
        if (!cancelled) {
          setVaccinationRecords(
            Array.isArray(response?.vaccinations) ? response.vaccinations : []
          );
        }
      } catch (_error) {
        if (!cancelled) {
          setVaccinationRecords([]);
        }
      }
    };

    loadVaccinationRecordsForOwnedPets();
    return () => {
      cancelled = true;
    };
  }, [pets]);

  useEffect(() => {
    let cancelled = false;

    const loadDoctors = async () => {
      try {
        const response = await listUsers({ role: "doctor" });
        if (!cancelled) {
          setDoctors(Array.isArray(response?.users) ? response.users : []);
        }
      } catch (_error) {
        if (!cancelled) {
          setDoctors([]);
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

  const handleSavePet = async (newPet) => {
    const response = await createPet({
      ...newPet,
      ownerId: currentUser?.id || "",
      ownerName: currentUser?.name || "",
    });
    const createdPet = response?.pet;
    if (createdPet) {
      setPets((currentPets) => [createdPet, ...currentPets]);
    }
    setActivePage("My Pets");
  };

  const handleDeletePet = async (petId) => {
    await deletePetById(petId, { userId: currentUser?.id || "" });
    setPets((currentPets) => currentPets.filter((pet) => pet.id !== petId));
  };

  const handleUpdatePet = async (petId, updates) => {
    const response = await updatePetById(petId, updates, {
      userId: currentUser?.id || "",
      auditActorId: currentUser?.id || "",
      auditActorName: currentUser?.name || "",
      auditActorRole: "pet-owner",
    });
    const updatedPet = response?.pet;
    if (updatedPet) {
      setPets((currentPets) =>
        currentPets.map((pet) => (pet.id === updatedPet.id ? updatedPet : pet))
      );
    }
  };

  const handleUploadPetPhoto = async (petId, photoDataUrl) => {
    await handleUpdatePet(petId, { petPhoto: photoDataUrl });
  };

  const handleAppointmentBooked = (appointment) => {
    if (!isAppointmentOwnedByCurrentUser(appointment)) {
      return;
    }
    setAppointments((currentItems) => [appointment, ...currentItems]);
    setActivePage("Appointment History");
  };

  const handleDeleteAppointment = async (appointmentId) => {
    const confirmed = window.confirm("Delete this appointment history?");
    if (!confirmed) {
      return;
    }
    await deleteAppointmentById(appointmentId, {
      userId: currentUser?.id || "",
    });
    setAppointments((currentItems) =>
      currentItems.filter((item) => item.id !== appointmentId)
    );
  };

  const handleSaveProfile = async (updates) => {
    if (!profile?.id) {
      setProfileError("Please log in again to update profile.");
      return;
    }

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

  const handleSaveNotifications = async (notificationPreferences) => {
    if (!profile?.id) {
      setNotificationError(
        "Please log in again to update notification preferences."
      );
      return;
    }

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

  const handleChangePassword = async ({ currentPassword, newPassword }) => {
    if (!profile?.id) {
      setPasswordError("Please log in again to change password.");
      return;
    }

    try {
      setIsChangingPassword(true);
      setPasswordError("");
      setPasswordStatus("");
      await changeUserPassword(profile.id, { currentPassword, newPassword });
      setPasswordStatus("Password updated successfully.");
    } catch (requestError) {
      setPasswordError(requestError.message);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleToggleTwoFactor = async (enabled) => {
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

  return (
    <main className="po-screen">
      <section className="po-stage">
        <header className="po-hero">
          <div className="po-hero-dots" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
          <p className="po-hero-subtitle">Pet Owner Dashboard</p>
        </header>

        <section className="po-panel">
          <aside className="po-sidebar">
            <img className="po-mini-logo" src={logo} alt="PawEver logo" />
            <p className="po-sidebar-brand">PawEver</p>
            <nav aria-label="Pet owner navigation">
              {SIDEBAR_ITEMS.map((item) => (
                <button
                  key={item.id}
                  className={`po-side-link${
                    activePage === item.id ? " is-active" : ""
                  }`}
                  type="button"
                  onClick={() => setActivePage(item.id)}
                >
                  <span aria-hidden="true">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </nav>
          </aside>

          <div className="po-main">
            <div className="po-main-top">
              <button
                className="po-add-pet"
                type="button"
                onClick={() => setActivePage("Book Appointment")}
              >
                Book Appointment
              </button>
              <button
                className="po-add-pet"
                type="button"
                onClick={() => setActivePage("Add Pet")}
              >
                Add Pet
              </button>
              <button className="po-profile" type="button" onClick={onLogout}>
                <strong>Logout</strong>
              </button>
            </div>

            {isPetOwner ? (
              activePage === "Queue Status" ? (
                <QueuePage currentUser={currentUser} pets={pets} />
              ) : activePage === "Dashboard" ? (
                <DashboardCards
                  pets={pets}
                  appointments={appointments}
                  vaccinationRecords={vaccinationRecords}
                  profile={profile}
                  onBookAppointment={() => setActivePage("Book Appointment")}
                  onAddPet={() => setActivePage("Add Pet")}
                />
              ) : activePage === "Book Appointment" ? (
                <BookAppointmentPage
                  pets={pets}
                  doctors={doctors}
                  ownerId={profile?.id || currentUser?.id || ""}
                  ownerName={profile?.name || currentUser?.name || ""}
                  onViewHistory={() => setActivePage("Appointment History")}
                  onAppointmentBooked={handleAppointmentBooked}
                />
              ) : activePage === "Add Pet" ? (
                <AddPetPage
                  onBackToPets={() => setActivePage("My Pets")}
                  onSavePet={handleSavePet}
                />
              ) : activePage === "My Pets" ? (
                <MyPetsPage
                  pets={pets}
                  onAddNewPet={() => setActivePage("Add Pet")}
                  onDeletePet={handleDeletePet}
                  onUpdatePet={handleUpdatePet}
                  onUploadPetPhoto={handleUploadPetPhoto}
                />
              ) : activePage === "Appointment History" ? (
                <AppointmentHistoryPage
                  appointments={appointments}
                  onBookAppointment={() => setActivePage("Book Appointment")}
                  onDeleteAppointment={handleDeleteAppointment}
                />
              ) : activePage === "Medical Records" ? (
                <MedicalRecordsPage
                  pets={pets}
                  appointments={appointments}
                  medicalRecords={medicalRecords}
                  vaccinationRecords={vaccinationRecords}
                />
              ) : activePage === "Profile" ? (
                <ProfilePage
                  profile={profile}
                  onSaveProfile={handleSaveProfile}
                  onSaveNotifications={handleSaveNotifications}
                  onChangePassword={handleChangePassword}
                  onToggleTwoFactor={handleToggleTwoFactor}
                  isSavingProfile={isSavingProfile}
                  isSavingNotifications={isSavingNotifications}
                  isChangingPassword={isChangingPassword}
                  profileError={profileError}
                  profileStatus={profileStatus}
                  notificationError={notificationError}
                  notificationStatus={notificationStatus}
                  passwordError={passwordError}
                  passwordStatus={passwordStatus}
                />
              ) : (
                <section className="po-placeholder">
                  <h2>{activePage}</h2>
                  <p>
                    {PAGE_DESCRIPTIONS[activePage] ||
                      "This section is ready for your next feature."}
                  </p>
                </section>
              )
            ) : (
              <section className="po-placeholder">
                <h2>Access Limited</h2>
                <p>
                  Pet Owner pages are available only for the Pet Owner role.
                </p>
              </section>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
