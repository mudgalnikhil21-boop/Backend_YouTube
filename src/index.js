// require("dotenv").config({path:"./.env"});
import dotenv from "dotenv";
import connectDB from "./db/index.js";


dotenv.config({
    path: './.env'
})

connectDB();








/*
import express from "express"
const app = express()
;(async () => {
    try{
        await mongoose.connect(`${process.env.MONGO_URI}/${DB_NAME}`);
        app.on("error",(error)=>{
            console.log("ERROR OCCURED WHILE CONNECTING TO MONGODB", error)
            throw error
        })

        app.listen(process.env.PORT, ()=>{
            console.log(`App is istening on port ${process.env.PORT} and connected to MongoDB`)
        })
    }
    catch(error){
        console.error("Error connecting to MongoDB:", error);
        throw error;
    }
})()

*/


