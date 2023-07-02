import * as dotenv from "dotenv";
dotenv.config({ path: `.env.${process.env.SCRIPT_ENV || "local"}` });
