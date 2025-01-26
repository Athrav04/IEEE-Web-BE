import {Router} from 'express';
import { authMiddleware } from '../middleware/auth';
import {eventModel} from '../db/eventsSchema';
import { startSession } from 'mongoose';
import { subscriberModel } from '../db/Subscriber';
import { findFolder, getReadAbleStream, listFilesInFolder } from '../drive/createFolder';
import { GlobalClient } from '../drive/oauth';
import {authorize} from '../drive/oauth'
import { Upload } from '@aws-sdk/lib-storage';
import { getPreSignedUrl, s3client } from '../helperFunctions/committeeData';


const imageNames:string[] = ['Hero1','Hero2','Hero3','Hero4','Hero5','Hero6'];

const GalleryImages:string[] = ['Induction1.jpg','IoT Workshop1.jpg','KanyaShala event1.jpg','KanyaShala event2.jpg','Pirungut1.jpg','Python1.jpg','Python2.jpg'];

const eventsRouter:Router = Router();


eventsRouter.get('/',async(req,res)=>{
   const events = await eventModel.find({});
   console.log('Events :',events);
   res.status(200).send(events);
})


//DOES NOT WORK 
// GIVES ERROR : authorize() or loadCredentialsIfExist() is not a function but works in the oauht page
//TODO: Fix this route and figure out what is going wrong
eventsRouter.post('/uploadEventFromDrive',async (req,res)=>{
    try{
        await authorize();
        const eventFolder = await findFolder('EventData',GlobalClient);
        if(!eventFolder){
            res.status(400).send("No Event Folder Found");
        }
        console.log("Event Folder is :",eventFolder);

        const folders = await listFilesInFolder(GlobalClient,eventFolder!);

        console.log("All folders are :",folders);

        folders?.forEach(async(folder)=>{
            try{
                const FOLDER_NAME = folder?.name;
                console.log("Folder Name is :",FOLDER_NAME);
                const files = await listFilesInFolder(GlobalClient,folder?.id!);
                console.log("Files in folder are :",files);
                if(!files){
                    res.status(400).send("No files found in the folder");
                }
                files?.forEach(async(file)=>{
                    const stream = await getReadAbleStream(GlobalClient,file?.id!);
                    const upload = new Upload({
                        client:s3client,
                        params:{
                            Bucket:'viitieeestb',
                            Key:`eventsData/${FOLDER_NAME}/${file?.name}`,
                            //@ts-ignore
                            Body:stream,
                            ContentType:'image/jpeg'
                        }
                    });
                    await upload.done();
                    console.log(`${file?.name} uploaded successfully`);
                })
            }catch(err){
                console.log("Error while uploading event from drive ",err);
                res.status(500).end("Internal server error  while uploading from nested folders");
            }
        })
    }catch(err){
        console.log("Error while uploading event from drive ",err);
        res.status(500).end("Internal server error");
    }
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
    
});


eventsRouter.post('/SubscribeEvents',async (req,res)=>{
    try{
        const {email} = req.body;
        if(!email){
            res.status(400).send("No email address provided");
        }
        const session = startSession();
        (await session).startTransaction();
        const subscriber = await subscriberModel.findOne({
            email:email
        });
        if(subscriber){
            res.status(200).send("You are already Subscribed ");
            (await session).abortTransaction();
        }
        else{
        const newSubscriber = new subscriberModel({
            email:email
        });

        (await newSubscriber.save()).$session(await session);
        (await session).commitTransaction();

        res.status(200).send("Subscribed successfully");
    }
    }catch(err){
        console.log("error while subscribing to events ",err);
        res.status(500).end("Internal server error Try again Later");
    }
});


eventsRouter.get('/getHeroImages',async(req,res)=>{
    try{
       const imageUrls =  await Promise.all(
        imageNames.map(async(imageName)=>{
            const url = await getPreSignedUrl('eventsData/HeroSection/'+imageName+'.jpg'); 
            return url;
        })
       )
        res.status(200).send(imageUrls);
    }
    catch(err){
        console.log("Error while getting hero images ",err);
        res.status(500).end("internal server error");
    }
});


eventsRouter.get('/galleryImages',async(req,res)=>{
    try{
        const imageUrls = await Promise.all(
            GalleryImages.map(async(imageName)=>{
                const url = await getPreSignedUrl('eventsData/Gallery/'+imageName);
                console.log(`url for the ${imageName} is :`,url);
                return url;
            })
        );
        res.status(200).send(imageUrls);
    }catch(err){
        console.log("Error while getting gallery images");
        res.status(500).end("Internal server Error");
    }
})
export default eventsRouter;