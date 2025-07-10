import { v2 as cloudinary} from "cloudinary";
import fs from "fs";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key : process.env.CLOUDINARY_CLOUD_KEY,
    api_secret: process.env.CLOUDINARY_CLOUD_SECRET
});


const uploadCloudinary = async (localFilePath)=>{
    try {
        if(!localFilePath) return null;
        //upload the file on cloudinary
        const response = await cloudinary.uploader.upload(localFilePath,{
            resource_type:"auto"
        })
        // file uploaded successfully
        console.log("file uplpaded succesfully : " ,response.url);
        return response;
    } catch (error) {
        fs.unlinkSync(localFilePath); 
        // remove the locally saved temp file as upload failed
        return null;
    }
}

export {uploadCloudinary}