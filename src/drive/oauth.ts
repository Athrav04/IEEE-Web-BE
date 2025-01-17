import process from 'process';
import { google, Auth, drive_v3, GoogleApis } from 'googleapis';
import { GaxiosPromise } from 'googleapis/build/src/apis/abusiveexperiencereport';
import { Response, Router, response } from 'express';
import { driveUserModel } from '../db/driveUserSchema';
import {Credentials} from 'google-auth-library/build/src/auth/credentials'
import {createFolder, findFolder , createTestNested, listFilesInFolder, findFile, getReadAbleStream} from './createFolder';
import { createPath, uploadCommittee } from './committee';

export const oauthRouter = Router();

//One single global client and in authorize just authorize this client with toeken from the oauth server
export const GlobalClient:Auth.OAuth2Client = new google.auth.OAuth2({
  clientId: process.env.OAUTH_CLIENT_ID,
  clientSecret: process.env.OAUTH_CLIENT_SECRET,
  redirectUri: process.env.OAUTH_REDIRECT_URI,
})

type saveCredentialsOptions = {
  user_name?:string | undefined,
  user_email?:string | undefined,
  access_token:string | undefined | null,
  refresh_token?:string | undefined,
  token_expiry_date:Date | undefined
}

const SCOPES = ['https://www.googleapis.com/auth/drive',"https://www.googleapis.com/auth/cloud-platform.read-only"];


//########################################### Check the dataBase for saved user credentials and set them if exists ###########################################
async function loadSavedCredentialsIfExist():Promise<Credentials | null> {
  try {
    const driveUser = await driveUserModel.findOne({user_email:process.env.DRIVE_DEFAULT_EMAIL});
    if(!driveUser){
      console.log("No saved credentials found");
      return null;
    }

    console.log("Saved credentials found : ",driveUser.access_token);
    if(!await checkTokenValidity(driveUser.access_token)){
      const newToken = await revalidateToken(driveUser.refresh_token);
      if(!newToken){
        throw new Error("Failed to revalidate token in loadSavedCredentialsIfExist");
      }

     if( newToken.refresh_token ){
      await saveCredentials({user_email:driveUser.user_email,
        access_token:newToken.access_token!,
        refresh_token:driveUser.refresh_token!,
        token_expiry_date:new Date(newToken.expiry_date!)});
      GlobalClient.setCredentials({access_token:newToken.access_token,refresh_token:driveUser.refresh_token});
      }
      else {
        saveCredentials({user_email:driveUser.user_email,
          access_token:newToken.access_token!,
          token_expiry_date:new Date(newToken.expiry_date!)});
        GlobalClient.setCredentials({access_token:newToken.access_token});
        console.log("new user credentials are :",GlobalClient.credentials);

      }
      
    }
    else {
      GlobalClient.setCredentials({access_token:driveUser.access_token});
    }
    return {access_token:driveUser.access_token}

  } catch (err) {
    console.error('Error loading saved credentials:', err);
    return null;
  }
}


//########################################### Save the user credentials to the database ###########################################
async function saveCredentials(credentials: saveCredentialsOptions) {
  try {
    const driveUser = await driveUserModel.findOne({user_email:credentials.user_email});
    if(!driveUser){
      const newDriveUser = new driveUserModel({
        user_name:credentials.user_name,
        user_email:credentials.user_email,
        access_token:credentials.access_token,
        refresh_token:credentials.refresh_token,
        token_expirty_date:credentials.token_expiry_date
      })
      console.log("New drive user created : ",newDriveUser);
      await newDriveUser.save();
    }
    else{
      driveUser.access_token = credentials.access_token!;
      driveUser.refresh_token = credentials.refresh_token!;
      driveUser.token_expirty_date = credentials.token_expiry_date!
      await driveUser.save();
      console.log("drive user updated : ",driveUser);
    }
  }
  catch(err){
    console.log("Error while saving credentials : ",err);
  }
}


