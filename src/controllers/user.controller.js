import { asyncHandler } from '../utils/asyncHandler.js';
import {ApiError} from "../utils/ApiError.js";
import {User} from "../models/user.model.js";
import {uploadCloudinary} from "../utils/cloudnary.js";
import {ApiResponse} from "../utils/ApiResponse.js"

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

export {registerUser}