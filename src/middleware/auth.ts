
import { Request,Response,NextFunction} from 'express'
import { verify } from 'jsonwebtoken';
import { config } from 'dotenv';

config();

const secret = process.env.JWT_SECRET!;

export function authMiddleware(request:Request,response:Response,next:NextFunction){
    try{
        const cookies = request.cookies;
        const auth_token:string = cookies.auth_token;   
        if(auth_token)  
        {
            const verified =  verify(auth_token,secret,);
            if(!verified){
                throw new Error("Inlvalid token");
                response.status(401);
            }
            next();
        }
        response.status(401).send("No auth token found");

    }catch(error){
        console.log("Error while authenticating user", error)
    }finally{
        next()
    }

}