import { Router } from "express";
import { startSession } from "mongoose";2
import { userModel } from "./db/userSchema";
import {hash , compare} from 'bcrypt'
import {sign,verify} from 'jsonwebtoken'

const userRouter:Router = Router();

type userType = {
    userId:number
    userName:string,
    password:string
}


const saltRounds:number = 10;
const jwt_secret:string = process.env.JWT_SECRET!;

//setting cookie on the user's browser for authentication 
const cookie_parser_options ={
    httpOnly : true,
    signed: false,
    sameSite : "lax" as "lax",
    maxAge : 60 * 60 * 24 * 2 //time after which cookie will expire and user has to login again
}

userRouter.post('/Register',async(request,response)=>{
    const session = startSession();
    try{
        const {userId , userName , password} : userType= request.body;

        //start a new mongoDB transaction in the session
        (await session).startTransaction()
        //check if user alreay exists
        //always use findOne instead of find as find returns an array of objects and is no user is found empty array is returend that causes 
        //**************the userExists to always be true****************
        const userExists = await userModel.findOne({
            $or:[
                {userName:userName},
                {userId:userId}
            ]}).session((await session));

        if(userExists){
            response.status(400).json({message:"User already exists"});
            return;
        }

        //hashing the user password to store in database
        const hashedUserPassword:string = await hash(password,saltRounds);

        //create a new user in the database
        const newUser = await new userModel({
            userId:userId,
            userName:userName,
            password:hashedUserPassword
        }).save({session:(await session)});

        throw new Error("Example error");

        //add the first login time as the created at time instead of saving a separate field for it
        await newUser.updateOne({$push:{logs:new Date()}}).session((await session));

        //commit the transaction 
        (await session).commitTransaction();

        console.log("New user created :",newUser);
        const token = sign(newUser.userName!,jwt_secret);
        response.cookie('auth_token',token,cookie_parser_options);
        response.status(200).json({message:"User created successfully"})

    }
    catch(err){
        await (await session).abortTransaction();
        response.status(500).json({message:`Could not register new user check server logs for more information`});
        console.log("Error occured while creating a user and setting cookie :",err);
    }
    finally{
        (await session).endSession();
    }
})

//route that handels login for user
userRouter.post('/Login',async(request,response)=>{
    const session = startSession();
    try{
        const {userName , password} : userType = request.body;

        (await session).startTransaction();

        const user = await  userModel.findOne({userName:userName}).session((await session));
        if(user){
            const hashedPassword:string = user.password;
            const isPasswordCorrect:boolean = await compare(password,hashedPassword);

            if(isPasswordCorrect){
                //add the current time and date to the array so that we have the log of the users login data
                await user.updateOne({$push:{logs:new Date()}}).session((await session));
                console.log("user id before is :",user._id);
                //set cookie and send response
                const user_name:string = user.userName!;
                const token = sign(user_name,jwt_secret);
                console.log("cookie being set is :",token);

                //commit the transaction
                (await session).commitTransaction();

                response.cookie('auth_token',token,cookie_parser_options);
                response.status(200).send("Login successfully");
            }
            response.json({message:"Invalid userName or Password"});
        }
        response.json({message:"User does not exist"});
    }
    catch(err){
        (await session).abortTransaction();
        console.log("error occured while setting cookie :",err);
    }
    finally{
        (await session).endSession();
    }
    
})

userRouter.get('/getCookie',async(request,response)=>{
    try{
        const cookie = await request.cookies;
        console.log("cookies from the browser are :",cookie)
        response.send(cookie);
    }
    catch(err){
        console.log("Error while fetching cookie from browser :",err);
    }
})

export default userRouter;