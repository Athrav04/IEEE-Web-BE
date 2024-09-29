import {Mongoose , Schema , Model , connect, model} from 'mongoose';
import { config } from 'dotenv';
config();

export const connectionString:string = process.env.MONGODB_URI!;

//connecting to the database (type for the function can be better )
async function connectDB():Promise<boolean>{
    try{
        console.log("Connection string for mongoDB is :",connectionString);
        const connected = await connect(connectionString);
        return true;
    }
    catch(err){
        console.log("Error while connecting to the database :",err);
        return false;
    }
}

//creating a new model for the schema
const userSchema = new Schema({
    userId:{type:Number,min:5,unique:true},
    userName:String,
    password:{type:String,required:true,min:6},
    logs:[Date]
})

export const userModel = model('admin_users',userSchema);

connectDB();