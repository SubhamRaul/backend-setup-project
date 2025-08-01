import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
const app = express()

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials:true
}))

app.use(express.json({limit: "20kb",}))
app.use(express.urlencoded({extended:true , limit:"20kb"}))
app.use(express.static("public")); // to store things publically eg. favicon,img,pdf etc.
app.use(cookieParser());

// Routes
import userRouter from "./routes/user.routes.js"


//routes declaration
app.use("/api/v1/users" , userRouter); 

// http://localhost:8000/api/v1/users/register  :  this is how links are created.
export{ app }