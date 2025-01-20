import { Auth, google } from "googleapis";
import { findFile, findFolder, getReadAbleStream, listFilesInFolder } from ".././drive/createFolder";
import { S3Client , CreateBucketCommand,PutObjectCommand ,GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/cloudfront-signer";



const s3client = new S3Client({region:'ap-south-1',credentials:{
    accessKeyId:process.env.AWS_ACCESS_KEY!,
    secretAccessKey:process.env.AWS_SECRET!
}});


/*
    UPLOAD ALL FILES FROM THE COMMITTEE FOLDER IN DRIVE TO S3 BUCKET
    UPLOADS image from committee folder to S3 bucket 
    this function uploads stream of image from drive to s3 bucket
*/
export async function uploadAllCommitteeImages(client:Auth.OAuth2Client):Promise<boolean>{
    console.log("aws client is : ",S3Client);
    try{
        const parent = await findFolder('Committee',client);
        const allFiles = await listFilesInFolder(client,parent!);
        console.log("all files are :",allFiles);

        if(!allFiles) return false;

        for(const file of allFiles){
            const stream = await getReadAbleStream(client,file?.id!);

            const upload = new Upload({
                client:s3client,
                params:{
                    Bucket:'viitieeestb',
                    Key:`committeeData/${file?.name}`,
                    //@ts-ignore
                    Body:stream,
                    ContentType:'image/jpeg'
                }
            });
            await upload.done();
            console.log(`${file?.name} uploaded successfully`);
        }

        return true;
    }
    catch(err){
        console.log("An error occured while uploading committee images :",err);
        return false;
    }
}


/*
    Upload a single file image from google drive to s3 specifiing 
    the file id 
*/
export async function uploadCommitteImage(client:Auth.OAuth2Client,fileId:string):Promise<boolean>{
    try{
        const stream = await getReadAbleStream(client,fileId);

        const file = await findFile(client,fileId);
        const upload = new Upload({
            client:s3client,
            params:{
                Bucket:'viitieeestb',
                Key:`committeeData/${file?.name}`,
                //@ts-ignore
                Body:stream,
                ContentType:'image/jpeg'
            }
        });
        await upload.done();
        console.log(`${file?.name} uploaded successfully`);
        return true;

    }catch(err){
        console.log("An error occured while uploading committee image :",err);
        return false;
    }
}

export async function deleteObjectFromS3(key:string):Promise<boolean>{
    try{
        const cmd = new DeleteObjectCommand({
            Bucket:'viitieeestb',
            Key:key
        });
        console.log("command is :",cmd);   
       const resp = await s3client.send(cmd);
       console.log("Response from s3 :",resp);
       if(resp.$metadata.httpStatusCode === 204) return true;
       else return false;
    }
    catch(err){
        console.log("An error occured while deleting object :",err);
        return false;
    }
}


/*
    This function gets a presigned url for the image in the s3 bucket
    that is served throught the cloudfront distribution
*/
export async function getPreSignedUrl(key:string):Promise<string | null>{
    try{

        const cloudFrontUrl = process.env.AWS_CLOUDFRONT_URL!;

        console.log("Cloudfront url is :",cloudFrontUrl);
        console.log("to get url is : ",cloudFrontUrl+'/'+key);
        console.log("date to set is :",String(new Date(Date.now() + 60*60*1000)));

        const url =  getSignedUrl({
            url:`${cloudFrontUrl}/${key}`,
            keyPairId:process.env.AWS_CLOUDFRONT_KEY_GROUP_ID!,
            privateKey:process.env.AWS_CLOUDFRONT_PRIVATE_KEY!,
            dateLessThan: String (new Date(Date.now() + 60*60*1000))
        })
        console.log("Presigned url is :",url);
        return url;
    }
    catch(err){
        console.log("An error occured while getting presigned url :",err);
        return null;
    }
}
