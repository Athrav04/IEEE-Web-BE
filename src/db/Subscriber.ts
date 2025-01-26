import { Schema , model } from 'mongoose'

const subscriberSchema = new Schema ({
    email:{
        type:String,
        required:true
    }
});

export const subscriberModel = model('subscriber',subscriberSchema);