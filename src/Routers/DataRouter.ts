import {Router} from 'express';
import { committeeModel } from '../db/committeeSchema';
import { getPreSignedUrl } from '../helperFunctions/committeeData';
import { getSignedUrl } from '@aws-sdk/cloudfront-signer';
import { getUnuploadedFiles } from '../drive/createFolder';
import { authorize } from '../drive/oauth';
import { startSession } from 'mongoose';

const dataRouter:Router = Router();

dataRouter.get('/',async(req,res)=>{
    const name = req.query.member;
    if(!name){
        console.log("No name Provided");
        res.status(400).send("No name provided");
    }
    else{
        console.log("Name is :",name);
        res.status(200).send(`Hello ${name}`);
    }
})


//Should be a protected route
//TODO: add the middleware later before prod
dataRouter.post('/createUser',async(req,res)=>{
    const {name,domain,position} = req.body;
    const session = await startSession();
    try{
        
        if(!name || !domain || !position){
            res.status(400).send("Please provide all the required fields");
        }
        else{
            console.log("Name is :",name);
                console.log("Domain is :",domain);
                console.log("Position is :",position);

                const user = await committeeModel.findOne({name:name});
                if(user){
                    console.log("User already exists");
                    res.status(400).send("User already exists");    
                }

                session.startTransaction();
                
                const newMember=  new committeeModel({
                    name:name,
                    domain:domain,
                    position:position
                });
                try{
                    (await newMember.save()).$session(session);
                    console.log("Member saved : ",newMember.name)
                    await session.commitTransaction();
                  }
                    catch(err){
                        await session.abortTransaction();
                        console.log("An error occured while saving member :",err);
                        res.status(500).send("An error occured while saving member");
                    }
        }   
           
            res.status(200).send("Member added successfully");
    
        
    }catch(err){
        console.log("An error occured while creating user :",err);
        res.status(500).send("An error occured while creating user");
    }
})

// get all users in the database with updated imageURL's
//Image url are presigned url 
dataRouter.get("/getUsers",async(req,res)=>{
    try{
        const members = await committeeModel.find({});
        console.log("Members are :",members);

        const signedUrl = await Promise.all(
            members.map(async(member)=>{
                const url = await getPreSignedUrl('committeeData/'+member.name+'.jpeg');
                
                return {...member.toObject(),imgUrl:url};
            })
        );

        res.status(200).send(signedUrl);
    }
    catch(err){
        console.log("An error occured while getting users :",err);
        res.status(500).send("Internal server Error");
    }
})

// GET a presigned url for a SINGLE image 
dataRouter.get("/getImage",async(req,res)=>{
    const image = req.query.img
    try{
        const url = await getPreSignedUrl(image as string);
        if(!url){
            res.status(404).send(`${image} not found`);
        }
        else res.status(200).send(url);
    }catch(err){
        console.log("An error occured while getting hero image :",err);
        res.status(500).send("Internal server Error");
    }
});


dataRouter.put('/updateAllUserData',async(req,res)=>{
    try{
        await authorize();
        // const toUploadData = getUnuploadedFiles()
    }catch(err){
        console.log("An error occured while updating all user data :",err);
        res.status(500).send("Internal server Error");
    }
});


dataRouter.get("/HeroImage",async(req,res)=>{
    try{
        const url = await getPreSignedUrl('HeroImage.jpeg');
        if(!url){
            res.status(404).send("Hero Image not found");
        }
        else res.status(200).send(url);
    }catch(err){
        console.log("An error occured while getting hero image :",err);
        res.status(500).send("Internal server Error");
    }
})

export default dataRouter;