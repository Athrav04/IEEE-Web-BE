import {Router} from 'express';
import { authMiddleware } from '../middleware/auth';
import {eventModel} from '../db/eventsSchema';
import { startSession } from 'mongoose';


const eventsRouter:Router = Router();


eventsRouter.get('/',async(req,res)=>{
   const events = await eventModel.find({});
   console.log('Events :',events);
   res.status(200).send(events);
})

eventsRouter.post('/addEvent',async(req,res)=>{
    try{
        const {eventName,eventDate , organizer , speaker , description} = req.body;
    if(!eventName || !eventDate || !organizer || !description){
        res.status(400).send("Please provide all the required fields");
    }
    const session = startSession();
    (await session).startTransaction();
    const newEvent = new eventModel({
        event_name:eventName,
        event_date:new Date(eventDate),
        event_organizer:organizer,
        event_speaker:speaker,
        event_description:description
    });
    (await newEvent.save()).$session(await session);
    (await session).commitTransaction();
    res.status(200).send("Event added successfully");
    }catch(err){console.log("error while creating event ",err);res.status(500).end("Internal server error")}
    
})
export default eventsRouter;