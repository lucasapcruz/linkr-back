import { connection } from "../database/server.js";

export async function tokenValidation(req, res, next) {
  const { authorization } = req.headers;
  const token = authorization?.replace("Bearer ", "");

  try {
    const query = await connection.query(`SELECT * FROM sessions WHERE token=$1`, [token]);
    if (query.rowCount === 0) return res.sendStatus(401);

  } catch (err) {
    console.log(err.message);
    res.sendStatus(500);
  }

  res.locals.token = token;
  next();
}
