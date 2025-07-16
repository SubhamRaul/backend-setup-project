import { asyncHandler } from '../utils/asyncHandler.js';
import {ApiError} from "../utils/ApiError.js";
import {User} from "../models/user.model.js";
import {uploadCloudinary} from "../utils/cloudnary.js";
import {ApiResponse} from "../utils/ApiResponse.js"

const GenarateAccessandRefrreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accesstoken = user.generateAcessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({validateBeforeSave: false});

        return {accesstoken,refreshToken};

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

const LoginUser = asyncHandler(async () => {

    // req.body -> data

    const {email,username,password} = req.body;
    if(!username || !email){
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
                user:logged , accessToken , refreshToken
            },
            "user logged in succesfully"
        )
    )

});

const logoutUser = asyncHandler(async(req,res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined,
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

export {registerUser , LoginUser , logoutUser}