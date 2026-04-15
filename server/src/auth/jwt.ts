import jwt, { type JwtPayload } from "jsonwebtoken";
import { env } from "../config/env";

export type AppJwtPayload = JwtPayload & {
  sub: string;
  username: string;
};

export const signToken = (payload: { sub: string; username: string }) =>
  jwt.sign(payload, env.jwtSecret, { expiresIn: "7d" });

export const verifyToken = (token: string): AppJwtPayload =>
  jwt.verify(token, env.jwtSecret) as AppJwtPayload;
