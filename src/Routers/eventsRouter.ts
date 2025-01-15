import {Router} from 'express';
import { authMiddleware } from '../middleware/auth';
import {eventModel} from '../db/eventsSchema';


const eventsRouter:Router = Router();


eventsRouter.get('/',(req,res)=>{
    res.send("events Router")
})
export default eventsRouter;