import process from 'process';
import { google, Auth, drive_v3, GoogleApis } from 'googleapis';
import { GaxiosPromise } from 'googleapis/build/src/apis/abusiveexperiencereport';
import { Response, Router, response } from 'express';
import { driveUserModel } from '../db/driveUserSchema';
import {Credentials} from 'google-auth-library/build/src/auth/credentials'
import {createFolder, findFolder} from './createFolder';

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
  access_token:string | undefined,
  refresh_token?:string | undefined,
  token_expiry_date:Date | undefined
}

const SCOPES = ['https://www.googleapis.com/auth/drive',"https://www.googleapis.com/auth/cloud-platform.read-only"];

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

     if( newToken.access_token ){
      await saveCredentials({user_email:driveUser.user_email,
        access_token:newToken.access_token!,
        refresh_token:driveUser.refresh_token!,
        token_expiry_date:new Date(newToken.expiry_date!)});
      }
      else {
        saveCredentials({user_email:driveUser.user_email,
          access_token:newToken.access_token!,
          token_expiry_date:new Date(newToken.expiry_date!)});
      }
      
    }
    return {access_token:driveUser.access_token}

  } catch (err) {
    console.error('Error loading saved credentials:', err);
    return null;
  }
}

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
      await driveUser.updateOne({
        user_email:credentials.user_email
      },
      {
        access_token:credentials.access_token,
        token_expirty_date:credentials.token_expiry_date
      });
      await driveUser.save();
      console.log("drive user updated : ",driveUser);
    }
  }
  catch(err){
    console.log("Error while saving credentials : ",err);
  }
}

export async function authorize(): Promise<string | boolean>   {
  let token = await loadSavedCredentialsIfExist();

  //check if token exists and if yes then check if valid or not 
  if (token && await checkTokenValidity(token.access_token!)) {
    console.log("Token is valid inside authorize function");
    GlobalClient.setCredentials(token);
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

async function listFiles(authClient: Auth.OAuth2Client) {
  const drive = google.drive({ version: 'v3', auth: authClient });

  const res = await drive.files.list({
    pageSize: 10,
    fields: 'nextPageToken, files(id, name)',
  });
  const files = res.data.files;
  if (!files || files.length === 0) {
    console.log('No files found.');
    return;
  }
  console.log('Files:');
  files.map((file) => {
    console.log(`${file.name} (${file.id})`);
  });
}


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

  
 await listFiles(GlobalClient);
  res.status(200).send("Authorization Successful")

 }
 catch(err){
  console.log("some error occured in callback route: ",err);
  res.status(500).send("some server error");
 }

})

oauthRouter.post("/createFolder",async(req,res)=>{
  const resp = await createFolder("testFolder",GlobalClient);
  if(resp){
    res.status(200).send("Folder created successfully");
  }
  else{
    res.status(500).send("Folder creation failed");
  }
}
);

oauthRouter.get('/searchFolder',async(req,res)=>{
  const resp = await findFolder("testFolder",GlobalClient);
  res.send(resp);
})

module.exports = {
  oauthRouter,
  GlobalClient
}