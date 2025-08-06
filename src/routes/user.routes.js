import {Router} from "express"
import { 
    LoginUser,
    logoutUser,
    registerUser,
    refreshAccessToken,
    getUserChannelProfile,
    chengeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvater,
    updateUserCoverImage,
    getWatchHistory 
} from "../controllers/user.controller.js";

import upload from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router()

router.route("/register").post(
    upload.fields([
        {
            name: "avatar",
            maxCount: 1
        },
        {
            name: "coverimage",
            maxCount: 1
        }
    ]),
    registerUser
)

router.route("/login").post(LoginUser)

//secured routes

router.route("/logout").post(verifyJWT , logoutUser);

router.route("/refresh-token").post(refreshAccessToken);

router.route("/changePassword").post(verifyJWT , chengeCurrentPassword);

router.route("/currentUser").get(verifyJWT,getCurrentUser);

router.route("/UpdateAccount").patch(
    verifyJWT,
    updateAccountDetails
);

router.route("/avater").patch(
    verifyJWT,
    upload.single("avatar"),
    updateUserAvater
);

router.route("/cover-image").patch(
    verifyJWT,
    upload.single("coverimage"),
    updateUserCoverImage
);

router.route("/UserProfile/:username").get(verifyJWT,getUserChannelProfile);

router.route("/history").get(verifyJWT , getWatchHistory)


export default router;