import { ApiError } from "../utils/ApiError.js";
import { asyncHandlerPromise } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { User } from "../models/user.model.js";
dotenv.config();

export const verifyJWT = asyncHandlerPromise(async (req, _, next) => {
  try {
    console.log(
      "token found ----> ",
      req.cookies?.accessToken ||
        req.header("Authorization")?.replace("Bearer ", "")
    );
    const token =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      throw new ApiError(401, "unauthorized requiest");
    }

    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    const user = await User.findById(decodedToken?._id).select(
      "-password -refreshToken"
    );

    if (!user) {
      throw new ApiError(401, "Invalid access token");
    }

    req.user = user;
    next();
  } catch (error) {
    throw new ApiError(401, error?.message || "invalid access token");
  }
});
