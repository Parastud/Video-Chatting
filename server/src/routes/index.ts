import { Router } from "express";
import { authRouter } from "./auth.routes";
import { contactsRouter } from "./contacts.routes";
import { healthRouter } from "./health.routes";
import { usersRouter } from "./users.routes";

export const apiRouter = Router();

apiRouter.use("/", healthRouter);
apiRouter.use("/", authRouter);
apiRouter.use("/", contactsRouter);
apiRouter.use("/", usersRouter);
