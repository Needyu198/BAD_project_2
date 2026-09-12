import { Router } from 'express'
import { createPet, deletePet, listPets, updatePet } from '../controllers/petController.js'

const petRouter = Router()

petRouter.get('/', listPets)
petRouter.post('/', createPet)
petRouter.put('/:petId', updatePet)
petRouter.delete('/:petId', deletePet)

export { petRouter }
