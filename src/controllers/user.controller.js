import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import {ApiResponse} from "../utils/ApiResponse.js"


const generateAccessAndRefreshTokens = async(userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false});

        return {accessToken,refreshToken};

    } catch (error) {
        throw new ApiError(500, "Something went wrong wile generating refresh and access tokens")
    }
}

const registerUser = asyncHandler (async (req, res) => {
    
    // grab the data from frontend
    // validate the data - not empty
    // check if user already exist: username, email
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and response token field from response
    // check for user creation
    // return res

    const {fullName, email, username, password} = req.body;
    console.log("email: ", email);

    if([fullName, email, username, password].some(field => field?.trim() === ""   ))
    {
        throw new ApiError(400, "All fields are required")
    }

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if(existedUser){
        throw new ApiError(409, "User with username or email already exists")
    }

    console.log("req.files: ", req.files);
    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar)
    {
        throw new ApiError(400,"Avatar file is required")
    }

    console.log("avatar: ", avatar);

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        username: username.toLowerCase(),
        password
    })

    console.log("user: ", user)

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new ApiError(500, "something went wrong while registering the user")
    }

    return res.status(201).json(new ApiResponse(true, createdUser, "User registered successfully"))
    
})

const loginUser = asyncHandler (async (req, res) => {
    // grab the password and other form data from frontend from req.body
    // check if the essiantial are sent or not for eg password, username, email, fullName
    // {choose username or email as the criteria for login}
    // find the user
    // check if the password is correct through userSchema.methods.isPasswordCorrect else send ari response as error
    // create an jwt accessToken and refreshToken
    // save the refreshToken in the database
    // send the refreshToken and accessToken as cookies

    const {usename, email, password} = req.body

    if(!username || !email)
    {
        throw new ApiError(400, "username or email is requpired")
    }

    const user = await User.findOne({
        $or: [{email},{username}]
    })

    if(!User)
    {
        throw ApiError(404, "user does not exists")
    }


    const isPasswordValid = user.isPasswordCorrect(password)
    if(!isPasswordValid){
        throw ApiError(401,"Incorrect Passsword")
    }

    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)

    const loggedInUser = await User.findById(user._id)
    .select("-password -refreshToken");
    // user.refreshToken = refreshToken
    // const loggedInUser = user

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
           .status(200)
           .cookie("accessToken", accessToken, options)
           .cookie("refreshToken",refreshToken, options)
           .json(
                new ApiResponse(
                    200,
                    {
                        user: loggedInUser, accessToken, refreshToken
                    },
                    "User logged in successfully"
                )
           )

})

const logoutUser = asyncHandler( async(req, res) => {
    // data -> req.body
    // remove cookies
    // remove user's refreshToken from the dataBase

    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {refreshToken: undefined}
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
            .status(200)
            .clearCookie("accessToken",options)
            .clearCookie("refreshToken", options)
            .json(new ApiResponse(200, {}, "User logged out successfully"))
})

export {
    registerUser,
    loginUser,
    logoutUser
}