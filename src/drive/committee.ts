import { Auth, google } from "googleapis";
import { findFile, findFolder, getReadAbleStream, listFilesInFolder } from "./createFolder";
import { S3Client , CreateBucketCommand,PutObjectCommand ,GetObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";


const s3client = new S3Client({region:'ap-south-1',credentials:{
    accessKeyId:process.env.AWS_ACCESS_KEY!,
    secretAccessKey:process.env.AWS_SECRET!
}});


/*
    UPLOADS image from committee folder to S3 bucket 
    this function uploads stream of image from drive to s3 bucket
*/
export async function uploadCommittee(client:Auth.OAuth2Client):Promise<boolean>{
    console.log("aws client is : ",S3Client);
    const drive = google.drive({version:'v3',auth:client});
    try{
        const parent = await findFolder('Committee',client);
        const nestedFolder = await listFilesInFolder(client,parent!);
        console.log("nested folder is :",nestedFolder);

        const fileId = await findFile(client,undefined,'Pragati patil.jpeg');
        const stream = await getReadAbleStream(client,fileId!);

        const upload = new Upload({
            client: s3client,
            params:{
                Bucket:'viitieeestb',
                Key:'committeeData/Core/Pragati patil.jpeg',
                //@ts-ignore
                Body:stream
            }
        })

        await upload.done();
        console.log("File uploaded successfully");
        return true;
    }
    catch(err){
        console.log("An error occured while uploading committee images :",err);
        return false;
    }
}


export async function createPath(pathName:string):Promise<boolean>{
    try{
        const cmd = new PutObjectCommand({Bucket:'viitieeestb',Key:`committeeData/${pathName}/`});
        console.log("cmd is :",cmd);
        const response = await s3client.send(cmd);
        if(response.$metadata.httpStatusCode == 200)return true;
        else return false;
    }catch(err){
        console.log("An error occured while creating path :",err);
        return false;
    }
}
