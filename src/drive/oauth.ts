import fs from 'fs/promises';
import path from 'path';
import process from 'process';
import { google, Auth } from 'googleapis';
import { Router } from 'express';

const oauthRouter = Router();

type OAuthAuthorizeResponse = {
  client: Auth.OAuth2Client;
  url:string;
}

const SCOPES = ['https://www.googleapis.com/auth/drive',"https://www.googleapis.com/auth/cloud-platform.read-only"];
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

async function loadSavedCredentialsIfExist(): Promise<Auth.OAuth2Client | null> {
  try {
    const content = await fs.readFile(TOKEN_PATH, 'utf-8');
    const credentials = JSON.parse(content);
    console.log('loaded credentials: ',credentials);
    const client = google.auth.fromJSON(credentials);
    if (client instanceof google.auth.OAuth2) {
      return client;
    } else {
      console.error('Saved credentials are not an OAuth2Client.');
      return null;
    }
  } catch (err) {
    console.error('Error loading saved credentials:', err);
    return null;
  }
}

async function saveCredentials(client: Auth.OAuth2Client) {
  const content = await fs.readFile(CREDENTIALS_PATH, 'utf-8');
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

export async function authorize(): Promise<OAuthAuthorizeResponse | null>   {
  // let client = await loadSavedCredentialsIfExist();
  // if (client) {
  //   return client;
  // }
  const newClient = new google.auth.OAuth2({
    clientId: process.env.OAUTH_CLIENT_ID,
    clientSecret: process.env.OAUTH_CLIENT_SECRET,
    redirectUri: process.env.OAUTH_REDIRECT_URI,
  })
  console.log("new client is :",newClient); 
  const authUrl = newClient.generateAuthUrl({
    access_type:'offline',
    scope:SCOPES,
    response_type:'code',
    prompt:'consent',
    redirect_uri:process.env.OAUTH_REDIRECT_URI
  });
  console.log(authUrl);
  if (newClient && newClient.credentials && newClient instanceof google.auth.OAuth2) {
    await saveCredentials(newClient);
    return { client:newClient,url:authUrl};
  }
  return null;
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


oauthRouter.get('/login',(req,res)=>{
    authorize()
  .then((ResponseType:OAuthAuthorizeResponse|null) => {
    if (ResponseType?.client) {
      console.log("in login route auth client is :",ResponseType.client);
      // return listFiles(authClient);
      res.redirect(ResponseType.url);
    } else {
      console.error('Authorization failed. Could not obtain OAuth2Client.');
    }
  })
  .catch(console.error);

});

oauthRouter.get('/oauthCallback',async(req,res)=>{

  console.log("inside the oauth callback route ")
  const authcode = req.query.code;
  if(!authcode){
    console.log("No code form google auth found");
    res.status(400).send("No Code found");
  }
 try{

  const client = new google.auth.OAuth2({
    clientId: process.env.OAUTH_CLIENT_ID,
    clientSecret: process.env.OAUTH_CLIENT_SECRET,
    redirectUri: process.env.OAUTH_REDIRECT_URI,
  })

  const {tokens} = await client.getToken(authcode as string);
  console.log("tokens are :",tokens);
  await client.setCredentials(tokens);

  console.log(
    "Auth successfull and the token and refresh tokens are :",client
  )
  res.status(200).send("Authorization Successful")
 }
 catch(err){
  console.log("some error occured in callback route: ",err);
  res.status(500).send("some server error");
 }

})

export default oauthRouter