/*
#### Authorize the user (if a user already exists load its credentails and return true)
#### else generate a new authURL and return it to redirect user to consent screen
#### if both no possible throw error (reutrn false is not reachable code for now , will change later)
*/
export async function authorize(): Promise<string | boolean>   {
  const credentialsExist = await loadSavedCredentialsIfExist();
  if(credentialsExist){
    return true;
  }

  // setting scope and redirect uri is genereated to redirect user to the consent screen to give access 
  const authUrl = GlobalClient.generateAuthUrl({
    access_type:'offline',
    scope:SCOPES,
    prompt:'consent',
    response_type:'code',
    redirect_uri:process.env.OAUTH_REDIRECT_URI
  });
  console.log(authUrl);
  if (GlobalClient && GlobalClient.credentials && GlobalClient instanceof google.auth.OAuth2) {
    return authUrl;
  }
  throw new Error("Some error occured while fethcing auth url or saved credentials are not valid")
  return false;
}


// ############################### Given a access_token check if the access token is valid or not ###############################
// HELPER FUNCTION
async function checkTokenValidity(authToken:string):Promise<boolean>{
  try {
    const client =  google.oauth2('v2');
    const isValid = await client.tokeninfo({access_token:authToken});
    console.log("Token is valid : ",isValid.data);
    return true;
  }catch(err){
    console.log("Token is invalid : ",err);
    return false
  }
}


// ############################### Given a refresh token generate a new access_token for the user and return it ###############################
// HELPER FUNCTION
async function revalidateToken(refreshToken:string):Promise<Credentials | null>{
  try{
    GlobalClient.setCredentials({refresh_token:refreshToken});
    const newTokens = await GlobalClient.refreshAccessToken();
    if(!newTokens || !newTokens.credentials){
      throw new Error("Failed to refresh access token");
    }

    console.log("New access token is :",newTokens.credentials);
    return newTokens.credentials;

  }
  catch(err){
    console.log("Error while revalidating the access token :",err);
    return null;
  }
}

// HELPER FUNCTION TO GET USER SPECIFIC INFO (user email and user name for database storage)
async function userInfo(authClient: Auth.OAuth2Client):Promise<Auth.gaxios.GaxiosResponse<drive_v3.Schema$About>| null>{
  try{
    const drive = google.drive({version:'v3',auth:authClient});
  const res = await drive.about.get({
    fields:'user'
  })
  return res;
  }
  catch(err){
    console.log("An error occured while fetching user info:",err);
    return null;
  }
}






// ---------------------------------------------------------------- ROUTES ----------------------------------------------------------------
oauthRouter.get('/login',(req,res)=>{
    authorize()
  .then((response:string | boolean) => {
    if (response && typeof response === 'string') {
      console.log("in login route auth client is :",response);
      res.redirect(response);
    } else if (response === true){
      console.log(GlobalClient.credentials);
      console.log("Authorization successful");
      res.status(200).send("Authorization Successful");
    }
    else{
      console.log("Some error occured while fetching auth url");
    }
  })
  .catch(console.error);

});



oauthRouter.get('/oauthCallback',async(req,res)=>{

  const authcode = req.query.code;
  if(!authcode){
    console.log("No code form google auth found");
    res.status(400).send("No Code found");
  }
 try{
  
  const {tokens} = await GlobalClient.getToken(authcode as string);
  GlobalClient.setCredentials(tokens);


  const response = await userInfo(GlobalClient);
response && console.log("user info is :",response.data);await saveCredentials({
  user_name:response?.data.user?.displayName!,
  user_email:response?.data.user?.emailAddress!,
  access_token:tokens.access_token!,
  refresh_token:tokens.refresh_token!,
  token_expiry_date:new Date(tokens.expiry_date!)
})
console.log("user name is :",response?.data.user?.displayName," and user email address is :",response?.data.user?.emailAddress);
!response && console.log("No user info found");

  
  res.status(200).send("Authorization Successful")

 }
 catch(err){
  console.log("some error occured in callback route: ",err);
  res.status(500).send("Internal server error , please check server logs for more information");
 }

})

