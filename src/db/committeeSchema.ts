import {Schema , Model, model} from 'mongoose'


 const committeeSchema = new Schema({
    name:{type:String,required:true},
    domain:{type:String,required:true},
    position : {type:String,required:true},
})

export const committeeModel = model('committeeModel',committeeSchema);

