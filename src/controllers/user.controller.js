import { asyncHandler } from '../utils/asyncHandler.js';

const registerUser = asyncHandler(async (req,res) => {
    res.status(202).json({
        message:"Successful route",
    })
});

export {registerUser}