oauthRouter.post("/createFolder",async(req,res)=>{
  const parentFolderName = req.query.parentFolder;
  const newFolderName = req.query.newFolderName;
  console.log("parentFolderName is :",parentFolderName , " and newFolderName is : ",newFolderName);
 try {
  await authorize();
  if(parentFolderName){
    const parentFolderId = await findFolder(parentFolderName as string,GlobalClient);
    if(!parentFolderId){
      console.log("falied to fetch parent id ");
      res.send("Failed to fetch parent id").end();
      throw new Error("failed to fetch parent id");
    }
    const response = await createTestNested(newFolderName as string,parentFolderId!,GlobalClient);
    if(response){
      console.log("nested folder created :",response);
      res.status(200).send("Nested folder created");
    }
    else {
      console.log("nested folder creation failed");
      res.status(500).send("Nested folder creation failed");
    }
  }
  else {
    const resp = await createFolder(newFolderName as string,GlobalClient);
  if(resp){
    res.status(200).send("Folder created successfully");
  }
  else{
    res.status(500).send("Folder creation failed");
  }
  }
 }catch(err){console.log("Some error occured :",err);}
  

}
);

oauthRouter.get('/searchFolder',async(req,res)=>{
  const folderName = req.query.folderName;
  if(!folderName){
    console.log("No folerName found");
    res.status(400).send("No folder name found please give a folder name")
  }
  await authorize();
  
  const resp = await findFolder(folderName as string,GlobalClient);
  console.log(await listFilesInFolder(GlobalClient,resp!));
  const fileIds = await listFilesInFolder(GlobalClient,resp!);
  console.log(fileIds);
  fileIds?.forEach(async(file)=>{
   console.log( await listFilesInFolder(GlobalClient,file!));
  })

  res.send(fileIds);
})

oauthRouter.post('/updateFileData',async(req,res)=>{
  const fileName = req.query.fileName;
  const fileId = req.query.fileId;
  console.log("fileId is :",fileId);
  if(!fileId && !fileName){
    res.status(400).send("No file id or name found");
  }
  await authorize();
  const file = await findFile(GlobalClient,fileId as string,fileName as string);
  if(!file){
    res.status(400).send("No file found with given id");
  }
  else 
  {
    const drive = google.drive({version:'v3',auth:GlobalClient});
    const response = await drive.files.update({
      fileId:file,
      requestBody:{
        appProperties:{
          uploaded:"false"
        }
      }
    });
    if(!response){res.status(500).send("Some internal server error please check server logs")}
    res.send(response.data);
  }
})

oauthRouter.post('/createS3Path',async(req,res)=>{
  const pathName = req.query.pathName;
  if(!pathName){
    res.status(400).send("No path name found please provide a path name");
  }
  await authorize();
  const response = await createPath(pathName as string);
  if(!response){
    console.log("failed to create path ")
    res.status(500).send("Some internal server error please check server logs");
  }
  else{
      console.log("path created successfully");
      res.status(200).send("Path created successfully");
  }
});


oauthRouter.get('/testRoute',async(req,res)=>{
  await authorize();
  const resp = await uploadCommittee(GlobalClient);
  if(resp){
    console.log("Committee images uploaded successfully");
    res.status(200).send("Committee images uploaded successfully");
  }
  else{
    console.log("Committee images upload failed");
    res.status(500).send("Committee images upload failed");
  }
  // const fileid = await findFile(GlobalClient,undefined,'Pragati Patil.jpeg');
  // const response = await getReadAbleStream(GlobalClient,fileid!);
  // if(!response){
  //   console.log("failed to get readable stream");
  //   res.status(500).send("Some internal server error please check server logs");
  // }
  // else res.send(response);
})


module.exports = {
  oauthRouter,
  GlobalClient
}