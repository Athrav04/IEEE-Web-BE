import {Mongoose,Schema,model} from 'mongoose';

const eventSchema = new Schema({
    event_name:{type:String,required:true},
    event_date:{type:Date,required:true},
    event_speaker:{type:String,required:false},
    event_description:{type:String,required:true}
})

export const eventModel = model('EventsModel',eventSchema);