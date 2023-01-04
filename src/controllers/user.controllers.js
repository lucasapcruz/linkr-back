
import { connection } from "../database/server.js"
import bcrypt from "bcrypt"
import {v4 as createToken} from "uuid"

export async function Signup(req, res){
    const { name, email, password, image_url } = res.locals.data
    try {
        const query = await connection.query("SELECT * FROM users WHERE email = $1;", [email])
        if(query.rowCount != 0) return res.sendStatus(409)
        

        const passwordcrypt = bcrypt.hashSync(password, 10)
        const newpassword = passwordcrypt

        await connection.query('INSERT INTO users ("name", "email", "password", "image_url") VALUES ($1, $2, $3, $4)', [name, email, newpassword, image_url])

        res.sendStatus(201)        
    } catch (error) {
        console.log(error.message)
        res.sendStatus(500)
    }
}

export async function Signin(req, res){
    const { email, password } = res.locals.data

    try {
        const query = await connection.query('SELECT * FROM users WHERE email=$1', [email])
        if( query.rowCount === 0 )  return res.sendStatus(401)
        
        const hashPassword = bcrypt.compareSync(password, query.rows[0].password)
        if(!hashPassword) return res.sendStatus(401)
        
        const newToken = createToken()
        await connection.query(`INSERT INTO sessions ("user_id", token) VALUES ($1, $2);`, [query.rows[0].id, newToken])
        
        res.send({token:newToken})

    } catch (error) {
        console.log(error)
        res.sendStatus(500)
    }
}