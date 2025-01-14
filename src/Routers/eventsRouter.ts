import {Router} from 'express';
import { authMiddleware } from '../middleware/auth';


const eventsRouter:Router = Router();
eventsRouter.use(authMiddleware);


eventsRouter.get('/',(req,res)=>{
    res.send("events Router")
})
export default eventsRouter;