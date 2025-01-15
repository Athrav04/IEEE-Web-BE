import { GoogleApis , Auth, google} from "googleapis";
import {GlobalClient} from "./oauth"

export  async function createFolder(folderName:string , client:Auth.OAuth2Client):Promise<boolean>{
    const drive = google.drive({version:'v3',auth:client});
    const fileMetaData = { 
        name:folderName,
        MimeTypeArray:['application/vnd.google-apps.folder']
    }
    try{
        const response = await drive.files.create({
            requestBody:fileMetaData,
            fields:'id'
        });
        console.log("Folder created with id :",response.data.id);
        return true;
    }catch(err){
        console.log("An error occured while creating folder:",err);
        return false;
    }
}

export async function findFolder(folderName:string , client:Auth.OAuth2Client):Promise<boolean>{
    const drive = google.drive({version:'v3',auth:client});
    try{
        const response = await drive.files.list({
            q:`name='${folderName}' and mimeType='application/vnd.google-apps.folder'`,
            fields:'files(id,name,parents)'
        });
        console.log("Folder found or not don't know check out the response :",response.data.files);
        response.data.files?.map((file)=>{
            console.log(`Folder name is :${file.name} and id is :${file.id}`);
        })
        return true;
    }catch(err){
        console.log("An error occured while finding folder:",err);
        return false;
    }
}
