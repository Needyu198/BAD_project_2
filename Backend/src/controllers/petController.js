import { getPetModel } from '../config/petDb.js'
import { getActorFromRequest, recordActivityLog } from '../lib/activityLog.js'

function normalizeText(value) {
  return String(value || '').trim()
}

function serializePet(pet) {
  return {
    id: pet.id,
    ownerId: pet.ownerId,
    ownerName: pet.ownerName || '',
    name: pet.name,
    breed: pet.breed,
    age: pet.age,
    weight: pet.weight,
    vaccinationStatus: pet.vaccinationStatus,
    petPhoto: pet.petPhoto || '',
    lastPrescriptionSummary: pet.lastPrescriptionSummary || '',
    lastPrescriptionAt: pet.lastPrescriptionAt || '',
    createdAt: pet.createdAt,
  }
}

export async function listPets(req, res) {
  const Pet = await getPetModel()
  const ownerId = normalizeText(req.query.userId)
  const query = ownerId ? { ownerId } : {}
  const pets = await Pet.find(query).sort({ createdAt: -1 }).limit(200)

  return res.status(200).json({
    pets: pets.map(serializePet),
  })
}

export async function createPet(req, res) {
  const { ownerId, ownerName, name, breed, age, weight, vaccinationStatus, petPhoto } = req.body

  if (!name || !breed || !age || !weight || !vaccinationStatus) {
    return res.status(400).json({ message: 'Name, breed, age, weight, and vaccination status are required.' })
  }
  if (!normalizeText(ownerId)) {
    return res.status(400).json({ message: 'Owner account is required to create a pet.' })
  }

  const Pet = await getPetModel()
  const pet = await Pet.create({
    ownerId: normalizeText(ownerId),
    ownerName: normalizeText(ownerName),
    name: String(name).trim(),
    breed: String(breed).trim(),
    age: String(age).trim(),
    weight: String(weight).trim(),
    vaccinationStatus: String(vaccinationStatus).trim(),
    petPhoto: normalizeText(petPhoto),
  })

  return res.status(201).json({
    pet: serializePet(pet),
  })
}

export async function updatePet(req, res) {
  const { petId } = req.params
  const requesterOwnerId = normalizeText(req.query.userId)
  const { ownerId, ownerName, name, breed, age, weight, vaccinationStatus, petPhoto } = req.body

  const updates = {}
  if (ownerId !== undefined) {
    updates.ownerId = normalizeText(ownerId)
  }
  if (ownerName !== undefined) {
    updates.ownerName = normalizeText(ownerName)
  }
  if (name !== undefined) {
    updates.name = normalizeText(name)
  }
  if (breed !== undefined) {
    updates.breed = normalizeText(breed)
  }
  if (age !== undefined) {
    updates.age = normalizeText(age)
  }
  if (weight !== undefined) {
    updates.weight = normalizeText(weight)
  }
  if (vaccinationStatus !== undefined) {
    updates.vaccinationStatus = normalizeText(vaccinationStatus)
  }
  if (petPhoto !== undefined) {
    updates.petPhoto = normalizeText(petPhoto)
  }

  const Pet = await getPetModel()
  const query = requesterOwnerId ? { _id: petId, ownerId: requesterOwnerId } : { _id: petId }
  const previousPet = await Pet.findOne(query)
  if (!previousPet) {
    return res.status(404).json({ message: 'Pet not found.' })
  }
  const pet = await Pet.findOneAndUpdate(query, updates, { new: true, runValidators: true })

  const trackedFields = ['name', 'breed', 'age', 'weight', 'vaccinationStatus', 'petPhoto', 'ownerName']
  const changedFields = trackedFields.filter((field) => {
    if (updates[field] === undefined) {
      return false
    }
    return String(previousPet?.[field] ?? '') !== String(pet?.[field] ?? '')
  })

  if (pet && changedFields.length > 0) {
    await recordActivityLog({
      action: 'pet.record_edited',
      category: 'pets',
      description: `Pet record edited (${changedFields.join(', ')}).`,
      actor: getActorFromRequest(req, {
        id: requesterOwnerId || previousPet.ownerId,
        name: previousPet.ownerName || 'Unknown User',
        role: requesterOwnerId ? 'pet-owner' : 'unknown',
      }),
      entity: {
        type: 'pet',
        id: pet.id,
        label: pet.name,
      },
      metadata: {
        changedFields,
      },
    })
  }

  return res.status(200).json({ pet: serializePet(pet) })
}

export async function deletePet(req, res) {
  const { petId } = req.params
  const Pet = await getPetModel()
  const ownerId = normalizeText(req.query.userId)
  const deleted = ownerId
    ? await Pet.findOneAndDelete({ _id: petId, ownerId })
    : await Pet.findByIdAndDelete(petId)

  if (!deleted) {
    return res.status(404).json({ message: 'Pet not found.' })
  }

  return res.status(200).json({ message: 'Pet deleted successfully.' })
}
