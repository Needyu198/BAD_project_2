import { Router } from "express";
import {
  changeUserPassword,
  deleteUser,
  getUserProfile,
  listUsers,
  updateUserProfile,
} from "../controllers/userController.js";

const userRouter = Router();

userRouter.get("/", listUsers);
userRouter.get("/:userId/profile", getUserProfile);
userRouter.put("/:userId/profile", updateUserProfile);
userRouter.post("/:userId/change-password", changeUserPassword);
userRouter.delete("/:userId", deleteUser);

export { userRouter };
