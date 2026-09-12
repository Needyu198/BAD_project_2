import { User } from "../models/User.js";
import bcrypt from "bcryptjs";
import { Appointment } from "../models/Appointment.js";
import { getPetModel } from "../config/petDb.js";

function normalizeNotificationPreferences(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    appointmentReminders: source.appointmentReminders ?? true,
    vaccinationReminders: source.vaccinationReminders ?? true,
    medicalRecordUpdates: source.medicalRecordUpdates ?? true,
    promotionalUpdates: source.promotionalUpdates ?? false,
    appointmentRequestAlerts: source.appointmentRequestAlerts ?? true,
    paymentConfirmationAlerts: source.paymentConfirmationAlerts ?? true,
    doctorScheduleChanges: source.doctorScheduleChanges ?? true,
    weeklyPerformanceSummary: source.weeklyPerformanceSummary ?? false,
  };
}

function serializeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone || "",
    address: user.address || "",
    preferredContact: user.preferredContact || "Email",
    notificationPreferences: normalizeNotificationPreferences(
      user.notificationPreferences
    ),
    twoFactorEnabled: Boolean(user.twoFactorEnabled),
    workingDays: user.workingDays || "",
    workingHours: user.workingHours || "",
    breakTime: user.breakTime || "",
    profilePhoto: user.profilePhoto || "",
  };
}

export async function listUsers(req, res) {
  const role = String(req.query.role || "").trim();
  const query = role ? { role } : {};
  const users = await User.find(query).sort({ name: 1 }).limit(500);

  return res.status(200).json({
    users: users.map((user) => serializeUser(user)),
  });
}

export async function getUserProfile(req, res) {
  const { userId } = req.params;

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  return res.status(200).json({ user: serializeUser(user) });
}

export async function updateUserProfile(req, res) {
  const { userId } = req.params;
  const {
    name,
    phone,
    address,
    preferredContact,
    notificationPreferences,
    twoFactorEnabled,
    workingDays,
    workingHours,
    breakTime,
    profilePhoto,
  } = req.body;

  const updates = {};
  if (name !== undefined) {
    updates.name = String(name).trim();
  }
  if (phone !== undefined) {
    updates.phone = String(phone).trim();
  }
  if (address !== undefined) {
    updates.address = String(address).trim();
  }
  if (preferredContact !== undefined) {
    updates.preferredContact = preferredContact;
  }
  if (notificationPreferences !== undefined) {
    updates.notificationPreferences = normalizeNotificationPreferences(
      notificationPreferences
    );
  }
  if (twoFactorEnabled !== undefined) {
    updates.twoFactorEnabled = Boolean(twoFactorEnabled);
  }
  if (workingDays !== undefined) {
    updates.workingDays = String(workingDays).trim();
  }
  if (workingHours !== undefined) {
    updates.workingHours = String(workingHours).trim();
  }
  if (breakTime !== undefined) {
    updates.breakTime = String(breakTime).trim();
  }
  if (profilePhoto !== undefined) {
    updates.profilePhoto = String(profilePhoto || "").trim();
  }

  const user = await User.findByIdAndUpdate(userId, updates, {
    new: true,
    runValidators: true,
  });

  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  return res.status(200).json({ user: serializeUser(user) });
}

export async function changeUserPassword(req, res) {
  const { userId } = req.params;
  const currentPassword = String(req.body.currentPassword || "");
  const newPassword = String(req.body.newPassword || "");

  if (!currentPassword || !newPassword) {
    return res
      .status(400)
      .json({ message: "Current password and new password are required." });
  }
  if (newPassword.length < 8) {
    return res
      .status(400)
      .json({ message: "New password must be at least 8 characters." });
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  const isPasswordValid = await bcrypt.compare(
    currentPassword,
    user.passwordHash
  );
  if (!isPasswordValid) {
    return res.status(401).json({ message: "Current password is incorrect." });
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();

  return res.status(200).json({ message: "Password updated successfully." });
}

export async function deleteUser(req, res) {
  const { userId } = req.params;

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }
  if (user.role !== "pet-owner") {
    return res
      .status(400)
      .json({ message: "Only pet-owner accounts can be removed here." });
  }

  const Pet = await getPetModel();
  const ownerName = String(user.name || "").trim();
  const deleteByOwner = ownerName
    ? { $or: [{ ownerId: userId }, { ownerName }] }
    : { ownerId: userId };

  await Promise.all([
    Pet.deleteMany(deleteByOwner),
    Appointment.deleteMany(deleteByOwner),
  ]);
  await User.findByIdAndDelete(userId);

  return res.status(200).json({ message: "Pet owner removed successfully." });
}
