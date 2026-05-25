import { v2 as cloudinary } from "cloudinary";

export const deleteFromCloudinary = async (cloudinaryUrl, resourceType = "image") => {
    try {
        if (!cloudinaryUrl) return null;

        // Example URL: http://res.cloudinary.com/demo/image/upload/v123456/sample.jpg
        
        const urlArray = cloudinaryUrl.split('/'); 
        
        const imageWithExtension = urlArray[urlArray.length - 1]; 
        
        const publicId = imageWithExtension.split('.')[0]; 

        console.log("Extracted public_id to delete:", publicId);

        const response = await cloudinary.uploader.destroy(publicId, {
            resource_type: auto
        });

        console.log("Cloudinary deletion response:", response);
        return response;

    } catch (error) {
        console.error("Error deleting file from Cloudinary:", error);
        return null;
    }
}