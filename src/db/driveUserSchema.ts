import { Mongoose , Schema , model } from "mongoose";

const driveUserSchema = new Schema({
    user_name:{type:String,required:true},
    user_email:{type:String,required:true},
    access_token:{type:String,required:true},
    refresh_token:{type:String,required:true},
    token_expirty_date:{type:Date,required:true}
});

export const driveUserModel = model('Drive_User',driveUserSchema);

