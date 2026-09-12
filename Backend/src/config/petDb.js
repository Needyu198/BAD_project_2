import { Pet } from '../models/Pet.js'
import { Vaccination } from '../models/Vaccination.js'
import { DoctorSchedule } from '../models/DoctorSchedule.js'
import { BillingRecord } from '../models/BillingRecord.js'
import { MedicalRecord } from '../models/MedicalRecord.js'
import { Prescription } from '../models/Prescription.js'
import { ReportAnalyticsSnapshot } from '../models/ReportAnalyticsSnapshot.js'

export async function getPetDatabaseConnection() {
  const models = {
    Pet,
    Vaccination,
    DoctorSchedule,
    BillingRecord,
    MedicalRecord,
    Prescription,
    ReportAnalyticsSnapshot,
  }
  return {
    models,
    model(name) {
      return models[name]
    },
  }
}

export async function getPetModel() {
  return Pet
}

export async function getVaccinationModel() {
  return Vaccination
}
