import { asyncHandler } from '../utils/asyncHandler.js';
import {ApiError} from "../utils/ApiError.js";
import {User} from "../models/user.model.js";
import {uploadCloudinary} from "../utils/cloudnary.js";
import {ApiResponse} from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"
import mongoose from 'mongoose';

const GenarateAccessandRefrreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({validateBeforeSave: false});

        return {accessToken,refreshToken};

    } catch (error) {
        throw new ApiError(500, "Something went wrong while genarating access and refresh token.");
    }
}

const registerUser = asyncHandler(async (req,res) => {

    // get user detail from frontend
    
    const {username , email , fullname , password} = req.body;
    //console.log("req.body : ",req.body);
    
    //console.log("email : ",email);
    
    // validation --not empty

    if(
        [fullname,email,username,password].some( (field) => field?.trim === "" )
    ){
        throw new ApiError(400,"All fields are required")
    };
    if (!email.includes("@") || !email.includes("gmail.com")) {
        throw new ApiError(400, "Email must be a valid Gmail address");
    };

    // check if user already exists: email

    const ExistedUser = await User.findOne({
        $or:[{username} , {email}]
    });

    if(ExistedUser){
        throw new ApiError(409 , "User Already Exists!");
    }

    // check for images ,avatar
    //console.log("req.files : ", req.files);
    
    const avaterLocalPath = req.files?.avatar[0]?.path;
    //const coverImageLoalpath = req.files?.coverimage[0]?.path;

    let coverImageLoalpath;
    if(req.files && Array.isArray(req.files.coverimage) && req.files.coverimage.length > 0){
        coverImageLoalpath = req.files.coverimage[0].path;
    }

    if (!avaterLocalPath) {
        throw new Error(400,"avatar file is required");
    }

    // upload them to cloudnary, avatar

    const avatar = await uploadCloudinary(avaterLocalPath);
    const coverimage = await uploadCloudinary(coverImageLoalpath);

    if(!avatar){
        throw new Error(400,"avatar file is required");
    }

    // create user object - create entry in db

    const user = await User.create({
        fullname,
        avatar: avatar.url,
        coverimage : coverimage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    });

    // remove password and refresh token field from response
    // check for user creation

    const createUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    if(!createUser){
        throw new ApiError(500,"Something went wrong while registering user");
    }
    
    // return res

    return res.status(201).json(
        new ApiResponse(200,createUser,"User registered successfullly")
    )

})

const LoginUser = asyncHandler(async (req,res) => {

    // req.body -> data

    const {email,username,password} = req.body;
    if(!(username || email)){
        throw new ApiError (400 , "username or email required.");
    }

    // username or email

    const user = await User.findOne({
        $or: [{username} , {email}]
    })

    // find the user

    if(!user){
        throw new ApiError(404 , "user not exists.");
    }

    // password check

    // * Here {User} will not work as it is of the mongodb and the method we write are not available in this . They are available to our user i.e. {user}

    const ispasswordvalid = await user.isPasswordCorrect(password);
    if(!ispasswordvalid){
        throw new ApiError(401 , "Invalid User.");
    }

    // access or refresh token

    const {accessToken,refreshToken} = await GenarateAccessandRefrreshTokens(user._id);

    // send cookie

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    const options = {
        httpOnly : true,
        secure: true,
    }

    return res
    .status(200)
    .cookie("accessToken",accessToken, options)
    .cookie("refreshToken", refreshToken , options)
    .json(
        new ApiResponse(
            200,
            {
                user:loggedInUser , accessToken , refreshToken
            },
            "user logged in succesfully"
        )
    )

});

const logoutUser = asyncHandler(async(req,res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1,
            }
        },
        {
            new: true,
        }
    )

    const options = {
        httpOnly : true,
        secure: true,
    }

    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200,{},"User LoggedOut Successfully"))
})

const refreshAccessToken = asyncHandler(async (req,res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;
    if(!incomingRefreshToken){
        throw new ApiError(401,"Unauthorised request")
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken , process.env.REFRESH_TOKEN_SECRET);
        const user = await User.findById(decodedToken?._id);
        if(!user){
            throw new ApiError(401,"Invalid Refresh Token")
        }
    
        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401,"Refresh Token is used or expired");
        }
    
        const options = {
            httpOnly:true,
            secure:true
        }
    
        const {newaccessToken , newrefreshToken} = await GenarateAccessandRefrreshTokens(user._id);
    
        return res
        .status(200)
        .cookie("accesToken",newaccessToken , options)
        .cookie("refreshToken",newrefreshToken , options)
        .json(
            new ApiResponse(
                200,
                {newaccessToken , newrefreshToken},
                "AccessToken refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }

})

