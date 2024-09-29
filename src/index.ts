import express , {Express, request, response} from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser, { CookieParseOptions } from 'cookie-parser'
import {} from 'cookie'
import userRouter from './userRouter';

const config = dotenv.config();
const PORT = process.env.PORT!;
const cookie_secret:string = process.env.COOKIE_SECRET!;


const app:Express = express();
app.use(cookieParser());
app.use(express.json());
app.use(cors());

app.use('/',userRouter);

app.get("/",(request,response) =>{
    response.send("hello")
})


app.listen(PORT , () =>{
    console.log("Server created and running on port ",PORT);
})
