import {v2 as cloudinary} from "cloudinary";
import fs from "fs";

cloudinary.config({ 
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
        api_key: process.env.CLOUDINARY_API_KEY, 
        api_secret: process.env.CLOUDINARY_API_SECRET 
    });

const uploadOnCloudinaryv = async (localFilePath) => {
    try {
        if(!localFilePath) return null;
        // upload the file on cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"
        })
        // file has been uploaded successfully
        console.log("File uploaded on cloudinary successfully, now removing the file from local storage", response.url)
        return response;
    }
    catch (error) {
        // it can be modified by using queues which try to send data to cloudinary after every 5 minutes
        console.error("Cloudinary upload failed:", error);
        return null;
    }
    finally {
        if (localFilePath) {
            try {
                fs.unlinkSync(localFilePath);
            } catch (unlinkError) {
                console.error("Failed to delete local temporary file:", unlinkError);
            }
        }
    }
}

export {uploadOnCloudinaryv}