const chengeCurrentPassword = asyncHandler(async(req,res) => {
    const {oldpassword , newpassword} = req.body;

    const user = await User.findById(req.user?._id);
    const checkedPassword = await user.isPasswordCorrect(oldpassword);

    if(!checkedPassword){
        throw new ApiError(400,"Invalid password");
    }

    user.password = newpassword;
    await user.save({validateBeforeSave : false});
    
    return res.status(200)
    .json(
        new ApiResponse(200,{},"Password changed succesfully!")
    )
})

const getCurrentUser = asyncHandler( async (req,res) => {
    const user = req.user;
    return res.status(200)
    .json(
        new ApiResponse(200,user,"Current user fetched successfully")
    )
})

const updateAccountDetails = asyncHandler(async(req,res)=>{
    const {fullname , email} = req.body;

    if(!fullname || !email){
        throw new ApiError(400,"all fields are required");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullname,
                email
            }
        },
        {new:true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200,user,"Account details update successfully."))
})

const updateUserAvater = asyncHandler(async(req,res) => {
    const avaterLocalPath = req.file?.path;

    if(!avaterLocalPath){
        throw new ApiError(400,"avater file missing");
    }

    const avatar = await uploadCloudinary(avaterLocalPath);
    if(!avatar.url){
        throw new ApiError(400,"error while uploading avater");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            avatar: avatar.url
        },
        {
            new:true,
        }
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200,user,"avater image updated")
    )

})

const updateUserCoverImage = asyncHandler(async(req,res) => {
    const CoverImageLocalPath = req.file?.path;

    if(!CoverImageLocalPath){
        throw new ApiError(400,"cover image file missing");
    }

    const coverimage = await uploadCloudinary(CoverImageLocalPath);
    if(!coverimage.url){
        throw new ApiError(400,"error while uploading cover image");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            coverimage: coverimage.url
        },
        {
            new:true,
        }
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200,user,"Cover image updated")
    )

})

const getUserChannelProfile = asyncHandler(async (req, res) => {
    console.log(req.params);
    
    const {username} = req.params;
    if(!username){
        throw new ApiError(400,"Username is required");
    }
    
    const channel = await User.aggregate([
        {
            $match:{
                username:username?.toLowerCase()
            }
        },
        {
            $lookup:{
                from:"subscriptions",
                localField:"_id",
                foreignField:"channel",
                as:"subscribers"
            }
        },
        {
            $lookup:{
                from:"subscriptions",
                localField:"_id",
                foreignField:"subscriber",
                as:"subscribedTo"
            }
        },
        {
            $addFields:{
                subscriberCount:{
                    $size:"$subscribers"
                },
                channelsSubscribedToCount:{
                    $size:"$subscribedTo"
                },
                isSubscribed:{
                    $cond:{
                        if:{$in: [req.user?._id , "$subscribers.subscriber"]},
                        then: true,
                        else:false
                    }
                }
            }
        },
        {
            $project:{
                fullname:1,
                username:1,
                subscriberCount:1,
                channelsSubscribedToCount:1,
                isSubscribed:1,
                avatar:1,
                coverimage:1,
                email:1
            }
        }
    ])

    console.log(channel); // gives a array of object . only a single object in our case

    if(!channel?.length){
        throw new ApiError(404 , "channel does not exists")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200,channel[0] , "User channel fetched successfully")
    )
})

const getWatchHistory = asyncHandler(async(req,res) => {
    const user = await User.aggregate([
        {
            $match:{
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup:{
                from:"videos",
                localField:"watchHistory",
                foreignField:"_id",
                as:"watchHistory",
                pipeline:[
                    {
                        $lookup:{
                            from:"users",
                            localField:"VideoOwner",
                            foreignField:"_id",
                            as:"owner",
                            pipeline:[ // this to do at outer side of user
                                {
                                    $project:{
                                        fullname:1,
                                        username:1,
                                        avatar:1
                                    }
                                },
                                {
                                    $addFields:{
                                        owner:{
                                            $first:"$owner"
                                        }
                                    }
                                }
                            ]
                        }
                    }
                ]
            }
        }
    ])

    return res.status(200)
    .json(
        new ApiResponse(
            200,
            user[0].watchHistory,
            "Watch History fetched succesfully"
        )
    )
})






export {
    registerUser , 
    LoginUser , 
    logoutUser , 
    refreshAccessToken,
    chengeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvater,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}


// just checking git