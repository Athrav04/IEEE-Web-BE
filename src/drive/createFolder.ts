import { GoogleApis , Auth, google} from "googleapis";
import { PassThrough } from "stream";
import {GlobalClient} from "./oauth"



//############ Find a folder with a particular name in Google drive ############
// logs all the files that are in the folder as well
export async function findFolder(folderName:string , client:Auth.OAuth2Client):Promise<string | null>{
    const drive = google.drive({version:'v3',auth:client});
    try{
        const response = await drive.files.list({
            q:`name='${folderName}' and mimeType='application/vnd.google-apps.folder'`,
            fields:'*'
        });
        console.log("Folder found or not don't know check out the response :",response.data.files);
        response.data?.files?.map((file)=>{
            console.log(`Folder name is :${file.name} and id is :${file.id}`);
        })
        if(response.data?.files?.length !== 0 && response.data != undefined) return response.data.files?.[0].id!;
        return null;
       
    }catch(err){
        console.log("An error occured while finding folder:",err);
        return null;
    }
}


//############ Find a particular file in the drive ############
// Either pass the fileid or the filename to find the file
export async function findFile( client:Auth.OAuth2Client ,fileid?:string , fileName?:string ):Promise<string | null>{
    const drive = google.drive({version:'v3',auth:client});
    try{
        if(fileid){
            const file = await drive.files.get({
                fileId:fileid,
                fields:'*'
               })
               console.log("file found or not don't know ",file.data);
              if(file.data) return file.data.id!;
              else return null;
        }
        else if(fileName){
            const file = await drive.files.list({
                q:`name='${fileName}'`,
                fields:'*'
               })
               console.log("File found or not don't know check out the response :",file.data.files);
               if(file.data.files?.length !== 0) return file.data.files?.[0].id!; 
               else return null;  
        }
       
       else return null;
       
    }catch(err){
        console.log("An error occured while finding file:",err);
        return null;
    }
}

/*
    This function get's all the files in the google drive that have not yet been uploaded S3
    Checks the appProperty uploaded=false and return those fileids 
*/
export async function getUnuploadedFiles(client:Auth.OAuth2Client):Promise<string[] | null>{
    const drive = google.drive({version:'v3',auth:client});
    try{
        const response = await drive.files.list({
            q:"appProperties has { key='uploaded' and value='false' }",
            fields:'*'
        });
        console.log("Files found or not don't know check out the response :",response.data.files);
        const fileids = response.data.files?.map((file)=>{
            console.log(`File name is :${file.name} and id is :${file.id}`);
            return file.id!;
        })
        return fileids!;
    }catch(err){
        console.log("An error occured while finding files:",err);
        return null;
    }
}


/*
    This function returns an array of all the files in a filder 
    PROVIDED A FOLDER ID
    USE THIS METHOD TO GET ALL THE IMAGES IN THE FOLDER 
    AND GET FOLDER ID FROM THE ****findFolder**** METHOD
*/
export async function listFilesInFolder(authClient: Auth.OAuth2Client , folderId:string):Promise<(string | null | undefined)[] | null> {
    const drive = google.drive({ version: 'v3', auth: authClient });
    console.log("in listFiles folderID is: ",folderId);
  
    const res = await drive.files.list({
      q:`'${folderId}' in parents`,
      fields: 'nextPageToken, files(id, name)',
    });
    const files = res.data.files;
    if (!files || files.length === 0) {
      console.log('No files found.');
      return null;
    }
  
    console.log('Files:');
    // 
    const fileid = files.map((file) => {
      console.log(`${file.name} (${file.id})`);
      return file.id;
    });
    return fileid!;
  }


    /*
        This function returns a readable stream of the file
        PROVIDED A FILE ID
        USE THIS METHOD TO GET THE READABLE STREAM OF THE FILE
        AND GET FILE ID FROM THE ****findFile**** METHOD
    */
  export async function getReadAbleStream(authClient:Auth.OAuth2Client , fileId:string):Promise<NodeJS.ReadableStream | null>{
    const drive = google.drive({ version: 'v3', auth: authClient });
    try{
        const response = await drive.files.get({
            fileId:fileId,
            alt:'media'
        },{
            responseType:'stream'
        });
        console.log("Stream response is :",response.data);

        return response.data;
    }catch(err){
        console.log("An error occured while getting stream :",err);
        return null;
    }
  }










  
  //--------------------------- HELPER OR NOT SO IMPORTANT FUNCTIONS ------------------------------

  export  async function createFolder(folderName:string , client:Auth.OAuth2Client):Promise<boolean>{
    const drive = google.drive({version:'v3',auth:client});
    const fileMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      };
    try{
        const response = await drive.files.create({
            requestBody:fileMetadata,
            fields:'id'
        });
        console.log("Folder created with id :",response.data.id);
        return true;
    }catch(err){
        console.log("An error occured while creating folder:",err);
        return false;
    }
}

export async function createTestNested(folderName:string,parentFolderId:string,client:Auth.OAuth2Client):Promise<string | null> {
    const drive = google.drive({version:'v3',auth:client});
    if(parentFolderId === null) return null;
    console.log("prentid is :",parentFolderId , " and folder name is : ",folderName);
    try {
        const fileMetaData = {
            name:folderName,
            mimeType:'application/vnd.google-apps.folder',
            parents:[parentFolderId],
        }
        const response = await drive.files.create({
            requestBody:fileMetaData,
            fields:'id'
        });
        console.log("Folder created with id :",response.data.id);
        if(response.data.id) return response.data.id;
        else return null;
    }
    catch(err){
        console.log("Error occured while creating nested folders :",err);
        return null;
    }
}