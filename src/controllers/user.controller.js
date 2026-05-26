import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { deleteFromCloudinary } from "../utils/deleteFromCloudinary.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken";


const generateAccessAndRefreshTokens = async(userId) => {
    try {
        const user = await User.findById(userId)
        if(!user)
        {
            throw new ApiError(404, "User not found")
        }

        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false});

        return {accessToken,refreshToken};

    } catch (error) {
        console.error("Error generating access and refresh tokens: ", error);
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

    return res.status(201).json(new ApiResponse(201, createdUser, "User registered successfully"))
    
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

    const {username, email, password} = req.body

    if(!username && !email)
    {
        throw new ApiError(400, "username or email is requpired")
    }

    const user = await User.findOne({
        $or: [{email},{username}]
    })

    if(!user)
    {
        throw new ApiError(404, "user does not exists")
    }


    const isPasswordValid = await user.isPasswordCorrect(password)
    if(!isPasswordValid){
        throw new ApiError(401,"Incorrect Passsword")
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

const refreshAccessToken = asyncHandler( async(req, res) => {
    // data -> req.cookies
    // check if refresh token is present or not in the cookies
    // get decoded token
    // get user through decode token
    // check if user is present or not through middleware
    // access refreshToken from database
    // check if incoming refresh token matches the token in database
    // if token is expired throw error
    // if all good then generate new access token and refresh token
    // save the new refresh token in database
    // send the new access token and refresh token as cookie

    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401,"Unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
        const user = await User.findById(decodedToken?._id)
    
        if(!user){
            throw new ApiError(401, "Invalid refresh token")
        }
    
        if(user?.refreshToken !== incomingRefreshToken)
        {
            throw new ApiError(401, "Refresh Token is expired or used ")
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const  {accessToken, newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
    
        return res
                .status(200)
                .cookie("accessToken", accessToken, options)
                .cookie("refreshToken", newRefreshToken, options)
                .json(
                    new ApiResponse(
                        200,
                        {
                            accessToken: accessToken,
                            refreshToken: newRefreshToken
                        },
                        "Access token refreshed successfully"
                    )
                )
    } catch (error) {
        throw new ApiError(401, error?.message ||"Invalid refresh token")
    }

})

const changeCurrentPassword = asyncHandler( async(req, res) => {
    const {oldPassword, newPassword} = req.body;
    const user = await User.findById(req.user?._id)
    const isPasswordValid = await user.isPasswordCorrect(oldPassword)
    if(!isPasswordValid)
    {
        throw new ApiError(400, "Incorrect Password")
    }
    user.password = newPassword;
    await user.save({validateBeforeSave: false})
    return res
            .status(200)
            .json(new ApiResponse(200, {}, "Password updated successfully"))
})

const getCurrentUser = asyncHandler(async(req, res) =>{
    const user = req.user;
    if(!user)
    {
        throw new ApiError(401,"Userr not logged in" )
    }
    return res
            .statuus(200)
            .json(new ApiResponse(200,user,"user data fetched successfully"));
})

const updateAccountDetails = asyncHandler( async(req, res) =>{
    const {fullName, email,} = req.body;
    if(!fullName && !email)
    {
        throw new ApiError(400,"All fields are required")
    }
    const user = await User.findByIdAndUpdate(req.user?._id,
        {
            $set: {fullName, email: email}
        },
        {
            new: true
        }
    ).select("-password")
    return res
            .status(200)
            .json(new ApiResponse(200, user, "Account details updated Successfully"))
})

const updateUserAvatar = asyncHandler( async (req, res) => {
    // upload the file through multer (in middleware in user.route)
    // localpath ->req.files
    // upload file on cloudinary to get cloudinary url
    // update the url  on the database
    // delete the old file on cloudinary

    const avatarLocalPath = req.file?.path;
    if(!avatarLocalPath)
    {
        throw new ApiError(400, "Avatar file is missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if(!avatar.url)
    {
        throw new ApiError(500, "Error while uploading avatar on Clodinary")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {avatar:avatar.url}
        },
        {
            new: true
        }
    ).select("-password -__v");

    if(!user)
    {
        throw new ApiError(500, "error while updting the avatar url on the database")
    }

    await deleteFromCloudinary(user.avatar)

    return res
            .status(200)
            .json(new ApiResponse(200, user, "Avatar updated successfully"))

})

const updateUserCoverImage = asyncHandler( async (req, res) => {
    
    const coverImageLocalPath = req.file?.path;
    if(!coverImageLocalPath)
    {
        throw new ApiError(400, "coverImage file is missing")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!coverImage.url)
    {
        throw new ApiError(500, "Error while uploading coverImage on Clodinary")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {coverImage:coverImage.url}
        },
        {
            new: true
        }
    ).select("-password -__v");

    if(!user)
    {
        throw new ApiError(500, "error while updting the coverImage url on the database")
    }

    await deleteFromCloudinary(user.coverImage)

    return res
            .status(200)
            .json(new ApiResponse(200, user, "coverImage updated successfully"))

})

const getUserChannelProfile = asyncHandler(async(req, res) => {
    const { username } = req.params

    if(!username?.trim())
    {
        throw new ApiError(400, "username is missing")
    }

    const channel = await User.aggregate([
        { 
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions", 
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions", 
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size : "$subscribers"
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1
            }
        }
    ])
    console.log("channel: ", channel)

    if(!channel?.length){
        throw new ApiError(404, "Channel not found")
    }

    return res
            .status(200)
            .json(new ApiResponse(200,channel[0],"Channel data fetched successfully"))
})

const getWatchHistory = asyncHandler(async(req,res) => {

    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user?._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as:"watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])
    return res
            .status(200)
            .json(new ApiResponse(200, user[0], "Watch history fetched successfully"))
})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
} 