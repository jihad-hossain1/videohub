import { asyncHandlerPromise } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import dotenv from "dotenv";
dotenv.config({
  path: "./.env",
});

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "something went while generating refresh and access token"
    );
  }
};

const registerUser = asyncHandlerPromise(async (req, res) => {
  // get user details from fronend
  const { fullname, username, password, email } = req.body;
  // console.log("email: ", email);

  // validation - not empty
  if (
    [fullname, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields is required");
  }

  // check if user already exists: username, email
  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with email or usernaem already exist");
  }

  // check for images, check for avatar
  const avatarLocalPath = req.files?.avatar[0]?.path;

  let coverImageLocalPath;
  // console.log("from if ... ", Array.isArray(req.files?.coverImage));
  if (
    req.files &&
    Array.isArray(req.files?.coverImage) &&
    req.files?.coverImage?.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  // upload them to cloudinary, avatar
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Avater is required");
  }

  // create user object - crate entry in db
  const user = await User.create({
    fullname,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  // remove password and refresh token field from response
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  // check for user creation
  if (!createdUser) {
    throw new ApiError(500, "something went wrong while registring the user");
  }

  // return res
  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "user register successfully"));

  //   res.status(200).json({
  //     message: "ok",
  //   });
});

const loginUser = asyncHandlerPromise(async (req, res) => {
  // req body -> data
  const { email, username, password } = req.body;

  // username or email

  if (!email && !username) {
    throw new ApiError(400, "username or password is required");
  }

  // find the user
  const user = await User.findOne({ $or: [{ email }, { username }] });

  if (!user) {
    throw new ApiError(400, "user does not exist");
  }

  // password check
  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials || wrong password");
  }

  // access and refresh token
  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  // send cookie
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  // return res
  //   .status(200)
  //   .cookie("accessToken", accessToken, options)
  //   .cookie("refreshToken", refreshToken, options)
  //   .json(
  //     new ApiResponse(
  //       200,
  //       {
  //         user: loggedInUser,
  //         accessToken,
  //         refreshToken,
  //       },
  //       "user successfully loggedIn.."
  //     )
  //   );
  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged In Successfully"
      )
    );
});

const logoutUser = asyncHandlerPromise(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "user successfully loggedOut ..."));
});

export { registerUser, loginUser, logoutUser };
